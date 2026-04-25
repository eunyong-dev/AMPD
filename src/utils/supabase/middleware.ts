import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { Database } from '@/lib/database.types';

/**
 * 미들웨어에서 사용하는 Supabase 클라이언트
 * 요청마다 세션을 갱신하고 쿠키를 업데이트합니다.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // 세션 갱신 (만료된 토큰 자동 갱신)
  // getUser()는 Supabase 서버에 토큰을 재검증합니다.
  // refresh token이 만료된 경우 AuthApiError가 발생하며,
  // Supabase SSR 라이브러리가 내부적으로 쿠키를 정리합니다.
  const { error } = await supabase.auth.getUser();

  // refresh token 만료 시 남아있을 수 있는 쿠키를 명시적으로 제거하여
  // 클라이언트가 "좀비 세션" 상태에 빠지지 않도록 합니다.
  if (error) {
    const authCookies = request.cookies
      .getAll()
      .filter(({ name }) => name.startsWith('sb-'));
    authCookies.forEach(({ name }) => {
      supabaseResponse.cookies.delete(name);
    });
  }

  return supabaseResponse;
}
