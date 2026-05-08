/**
 * 계정 관리 API 함수들
 *
 * 주의: 이 함수들은 클라이언트 사이드에서 사용됩니다.
 * 서버 사이드에서 사용하려면 서버 사이드 클라이언트를 사용해야 합니다.
 */

import { createClient } from '@/utils/supabase/client';
import { UserProfile } from '@/lib/permissions';
import { logSupabaseError } from '@/lib/utils/error-handler';

export interface AccountProfile {
  id: string;
  company: string;
  country: string;
  assigned_user_id: string;
  assigned_user_name: string;
  total_campaigns: number;
  active_campaigns: number;
  active_games: number;
  created_at: string;
  updated_at: string;
  last_campaign_date?: string;
  bill_to_name?: string | null;
  bill_to_email?: string | null;
  bill_to_address?: string | null;
}

export interface AccountInputData {
  company: string;
  country: string;
  assigned_user_id: string;
  bill_to_name?: string | null;
  bill_to_email?: string | null;
  bill_to_address?: string | null;
}

/**
 * 모든 활성화된 사용자 프로필 가져오기
 */
export async function getActiveUserProfiles(): Promise<UserProfile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('is_active', true)
    .order('display_name', { ascending: true });

  if (error) {
    logSupabaseError(
      '활성 사용자 프로필 가져오기 오류:',
      error,
      '활성 사용자를 가져올 수 없습니다.'
    );
  }

  return (data || []).map((profile) => ({
    ...profile,
    user_id: profile.user_id || '',
    email: profile.email || '',
    display_name: profile.display_name || '',
    avatar_url: profile.avatar_url || undefined,
    created_at: profile.created_at || new Date().toISOString(),
    updated_at: profile.updated_at || new Date().toISOString(),
    is_active: profile.is_active ?? true,
  }));
}

/**
 * 새 계정 추가
 */
export async function addAccount(
  accountData: AccountInputData
): Promise<AccountProfile> {
  const supabase = createClient();
  // 먼저 담당자 정보 가져오기
  const { data: userData, error: userError } = await supabase
    .from('user_profiles')
    .select('display_name')
    .eq('id', accountData.assigned_user_id)
    .single();

  if (userError || !userData) {
    console.error('담당자 정보 조회 오류:', userError);
    throw new Error('담당자 정보를 찾을 수 없습니다.');
  }

  // 계정 데이터 삽입
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      company: accountData.company,
      country: accountData.country,
      assigned_user_id: accountData.assigned_user_id,
      bill_to_name: accountData.bill_to_name ?? null,
      bill_to_email: accountData.bill_to_email ?? null,
      bill_to_address: accountData.bill_to_address ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('계정 생성 오류:', error);
    console.error('오류 상세:', JSON.stringify(error, null, 2));
    throw new Error(
      `계정을 생성할 수 없습니다: ${error.message || '알 수 없는 오류'}`
    );
  }

  return {
    id: data.id,
    company: data.company,
    country: data.country,
    assigned_user_id: data.assigned_user_id,
    assigned_user_name: userData.display_name || 'Unknown',
    total_campaigns: data.total_campaigns || 0,
    active_campaigns: data.active_campaigns || 0,
    active_games: data.active_games || 0,
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || new Date().toISOString(),
    bill_to_name: data.bill_to_name ?? null,
    bill_to_email: data.bill_to_email ?? null,
    bill_to_address: data.bill_to_address ?? null,
  };
}

/**
 * 모든 계정 프로필 가져오기
 */
