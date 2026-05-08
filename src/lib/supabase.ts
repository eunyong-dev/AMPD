import { createClient as createBrowserClient } from '@/utils/supabase/client';

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

  return data;
};

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

// @supabase/ssr는 sb-*, supabase-* 이름의 쿠키에 토큰을 저장.
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

export const clearAllSessions = async () => {
  if (typeof window === 'undefined') {
    throw new Error('clearAllSessions은 클라이언트 사이드에서만 호출할 수 있습니다.');
  }

  try {
    const supabase = createBrowserClient();
    // scope: 'local'은 만료 토큰이어도 API 에러 없이 로컬 상태만 정리
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});

    clearSupabaseCookies();

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
