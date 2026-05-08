/**
 * 접근 권한 관련 유틸리티
 */

export type UserRole = 'am' | 'admin';

export interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  manager_no?: string | null;
}

/**
 * 사용자 역할과 활성화 상태에 따른 접근 권한 확인
 */
export function hasAccess(
  userRole: UserRole | null | undefined,
  isActive: boolean = true
): boolean {
  if (!userRole) return false;

  // 비활성화된 사용자는 접근 불가
  if (isActive === false) return false;

  // 관리자(admin)와 AM만 접근 가능
  return userRole === 'admin' || userRole === 'am';
}

/**
 * 관리자만 접근 가능한 권한 확인 (활성화 상태 포함)
 */
export function hasAdminAccess(
  userRole: UserRole | null | undefined,
  isActive: boolean = true
): boolean {
  if (!userRole) return false;

  // 비활성화된 사용자는 접근 불가
  if (isActive === false) return false;

  // 관리자(admin)만 접근 가능
  return userRole === 'admin';
}

/**
 * 사용자 역할에 따른 접근 권한 메시지 반환
 */
export function getAccessDeniedMessage(
  userRole: UserRole | null | undefined
): string {
  if (!userRole) {
    return '로그인이 필요합니다.';
  }

  return '접근 권한이 없습니다.';
}

/**
 * 사용자 역할 표시명 반환
 */
export function getRoleDisplayName(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '관리자';
    case 'am':
      return 'AM';
    default:
      return '알 수 없음';
  }
}

/**
 * 사용자 역할에 따른 색상 클래스 반환
 */
export function getRoleColorClass(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'am':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}