export async function getAllAccountProfiles(): Promise<AccountProfile[]> {
  const supabase = createClient();
  // 계정 정보 가져오기
  const { data: accountsData, error: accountsError } = await supabase
    .from('accounts')
    .select(
      `
      *,
      user_profiles!assigned_user_id (
        display_name
      )
    `
    )
    .order('created_at', { ascending: false });

  if (accountsError) {
    logSupabaseError(
      '계정 프로필 가져오기 오류:',
      accountsError,
      '계정 프로필을 가져올 수 없습니다.'
    );
  }

  if (!accountsData || accountsData.length === 0) {
    return [];
  }

  // 모든 게임 가져오기 (카운트용)
  const { data: gamesData, error: gamesError } = await supabase
    .from('games')
    .select('account_id');

  if (gamesError) {
    console.error('게임 조회 오류:', gamesError);
    // 게임 조회 실패해도 계정은 반환하되, 게임 수는 0으로 설정
  }

  // 모든 캠페인 가져오기 (카운트용)
  // campaigns 테이블은 game_id를 통해 games 테이블의 account_id에 접근
  const { data: campaignsData, error: campaignsError } = await supabase
    .from('campaigns')
    .select(
      `
      status,
      games!inner(
        account_id
      )
    `
    );

  if (campaignsError) {
    console.error('캠페인 조회 오류:', campaignsError);
    // 캠페인 조회 실패해도 계정은 반환하되, 캠페인 수는 0으로 설정
  }

  // 게임 카운트 계산 (account_id별로 그룹핑)
  const gamesCountByAccount: Record<string, number> = {};
  if (gamesData) {
    gamesData.forEach((game) => {
      if (game.account_id) {
        gamesCountByAccount[game.account_id] =
          (gamesCountByAccount[game.account_id] || 0) + 1;
      }
    });
  }

  // 캠페인 카운트 계산 (account_id별로 그룹핑)
  const totalCampaignsCountByAccount: Record<string, number> = {};
  const activeCampaignsCountByAccount: Record<string, number> = {};
  if (campaignsData) {
    campaignsData.forEach((campaign: any) => {
      // account_id는 games 테이블을 통해 접근
      const accountId = campaign.games?.account_id;
      if (accountId) {
        totalCampaignsCountByAccount[accountId] =
          (totalCampaignsCountByAccount[accountId] || 0) + 1;

        // active_campaigns는 'ongoing' 상태만 카운트
        if (campaign.status === 'ongoing') {
          activeCampaignsCountByAccount[accountId] =
            (activeCampaignsCountByAccount[accountId] || 0) + 1;
        }
      }
    });
  }

  // 계정 데이터와 카운트 결합
  return accountsData.map((account) => ({
    id: account.id,
    company: account.company,
    country: account.country,
    assigned_user_id: account.assigned_user_id,
    assigned_user_name: account.user_profiles?.display_name || 'Unknown',
    total_campaigns: totalCampaignsCountByAccount[account.id] || 0,
    active_campaigns: activeCampaignsCountByAccount[account.id] || 0,
    active_games: gamesCountByAccount[account.id] || 0,
    created_at: account.created_at || new Date().toISOString(),
    updated_at: account.updated_at || new Date().toISOString(),
    bill_to_name: account.bill_to_name ?? null,
    bill_to_email: account.bill_to_email ?? null,
    bill_to_address: account.bill_to_address ?? null,
  }));
}

/**
 * 계정 업데이트
 */
export async function updateAccount(
  accountId: string,
  accountData: AccountInputData
): Promise<AccountProfile> {
  const supabase = createClient();
  // 먼저 담당자 정보 가져오기
  const { data: userData, error: userError } = await supabase
    .from('user_profiles')
    .select('display_name')
    .eq('id', accountData.assigned_user_id)
    .single();

  if (userError || !userData) {
    console.error('담당자 정보 조회 오류:', userError);
    throw new Error('담당자 정보를 찾을 수 없습니다.');
  }

  // 계정 데이터 업데이트
  const { data, error } = await supabase
    .from('accounts')
    .update({
      company: accountData.company,
      country: accountData.country,
      assigned_user_id: accountData.assigned_user_id,
      bill_to_name: accountData.bill_to_name ?? null,
      bill_to_email: accountData.bill_to_email ?? null,
      bill_to_address: accountData.bill_to_address ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId)
    .select()
    .single();

  if (error) {
    console.error('계정 업데이트 오류:', error);
    console.error('오류 상세:', JSON.stringify(error, null, 2));
    throw new Error(
      `계정을 업데이트할 수 없습니다: ${error.message || '알 수 없는 오류'}`
    );
  }

  return {
    id: data.id,
    company: data.company,
    country: data.country,
    assigned_user_id: data.assigned_user_id,
    assigned_user_name: userData.display_name || 'Unknown',
    total_campaigns: data.total_campaigns || 0,
    active_campaigns: data.active_campaigns || 0,
    active_games: data.active_games || 0,
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || new Date().toISOString(),
    bill_to_name: data.bill_to_name ?? null,
    bill_to_email: data.bill_to_email ?? null,
    bill_to_address: data.bill_to_address ?? null,
  };
}

/**
 * 계정 삭제
 */
export async function deleteAccount(accountId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', accountId);

  if (error) {
    console.error('계정 삭제 오류:', error);
    console.error('오류 상세:', JSON.stringify(error, null, 2));
    throw new Error(
      `계정을 삭제할 수 없습니다: ${error.message || '알 수 없는 오류'}`
    );
  }
}
