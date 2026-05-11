import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { withGoogleAccessToken } from '@/lib/google-oauth';

export const runtime = 'nodejs';

interface SendAsItem {
  sendAsEmail: string;
  displayName?: string;
  signature?: string;
  isPrimary?: boolean;
  isDefault?: boolean;
}

interface SendAsResponse {
  sendAs?: SendAsItem[];
}

interface SignatureResult {
  signature: string;
  sendAsEmail: string;
  displayName: string;
}

/**
 * 현재 사용자의 Gmail 기본 서명을 반환.
 * provider_token 만료 시 refresh_token 으로 자동 갱신 후 재시도.
 */
export async function GET() {
  const supabase = await createClient();

  try {
    const result = await withGoogleAccessToken<SignatureResult>(
      supabase,
      async (accessToken) => {
        const res = await fetch(
          'https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs',
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (res.status === 401 || res.status === 403) {
          return { ok: false }; // refresh 후 재시도
        }
        if (!res.ok) {
          throw new Error(`Gmail API ${res.status}: ${await res.text()}`);
        }
        const data = (await res.json()) as SendAsResponse;
        const items = data.sendAs ?? [];
        const primary =
          items.find((s) => s.isPrimary) ??
          items.find((s) => s.isDefault) ??
          items[0];
        return {
          ok: true,
          result: {
            signature: primary?.signature ?? '',
            sendAsEmail: primary?.sendAsEmail ?? '',
            displayName: primary?.displayName ?? '',
          },
        };
      }
    );
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
