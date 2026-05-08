/**
 * 사용자 관리 API 함수들
 * 
 * 주의: 이 함수들은 클라이언트 사이드에서 사용됩니다.
 * 서버 사이드에서 사용하려면 서버 사이드 클라이언트를 사용해야 합니다.
 */

import { createClient } from '@/utils/supabase/client';
import { UserProfile, UserRole } from '@/lib/permissions';
import { logSupabaseError } from '@/lib/utils/error-handler';

/**
 * 모든 사용자 프로필 가져오기
 */
export async function getAllUserProfiles(): Promise<UserProfile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    logSupabaseError(
      '사용자 프로필 가져오기 오류:',
      error,
      '사용자 프로필을 가져올 수 없습니다.'
    );
  }

  // 아바타 URL이 없는 경우 기본 아바타 생성
  const profilesWithAvatars = (data || []).map((profile) => ({
    ...profile,
    user_id: profile.user_id || '',
    email: profile.email || '',
    display_name: profile.display_name || '',
    avatar_url:
      profile.avatar_url ||
      generateDefaultAvatar(profile.email || '', profile.display_name || ''),
    created_at: profile.created_at || new Date().toISOString(),
    updated_at: profile.updated_at || new Date().toISOString(),
    is_active: profile.is_active ?? false,
  }));

  return profilesWithAvatars;
}

/**
 * 기본 아바타 URL 생성 (초기자 기반)
 */
function generateDefaultAvatar(email: string, displayName: string): string {
  // 사용자 이름의 첫 글자를 사용하여 초기자 아바타 생성
  const initial = displayName
    ? displayName.charAt(0).toUpperCase()
    : email.charAt(0).toUpperCase();

  // 이메일 해시를 사용하여 일관된 배경색 생성
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }

  // 해시를 사용하여 색상 생성 (더 밝은 색상 사용)
  const hue = Math.abs(hash) % 360;
  const saturation = 60 + (Math.abs(hash) % 20); // 60-80%
  const lightness = 50 + (Math.abs(hash) % 20); // 50-70%

  // UI Avatars 서비스 사용 (무료 초기자 아바타 생성)
  const params = new URLSearchParams({
    name: initial,
    size: '40',
    background: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    color: 'fff',
    bold: 'true',
    format: 'svg',
  });

  return `https://ui-avatars.com/api/?${params.toString()}`;
}

/**
 * 사용자 역할 업데이트
 */
export async function updateUserRole(
  userId: string,
  newRole: UserRole
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('user_profiles')
    .update({
      role: newRole,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('사용자 역할 업데이트 오류:', error);
    throw new Error('사용자 역할을 업데이트할 수 없습니다.');
  }
}

/**
 * 사용자 담당자 번호 업데이트
 */
export async function updateUserManagerNo(
  userId: string,
  managerNo: string | null
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('user_profiles')
    .update({
      manager_no: managerNo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('담당자 번호 업데이트 오류:', error);
    throw new Error('담당자 번호를 업데이트할 수 없습니다.');
  }
}

/**
 * 사용자 활성화/비활성화 토글
 */
export async function toggleUserActive(
  userId: string,
  isActive: boolean
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('user_profiles')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('사용자 활성화 상태 변경 오류:', error);
    throw new Error('사용자 활성화 상태를 변경할 수 없습니다.');
  }
}

/**
 * 사용자 삭제
 */
export async function deleteUser(userId: string): Promise<void> {
  const supabase = createClient();
  // 먼저 사용자 프로필 정보를 가져와서 auth user_id를 확인
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('id', userId)
    .single();

  if (profileError || !profile?.user_id) {
    console.error('사용자 프로필 조회 오류:', profileError);
    throw new Error('사용자 프로필을 찾을 수 없습니다.');
  }

  // Supabase Auth에서 사용자 삭제
  const { error: authError } = await supabase.auth.admin.deleteUser(
    profile.user_id
  );

  if (authError) {
    console.error('Auth 사용자 삭제 오류:', authError);
    throw new Error('사용자 인증 정보를 삭제할 수 없습니다.');
  }

  // 사용자 프로필 삭제 (CASCADE로 자동 삭제되지만 명시적으로 삭제)
  const { error: profileDeleteError } = await supabase
    .from('user_profiles')
    .delete()
    .eq('id', userId);

  if (profileDeleteError) {
    console.error('사용자 프로필 삭제 오류:', profileDeleteError);
    throw new Error('사용자 프로필을 삭제할 수 없습니다.');
  }
}

/**
 * 새 사용자 추가 (관리자용)
 */
export async function addUser(userData: {
  email: string;
  display_name: string;
  role: UserRole;
}): Promise<UserProfile> {
  const supabase = createClient();
  // 먼저 Supabase Auth에 사용자 생성
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: userData.email,
      email_confirm: true,
    });

  if (authError) {
    console.error('사용자 생성 오류:', authError);
    throw new Error('사용자를 생성할 수 없습니다.');
  }

  // 사용자 프로필 생성
  const { data, error } = await supabase
    .from('user_profiles')
    .insert({
      user_id: authData.user.id,
      email: userData.email,
      display_name: userData.display_name,
      role: userData.role || 'am',
      is_active: false,
    })
    .select()
    .single();

  if (error) {
    console.error('사용자 프로필 생성 오류:', error);
    throw new Error('사용자 프로필을 생성할 수 없습니다.');
  }

  return {
    ...data,
    user_id: data.user_id || '',
    email: data.email || '',
    display_name: data.display_name || '',
    avatar_url: data.avatar_url || undefined,
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || new Date().toISOString(),
    is_active: data.is_active ?? false,
  };
}
