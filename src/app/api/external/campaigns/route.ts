import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

export const runtime = 'nodejs';

// MMP 별 허용 Origin
// - 북마클릿이 어느 MMP 콘솔에서 실행됐는지에 따라 응답 필터링
const APPSFLYER_ORIGIN_PATTERNS: (string | RegExp)[] = [
  'https://hq1.appsflyer.com',
  'https://hq.appsflyer.com',
  'https://www.appsflyer.com',
];

const ADJUST_ORIGIN_PATTERNS: (string | RegExp)[] = [
  'https://suite.adjust.com',
  'https://dash.adjust.com',
  'https://automate.adjust.com',
  'https://www.adjust.com',
];

const TENJIN_ORIGIN_PATTERNS: (string | RegExp)[] = [
  'https://dashboard.tenjin.com',
];

// 종료 · 보류 캠페인은 종료일로부터 이만큼 지나면 동기화 대상에서 뺌
// (종료 직전 설치 유저의 D30 매출이 종료 뒤 30일까지 쌓이므로 그때까지만 조회 — 그 뒤엔 데이터가 안 바뀌는데
//  매번 MMP 를 다시 조회해 동기화가 느려졌음)
const CLOSED_SYNC_GRACE_DAYS = 30;

/** 한국시간 기준 오늘에서 N일 전 (YYYY-MM-DD) */
function kstDaysAgo(days: number): string {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

// 로컬 개발은 양쪽 모두 허용 (개발 편의)
const LOCAL_ORIGIN_PATTERN = /^https?:\/\/localhost(:\d+)?$/;

function matchesAny(
  origin: string,
  patterns: (string | RegExp)[]
): boolean {
  return patterns.some((p) =>
    typeof p === 'string' ? p === origin : p.test(origin)
  );
}

/**
 * Origin → MMP 매핑
 * - AppsFlyer 콘솔: 'AppsFlyer'
 * - Adjust 콘솔: 'Adjust'
 * - Tenjin 대시보드: 'Tenjin'
 * - localhost: null (로컬 개발 — 전체 반환)
 * - 그 외: undefined (차단)
 */
function detectMmpFromOrigin(
  origin: string | null
): 'AppsFlyer' | 'Adjust' | 'Tenjin' | null | undefined {
  if (!origin) return undefined;
  if (matchesAny(origin, APPSFLYER_ORIGIN_PATTERNS)) return 'AppsFlyer';
  if (matchesAny(origin, ADJUST_ORIGIN_PATTERNS)) return 'Adjust';
  if (matchesAny(origin, TENJIN_ORIGIN_PATTERNS)) return 'Tenjin';
  if (LOCAL_ORIGIN_PATTERN.test(origin)) return null;
  return undefined;
}

function isOriginAllowed(origin: string | null): boolean {
  return detectMmpFromOrigin(origin) !== undefined;
}

function corsHeaders(origin: string | null) {
  // 허용된 origin 만 ACAO 로 echo (그 외는 헤더 미설정 → 브라우저가 차단)
  const allowed = origin && isOriginAllowed(origin) ? origin : '';
  return {
    ...(allowed && { 'Access-Control-Allow-Origin': allowed }),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

// CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin')),
  });
}

