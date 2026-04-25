/**
 * 설정 및 상수 타입 정의
 */

export const NAVIGATION_CONFIG = {
  SIDEBAR_WIDTH: '16rem',
  SIDEBAR_WIDTH_MOBILE: '18rem',
  SIDEBAR_WIDTH_ICON: '3rem',
  SIDEBAR_KEYBOARD_SHORTCUT: 'b',
  SIDEBAR_COOKIE_NAME: 'sidebar_state',
  SIDEBAR_COOKIE_MAX_AGE: 60 * 60 * 24 * 7,
} as const;

export const ROUTES = {
  HOME: '/',
  ANALYTICS: '/analytics',
  CAMPAIGNS: '/campaigns',
  TEAM: '/team',
  SETTINGS: '/settings',
  PERMISSIONS: '/permissions',
  LOGIN: '/login',
  AUTH_CALLBACK: '/auth/callback',
} as const;

export const APP_CONFIG = {
  NAME: 'AMPD',
  DESCRIPTION: 'Marketing Platform',
  VERSION: '1.0.0',
  AUTHOR: 'AMPD Team',
} as const;

export const API_ENDPOINTS = {
  USER_PROFILES: '/api/user-profiles',
  CAMPAIGNS: '/api/campaigns',
  ANALYTICS: '/api/analytics',
} as const;

export const ERROR_MESSAGES = {
  NETWORK_ERROR: '네트워크 연결을 확인해주세요.',
  AUTH_ERROR: '인증에 실패했습니다.',
  PERMISSION_DENIED: '접근 권한이 없습니다.',
  GENERIC_ERROR: '오류가 발생했습니다.',
} as const;

export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: '로그인되었습니다.',
  LOGOUT_SUCCESS: '로그아웃되었습니다.',
  SAVE_SUCCESS: '저장되었습니다.',
  DELETE_SUCCESS: '삭제되었습니다.',
} as const;
