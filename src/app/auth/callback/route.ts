import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * OAuth 콜백 route handler (PKCE code flow)
 *
 * Supabase Google OAuth가 ?code=...로 리다이렉트하면
 * 서버에서 exchangeCodeForSession을 통해 세션을 쿠키에 저장합니다.
 *
 * 기존 client 전용 page.tsx는 hash fragment에 의존했으나
 * @supabase/ssr의 브라우저 클라이언트는 PKCE flow가 기본이므로
 * 서버 측 교환이 정식 방식입니다.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (errorParam) {
    const params = new URLSearchParams({
      error: errorParam,
      ...(errorDescription ? { description: errorDescription } : {}),
    });
    return NextResponse.redirect(`${origin}/?${params.toString()}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=no_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const params = new URLSearchParams({
      error: 'exchange_failed',
      description: error.message,
    });
    return NextResponse.redirect(`${origin}/?${params.toString()}`);
  }

  // Google refresh_token 을 user_profiles 에 저장 (Gmail API access_token 갱신용)
  // session.provider_refresh_token 은 첫 OAuth 시에만 들어오므로 여기서 캡처해야 함
  try {
    const refreshToken = data.session?.provider_refresh_token;
    const userId = data.session?.user?.id;
    if (refreshToken && userId) {
      await supabase
        .from('user_profiles')
        .update({ google_refresh_token: refreshToken })
        .eq('user_id', userId);
    }
  } catch (e) {
    // 저장 실패해도 로그인 자체는 진행
    console.error('[auth/callback] refresh_token 저장 실패:', e);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
