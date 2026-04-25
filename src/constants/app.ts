/**
 * 애플리케이션 설정 상수
 */

export const APP_CONFIG = {
  NAME: 'AMPD',
  DESCRIPTION: 'Marketing Platform',
  VERSION: '1.0.0',
  AUTHOR: 'AMPD Team',
  REPOSITORY: 'https://github.com/ampd/ampd',
  SUPPORT_EMAIL: 'support@ampd.com',
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

export const API_ENDPOINTS = {
  USER_PROFILES: '/api/user-profiles',
  CAMPAIGNS: '/api/campaigns',
  ANALYTICS: '/api/analytics',
  AUTH: '/api/auth',
} as const;

export const NAVIGATION_CONFIG = {
  SIDEBAR_WIDTH: '16rem',
  SIDEBAR_WIDTH_MOBILE: '18rem',
  SIDEBAR_WIDTH_ICON: '3rem',
  SIDEBAR_KEYBOARD_SHORTCUT: 'b',
  SIDEBAR_COOKIE_NAME: 'sidebar_state',
  SIDEBAR_COOKIE_MAX_AGE: 60 * 60 * 24 * 7,
} as const;

export const PAGINATION_CONFIG = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 20, 30, 50, 100],
  MAX_PAGE_SIZE: 100,
} as const;

export const THEME_CONFIG = {
  DEFAULT_THEME: 'system',
  THEMES: ['light', 'dark', 'system'] as const,
  STORAGE_KEY: 'theme-preference',
} as const;