/**
 * GET /api/external/campaigns
 * 사용자의 API key 로 인증해서 캠페인 리스트 반환.
 * AppsFlyer / Adjust / Tenjin 북마클릿이 호출용.
 *
 * Headers: X-API-Key
 * Origin 에 따라 MMP 자동 필터 (AppsFlyer 콘솔 → AppsFlyer 캠페인만, Adjust 콘솔 → Adjust 캠페인만, Tenjin → Tenjin 캠페인만)
 * 종료(end) · 보류(holding) 이고 종료일이 30일 넘게 지난 캠페인은 제외 (종료일 없는 건 그대로 포함)
 * Returns: [{ name, app_package_identifier, region, start_date, end_date, status, ... }]
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const apiKey = request.headers.get('x-api-key');

  // Origin 검증 — 허용된 도메인에서만 호출 가능 (키 유출 시 피해 최소화)
  const mmpFromOrigin = detectMmpFromOrigin(origin);
  if (mmpFromOrigin === undefined) {
    return NextResponse.json(
      {
        error:
          '허용되지 않은 Origin. AppsFlyer / Adjust / Tenjin 콘솔/북마클릿에서만 호출 가능합니다.',
      },
      { status: 403, headers: corsHeaders(origin) }
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: 'X-API-Key 헤더 필요' },
      { status: 401, headers: corsHeaders(origin) }
    );
  }

  // RLS 의 public read 정책으로 anon key 만으로 조회 가능
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      { error: '서버 설정 오류' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }

  const supabase = createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });

  // 1) API key 로 사용자 식별
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('id, display_name, role, is_active')
    .eq('appsflyer_api_key', apiKey)
    .single();

  if (profileErr || !profile || !profile.is_active) {
    return NextResponse.json(
      { error: '유효하지 않은 API 키' },
      { status: 403, headers: corsHeaders(origin) }
    );
  }

  // 2) 캠페인 + 게임(앱 패키지) + 광고주(adjust_account_id) 정보 조회
  // - 본인 담당 광고주 (assigned_user_id = profile.id)
  // - Origin 기반 MMP 필터: AppsFlyer 콘솔 → AppsFlyer 캠페인만, Adjust 콘솔 → Adjust 캠페인만
  // - app_token 은 북마클릿이 package_identifier 로 Adjust /apps 응답에서 자동 매핑
  let query = supabase
    .from('campaigns')
    .select(
      `
        name,
        region,
        start_date,
        end_date,
        status,
        timezone,
        mmp,
        adjust_ad_revenue_sources,
        daily_report_url,
        games!inner (
          package_identifier,
          accounts!inner (
            id,
            company,
            assigned_user_id,
            adjust_account_id
          )
        )
      `
    )
    .eq('games.accounts.assigned_user_id', profile.id);

  // localhost (개발) 에서는 전체 반환 — MMP 필터 안 함
  if (mmpFromOrigin) {
    query = query.eq('mmp', mmpFromOrigin);
  }

  const { data: campaigns, error: campErr } = await query.order(
    'start_date',
    { ascending: false }
  );

  if (campErr) {
    return NextResponse.json(
      { error: `캠페인 조회 실패: ${campErr.message}` },
      { status: 500, headers: corsHeaders(origin) }
    );
  }

  // 3) 종료 · 보류 후 30일 지난 캠페인 제외
  const cutoff = kstDaysAgo(CLOSED_SYNC_GRACE_DAYS);
  const syncable = (campaigns ?? []).filter(
    (c) =>
      !(
        (c.status === 'end' || c.status === 'holding') &&
        c.end_date &&
        c.end_date < cutoff
      )
  );

  // 4) 응답 정리 — 북마클릿이 쓰기 좋은 형태로
  const result = syncable.map((c) => {
    const game = (c as any).games;
    const account = game?.accounts ?? null;
    return {
      name: c.name,
      region: c.region,
      status: c.status,
      start_date: c.start_date,
      end_date: c.end_date,
      timezone: c.timezone ?? null,
      mmp: c.mmp,
      app_package_identifier: game?.package_identifier ?? null,
      adjust_ad_revenue_sources: c.adjust_ad_revenue_sources ?? null,
      account_id: account?.id ?? null,
      account_company: account?.company ?? null,
      adjust_account_id: account?.adjust_account_id ?? null,
      sheet_url: c.daily_report_url ?? null,
    };
  });

  return NextResponse.json(
    {
      user: {
        id: profile.id,
        display_name: profile.display_name,
        role: profile.role,
      },
      mmp_filter: mmpFromOrigin ?? 'all',
      count: result.length,
      campaigns: result,
    },
    { headers: corsHeaders(origin) }
  );
}
