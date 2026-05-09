import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

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

/**
 * 현재 사용자의 Gmail 기본 서명을 반환.
 * 1) isPrimary 인 sendAs 의 signature 우선
 * 2) isDefault
 * 3) 첫 번째 항목
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.provider_token;
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Gmail 권한 토큰이 없습니다. 다시 로그인해주세요.' },
      { status: 403 }
    );
  }

  try {
    const res = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      // 403 인 경우 → scope 부족 메시지
      if (res.status === 403) {
        return NextResponse.json(
          {
            error:
              'Gmail 서명 읽기 권한이 없습니다. 로그아웃 후 다시 로그인해서 권한을 부여해주세요.',
          },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: `Gmail API ${res.status}: ${errText}` },
        { status: 500 }
      );
    }

    const data = (await res.json()) as SendAsResponse;
    const items = data.sendAs ?? [];

    const primary =
      items.find((s) => s.isPrimary) ??
      items.find((s) => s.isDefault) ??
      items[0];

    return NextResponse.json({
      signature: primary?.signature ?? '',
      sendAsEmail: primary?.sendAsEmail ?? '',
      displayName: primary?.displayName ?? '',
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `서명 조회 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`,
      },
      { status: 500 }
    );
  }
}
