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
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const params = new URLSearchParams({
      error: 'exchange_failed',
      description: error.message,
    });
    return NextResponse.redirect(`${origin}/?${params.toString()}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
