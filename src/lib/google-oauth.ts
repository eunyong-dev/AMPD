import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

interface RefreshTokenResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type: string;
}

/**
 * Google OAuth refresh_token 으로 새 access_token 발급
 */
async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<string> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      'GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET 환경변수가 필요합니다.'
    );
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google token refresh 실패: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as RefreshTokenResponse;
  return data.access_token;
}

/**
 * 현재 로그인 사용자에 저장된 google_refresh_token 으로 fresh access_token 발급.
 * Supabase 세션의 provider_token 보다 우선 — 세션 갱신 후에도 안정적.
 *
 * @param supabase 인증된 Supabase 서버 클라이언트
 * @param testFn   access_token 으로 Google API 호출. { ok: true, result } 또는 { ok: false } 반환
 */
export async function withGoogleAccessToken<T>(
  supabase: SupabaseClient<any, any, any>,
  testFn: (accessToken: string) => Promise<{ ok: boolean; result?: T }>
): Promise<T> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('로그인이 필요합니다.');
  }

  // 1) DB 에서 google_refresh_token 조회
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('google_refresh_token')
    .eq('user_id', user.id)
    .single();

  let refreshToken: string | null = profile?.google_refresh_token ?? null;

  // 2) DB 에 없으면 Supabase 세션에서 폴백 (방금 로그인했지만 callback 저장 실패한 경우 등)
  if (!refreshToken) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    refreshToken = session?.provider_refresh_token ?? null;
    // 폴백으로 받은 토큰을 DB 에 저장해서 다음부턴 안 가져옴
    if (refreshToken) {
      await supabase
        .from('user_profiles')
        .update({ google_refresh_token: refreshToken })
        .eq('user_id', user.id);
    }
  }

  if (!refreshToken) {
    throw new Error(
      'Google refresh_token 이 없습니다. 로그아웃 후 다시 로그인해주세요.'
    );
  }

  // 3) refresh_token 으로 fresh access_token 발급 후 호출
  const accessToken = await refreshGoogleAccessToken(refreshToken);
  const r = await testFn(accessToken);
  if (r.ok && r.result !== undefined) return r.result;

  throw new Error('Google API 호출 실패');
}
