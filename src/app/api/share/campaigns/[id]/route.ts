import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSheetRows } from '@/lib/google-sheets';
import {
  PUBLIC_CAMPAIGN_DETAIL_SELECT,
  type PublicCampaignDetail,
} from '@/lib/share/public-campaign';

/**
 * 공개(비로그인) 캠페인 성과 조회 — /share/campaigns/[id] 뷰어 전용.
 *
 * 보안 원칙:
 *  - 캠페인 ID 로만 조회. 임의 sheetId/gid 를 받지 않음 (시트 프록시 아님)
 *  - Jira / 리포트 시트 링크는 표시용으로 포함 (시트는 권한 있는 계정만 열람 — 2026-09-11 확인)
 *  - 셀 메모(_notes, 내부 운영 노트)는 제거 후 반환
 *  - 에러 상세/스택은 서버 로그에만 남기고 클라이언트엔 일반 메시지
 *  - CDN 캐시(5분)로 서비스 계정 Sheets 쿼터 보호
 */
export const runtime = 'nodejs';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractSheetParams(
  url: string
): { sheetId: string; gid: string } | null {
  const s = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const g = url.match(/[#&?]gid=(\d+)/);
  return s && g ? { sheetId: s[1], gid: g[1] } : null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: '잘못된 캠페인 주소입니다.' },
      { status: 400 }
    );
  }

  // 쿠키/세션 없는 anon 클라이언트 (campaigns/games/accounts 는 public-read RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await supabase
    .from('campaigns')
    .select(PUBLIC_CAMPAIGN_DETAIL_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[share] 캠페인 조회 실패:', error);
    return NextResponse.json(
      { error: '캠페인을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: '캠페인을 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  const campaign = data as unknown as PublicCampaignDetail;
  const sheet = campaign.daily_report_url
    ? extractSheetParams(campaign.daily_report_url)
    : null;

  let rows: Record<string, unknown>[] = [];
  let reportError: string | null = null;
  if (sheet) {
    try {
      const raw = await getSheetRows({ sheetId: sheet.sheetId, gid: sheet.gid });
      rows = raw.map((r) => {
        const copy: Record<string, unknown> = { ...r };
        delete copy._notes; // 셀 메모(내부 운영 노트) 제외
        return copy;
      });
    } catch (e) {
      console.error('[share] 성과 시트 조회 실패:', e);
      reportError = '성과 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
    }
  }

  return NextResponse.json(
    { campaign, rows, hasReport: !!sheet, reportError },
    {
      headers: {
        // 실패 응답은 캐시하지 않음
        'Cache-Control': reportError
          ? 'no-store'
          : 'public, s-maxage=300, stale-while-revalidate=600',
      },
    }
  );
}
