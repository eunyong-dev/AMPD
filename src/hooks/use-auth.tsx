'use client';

import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { signOut as supabaseSignOut } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    // 초기 인증 상태 확인
    const checkAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (error) {
          console.error('[useAuth] 세션 확인 오류:', error);
          setAuthState({
            user: null,
            loading: false,
            error: '인증 확인 중 오류가 발생했습니다.',
          });
          return;
        }

        setAuthState({
          user: session?.user || null,
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error('[useAuth] 인증 확인 오류:', error);
        if (isMounted) {
          setAuthState({
            user: null,
            loading: false,
            error: '인증 확인 중 오류가 발생했습니다.',
          });
        }
      }
    };

    checkAuth();

    // onAuthStateChange로 인증 상태 변경 감지
    // 이전 구현은 초기 로드 이후 모든 이벤트를 무시하여 토큰 만료·로그아웃
    // 신호를 놓쳤습니다. 유저 ID 비교로 불필요한 리렌더링만 차단합니다.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      // INITIAL_SESSION은 checkAuth와 중복되므로 무시
      if (event === 'INITIAL_SESSION') return;

      const nextUser = session?.user || null;

      setAuthState((prev) => {
        const sameUser = prev.user?.id === nextUser?.id;
        if (sameUser && !prev.loading && !prev.error) {
          return prev;
        }
        return {
          user: nextUser,
          loading: false,
          error: null,
        };
      });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabaseSignOut();

      // 로컬 상태도 즉시 업데이트
      setAuthState({
        user: null,
        loading: false,
        error: null,
      });

      // 페이지 새로고침하여 완전한 상태 초기화
      window.location.href = '/';
    } catch (error) {
      console.error('로그아웃 오류:', error);
      setAuthState((prev) => ({
        ...prev,
        error: '로그아웃 중 오류가 발생했습니다.',
      }));
    }
  };

  return {
    ...authState,
    signOut,
  };
}
