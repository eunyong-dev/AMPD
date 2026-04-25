import { createClient as createBrowserClient } from '@/utils/supabase/client';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { Database } from './database.types';

/**
 * @deprecated 새로운 클라이언트를 사용하세요:
 * - 클라이언트 사이드: `import { createClient } from '@/utils/supabase/client'`
 * - 서버 사이드: `import { createClient } from '@/utils/supabase/server'`
 * 
 * 하위 호환성을 위해 유지되지만, 클라이언트 사이드에서만 사용 가능합니다.
 */
export const supabase = typeof window !== 'undefined' 
  ? createBrowserClient()
  : null as any;

// Google OAuth 로그인 함수 - 간단한 방식
export const signInWithGoogle = async () => {
  if (typeof window === 'undefined') {
    throw new Error('signInWithGoogle은 클라이언트 사이드에서만 호출할 수 있습니다.');
  }

  const supabase = createBrowserClient();
  const redirectUrl = `${window.location.origin}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      queryParams: {
        prompt: 'select_account',
        hd: 'gna.company',
      },
    },
  });

  if (error) {
    console.error('[signInWithGoogle] OAuth 에러:', error);
    throw error;
  }

  // Supabase가 자동으로 리다이렉트함
  return data;
};

// 로그아웃 함수 (클라이언트 사이드)
export const signOut = async () => {
  if (typeof window === 'undefined') {
    throw new Error('signOut은 클라이언트 사이드에서만 호출할 수 있습니다.');
  }

  const supabase = createBrowserClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
};

// 현재 사용자 정보 가져오기
export const getCurrentUser = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return user;
};

// 사용자 프로필 정보 가져오기
export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    return null;
  }

  return data;
};

// AuthSessionMissingError 체크 헬퍼 함수
const isAuthSessionMissingError = (error: unknown): boolean => {
  return (
    error instanceof Error &&
    error.message?.includes('Auth session missing')
  );
};

// 안전한 세션 확인 함수 (에러를 발생시키지 않음)
// 클라이언트 사이드에서만 사용 가능
export const safeGetSession = async () => {
  if (typeof window === 'undefined') {
    throw new Error('safeGetSession은 클라이언트 사이드에서만 호출할 수 있습니다.');
  }

  try {
    const supabase = createBrowserClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      // AuthSessionMissingError는 로그인하지 않은 상태에서는 정상
      if (isAuthSessionMissingError(error)) {
        return { success: true, session: null, user: null };
      }
      return { success: false, error };
    }

    return {
      success: true,
      session: data.session,
      user: data.session?.user || null,
    };
  } catch (error) {
    if (isAuthSessionMissingError(error)) {
      return { success: true, session: null, user: null };
    }
    return { success: false, error };
  }
};

// 안전한 사용자 정보 확인 함수
// 클라이언트 사이드에서만 사용 가능
export const safeGetUser = async () => {
  if (typeof window === 'undefined') {
    throw new Error('safeGetUser은 클라이언트 사이드에서만 호출할 수 있습니다.');
  }

  try {
    const supabase = createBrowserClient();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      // AuthSessionMissingError는 로그인하지 않은 상태에서는 정상
      if (isAuthSessionMissingError(error)) {
        return { success: true, user: null };
      }
      return { success: false, error };
    }

    return { success: true, user: data.user };
  } catch (error) {
    if (isAuthSessionMissingError(error)) {
      return { success: true, user: null };
    }
    return { success: false, error };
  }
};

// 스토리지에서 Supabase 관련 키 제거 헬퍼 함수
const clearStorageKeys = (storage: Storage, keysToRemove: string[]) => {
  keysToRemove.forEach((key) => storage.removeItem(key));
};

const getSupabaseStorageKeys = (storage: Storage): string[] => {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (
      key &&
      (key.includes('supabase') || key.includes('auth') || key.includes('sb-'))
    ) {
      keys.push(key);
    }
  }
  return keys;
};

// Supabase 쿠키 제거 (@supabase/ssr는 sb-*, supabase-* 이름의 쿠키에 토큰 저장)
// 만료 토큰으로 인한 "좀비 세션" 복구에 필수.
const clearSupabaseCookies = () => {
  if (typeof document === 'undefined') return;

  const cookies = document.cookie.split(';');
  const hostname = window.location.hostname;
  const domainVariants = [
    '',
    `; domain=${hostname}`,
    `; domain=.${hostname}`,
  ];

  for (const cookie of cookies) {
    const eqIdx = cookie.indexOf('=');
    const name = (eqIdx > -1 ? cookie.slice(0, eqIdx) : cookie).trim();
    if (!name) continue;
    if (
      name.startsWith('sb-') ||
      name.startsWith('supabase-') ||
      name.includes('supabase')
    ) {
      for (const domain of domainVariants) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
      }
    }
  }
};

// 세션 완전 초기화 (클라이언트 사이드)
export const clearAllSessions = async () => {
  if (typeof window === 'undefined') {
    throw new Error('clearAllSessions은 클라이언트 사이드에서만 호출할 수 있습니다.');
  }

  try {
    const supabase = createBrowserClient();
    // Supabase 세션 종료 (서버/클라이언트 양쪽 쿠키 정리 시도)
    // scope: 'local'을 쓰면 만료 토큰이어도 API 에러 없이 로컬 상태만 정리함.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {
      // 이미 세션이 없거나 만료된 경우 무시
    });

    // 쿠키 정리 (@supabase/ssr의 기본 저장소)
    clearSupabaseCookies();

    // localStorage 및 sessionStorage 정리 (레거시 저장소)
    const localKeys = getSupabaseStorageKeys(localStorage);
    clearStorageKeys(localStorage, localKeys);

    const sessionKeys = getSupabaseStorageKeys(sessionStorage);
    clearStorageKeys(sessionStorage, sessionKeys);

    return { success: true };
  } catch (error) {
    console.error('세션 정리 오류:', error);
    return { success: false, error };
  }
};

// 간단한 로그인 테스트 함수 (개발 환경에서만 사용)
export const testLoginFlow = async () => {
  if (typeof window === 'undefined') {
    throw new Error('testLoginFlow은 클라이언트 사이드에서만 호출할 수 있습니다.');
  }

  try {
    const supabase = createBrowserClient();
    // 1. 현재 세션 상태 확인
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    // 2. 사용자 정보 확인
    const { data: userData, error: userError } = await supabase.auth.getUser();

    // 3. 스토리지 확인 (개발 환경에서만)
    let storageInfo = null;
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      const authKeys = Object.keys(localStorage).filter(
        (key) =>
          key.includes('supabase') ||
          key.includes('auth') ||
          key.includes('sb-')
      );

      const sessionKeys = Object.keys(sessionStorage).filter(
        (key) =>
          key.includes('supabase') ||
          key.includes('auth') ||
          key.includes('sb-')
      );

      storageInfo = { authKeys, sessionKeys };
    }

    // 4. OAuth 설정 확인
    const oauthConfig = {
      currentUrl: typeof window !== 'undefined' ? window.location.href : 'N/A',
      redirectUrl:
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback`
          : 'N/A',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'N/A',
      anonKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
    };

    return {
      session: sessionData,
      user: userData,
      storage: storageInfo,
      oauth: oauthConfig,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return { error };
  }
};
