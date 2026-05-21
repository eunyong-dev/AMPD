import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSheetsClientForWrite } from '@/lib/google-sheets';
import type { Database } from '@/lib/database.types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────
// CORS / Origin 검증 — campaigns endpoint 와 동일 패턴
// ─────────────────────────────────────────────────────────────
const ALLOWED_ORIGIN_PATTERNS: (string | RegExp)[] = [
  // AppsFlyer
  'https://hq1.appsflyer.com',
  'https://hq.appsflyer.com',
  'https://www.appsflyer.com',
  // Adjust
  'https://suite.adjust.com',
  'https://dash.adjust.com',
  'https://automate.adjust.com',
  'https://www.adjust.com',
  // 로컬 개발
  /^https?:\/\/localhost(:\d+)?$/,
];

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGIN_PATTERNS.some((p) =>
    typeof p === 'string' ? p === origin : p.test(origin)
  );
}

function corsHeaders(origin: string | null) {
  const allowed = origin && isOriginAllowed(origin) ? origin : '';
  return {
    ...(allowed && { 'Access-Control-Allow-Origin': allowed }),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin')),
  });
}

// ─────────────────────────────────────────────────────────────
// 매핑 정책
// ─────────────────────────────────────────────────────────────
/**
 * AppsFlyer 응답 필드 → 시트 헤더 (정규화된 lower-case + trim)
 * 보호 컬럼(CPI, CVR, 비고, ROAS 류)은 매핑하지 않음 → 자동 SKIP
 * 매핑되어도 셀에 수식 있으면 자동 SKIP
 */
const FIELD_TO_HEADER: Record<string, string> = {
  installs: 'install',
  clicks: 'clicks',
  LTV_revenue: 'revenue', // Revenue 컬럼이 수식이면 자동 SKIP 됨
  D0_revenue: 'd0 revenue',
  D1_revenue: 'd1 revenue',
  D7_revenue: 'd7 revenue',
  D14_revenue: 'd14 revenue',
  D30_revenue: 'd30 revenue',
};

const normalizeHeader = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

// 셀 위치 → A1 표기 (A,B,...Z,AA,AB)
function colIndexToA1(colIdx: number): string {
  let n = colIdx;
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/**
 * 시트 셀 → 'YYYY-MM-DD' 정규화. 매칭 실패 시 null.
 * 지원 형식:
 *  - 'YYYY-MM-DD ...'   (예: '2026-03-11 (수)')
 *  - 'YYYY/MM/DD'
 *  - 시트 serial date (숫자) — 1899-12-30 epoch
 */
function parseDateCell(cell: unknown): string | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (typeof cell === 'number' && Number.isFinite(cell)) {
    // Google Sheets serial date → JS Date
    const ms = Math.round((cell - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const str = String(cell).trim();
  // 'YYYY-MM-DD' 또는 'YYYY/MM/DD' 패턴 추출
  const m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return null;
  const yyyy = m[1];
  const mm = m[2].padStart(2, '0');
  const dd = m[3].padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

interface AppsflyerRow {
  date?: string;
  installs?: number | string;
  clicks?: number | string;
  LTV_revenue?: number | string;
  D0_revenue?: number | string;
  D1_revenue?: number | string;
  D7_revenue?: number | string;
  D14_revenue?: number | string;
  D30_revenue?: number | string;
  [key: string]: unknown;
}

interface SyncRequestBody {
  sheet_url: string;
  rows: AppsflyerRow[];
}

interface SyncResult {
  campaign?: string;
  matched: number; // 기존 날짜 매칭 후 업데이트
  filled: number; // 빈 Date 행에 새 입력
  appended: number; // 시트 끝에 새 행 추가
  skipped_no_date: number;
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────
// POST /api/external/sync-sheet
// ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const apiKey = request.headers.get('x-api-key');

  if (!isOriginAllowed(origin)) {
    return NextResponse.json(
      { error: '허용되지 않은 Origin.' },
      { status: 403, headers: corsHeaders(origin) }
    );
  }
  if (!apiKey) {
    return NextResponse.json(
      { error: 'X-API-Key 헤더 필요' },
      { status: 401, headers: corsHeaders(origin) }
    );
  }

  // 1) API key → user 식별
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
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, is_active')
    .eq('appsflyer_api_key', apiKey)
    .single();
  if (!profile || !profile.is_active) {
    return NextResponse.json(
      { error: '유효하지 않은 API 키' },
      { status: 403, headers: corsHeaders(origin) }
    );
  }

  // 2) Body 파싱
  let body: SyncRequestBody;
  try {
    body = (await request.json()) as SyncRequestBody;
  } catch {
    return NextResponse.json(
      { error: '잘못된 JSON' },
      { status: 400, headers: corsHeaders(origin) }
    );
  }
  if (!body.sheet_url || !Array.isArray(body.rows)) {
    return NextResponse.json(
      { error: 'sheet_url, rows 는 필수' },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  // 3) sheet_url 파싱 (id + gid)
  const idMatch = body.sheet_url.match(/\/spreadsheets\/d\/([^/]+)/);
  const gidMatch = body.sheet_url.match(/[?&#]gid=(\d+)/);
  if (!idMatch) {
    return NextResponse.json(
      { error: 'sheet_url 에서 spreadsheet ID 추출 실패' },
      { status: 400, headers: corsHeaders(origin) }
    );
  }
  const spreadsheetId = idMatch[1];
  const gid = gidMatch ? Number(gidMatch[1]) : null;

  try {
    const sheets = getSheetsClientForWrite();

    // 4) 탭 정보 조회 (gid → title)
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const allSheets = meta.data.sheets ?? [];
    const targetSheet =
      gid !== null
        ? allSheets.find((s) => s.properties?.sheetId === gid)
        : allSheets[0];
    if (!targetSheet || !targetSheet.properties?.title) {
      return NextResponse.json(
        { error: `gid=${gid} 인 탭을 찾을 수 없습니다.` },
        { status: 404, headers: corsHeaders(origin) }
      );
    }
    const sheetTitle = targetSheet.properties.title;

    // 5) 시트 데이터 읽기 (값 + 수식 따로)
    // FORMATTED_VALUE 로 읽어야 날짜가 "2026-03-11 (수)" 같은 표시 문자열로 옴
    // (UNFORMATTED_VALUE 는 serial date 숫자로 반환되어 매칭 불가)
    const range = `${sheetTitle}!A1:AZ1000`;
    const [valuesRes, formulaRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption: 'FORMATTED_VALUE',
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption: 'FORMULA',
      }),
    ]);
    const valuesGrid = (valuesRes.data.values ?? []) as (string | number)[][];
    const formulaGrid = (formulaRes.data.values ?? []) as (string | number)[][];

    if (valuesGrid.length === 0) {
      return NextResponse.json(
        { error: '시트가 비어있습니다.' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // 헤더 행: index 0
    const headerRow = valuesGrid[0].map((h) =>
      normalizeHeader(String(h ?? ''))
    );

    // Date 컬럼 인덱스
    const dateColIdx = headerRow.indexOf('date');
    if (dateColIdx === -1) {
      return NextResponse.json(
        { error: 'Date 컬럼을 찾을 수 없습니다.' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // AppsFlyer 필드 → 시트 컬럼 인덱스
    const fieldToColIdx: Record<string, number> = {};
    for (const [field, headerName] of Object.entries(FIELD_TO_HEADER)) {
      const idx = headerRow.indexOf(headerName);
      if (idx !== -1) fieldToColIdx[field] = idx;
    }

    // 6) 데이터 행 분석 — 날짜 매칭 + 빈 Date 행 큐
    const dateToRow = new Map<string, number>(); // 'YYYY-MM-DD' → 시트 행번호 (1-based)
    const emptyRows: number[] = []; // 1-based 시트 행번호

    // valuesGrid[0] 은 헤더, 데이터는 1부터
    for (let r = 1; r < valuesGrid.length; r++) {
      const row = valuesGrid[r];
      const cell = row?.[dateColIdx];
      const sheetRowNum = r + 1; // 1-based
      if (cell === undefined || cell === null || cell === '') {
        emptyRows.push(sheetRowNum);
      } else {
        const parsed = parseDateCell(cell);
        if (parsed) {
          dateToRow.set(parsed, sheetRowNum);
        }
        // 파싱 실패한 비표준 행은 매칭 대상에서도 빈 행에서도 제외 (오염 방지)
      }
    }

    // 7) AppsFlyer 행 정렬 (오름차순) 후 처리
    const sortedRows = body.rows
      .filter((r) => r.date && /^\d{4}-\d{2}-\d{2}$/.test(String(r.date)))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const result: SyncResult = {
      matched: 0,
      filled: 0,
      appended: 0,
      skipped_no_date: body.rows.length - sortedRows.length,
      warnings: [],
    };

    // batchUpdate 데이터
    type CellUpdate = { range: string; values: (string | number | null)[][] };
    const batchData: CellUpdate[] = [];

    let nextEmptyIdx = 0;
    let lastUsedRow = valuesGrid.length; // 1-based — append 시작점

    for (const afRow of sortedRows) {
      const dateStr = String(afRow.date);
      let targetRow: number;
      let mode: 'matched' | 'filled' | 'appended';

      if (dateToRow.has(dateStr)) {
        targetRow = dateToRow.get(dateStr)!;
        mode = 'matched';
      } else if (nextEmptyIdx < emptyRows.length) {
        targetRow = emptyRows[nextEmptyIdx++];
        mode = 'filled';
        // Date 셀에 날짜 입력
        batchData.push({
          range: `${sheetTitle}!${colIndexToA1(dateColIdx)}${targetRow}`,
          values: [[dateStr]],
        });
      } else {
        // 빈 행 다 떨어짐 — 시트 끝에 append
        lastUsedRow += 1;
        targetRow = lastUsedRow;
        mode = 'appended';
        batchData.push({
          range: `${sheetTitle}!${colIndexToA1(dateColIdx)}${targetRow}`,
          values: [[dateStr]],
        });
        if (result.appended === 0) {
          result.warnings.push(
            '미리 만들어둔 빈 Date 행이 부족하여 시트 끝에 새 행이 추가됨 — CPI/수식 자동 복사 안될 수 있음'
          );
        }
      }

      // 각 매핑 필드별로 값 입력 (단, 수식 셀은 SKIP)
      for (const [field, colIdx] of Object.entries(fieldToColIdx)) {
        const value = (afRow as any)[field];
        if (value === undefined || value === null) continue;

        // 수식 검사 (matched / filled 모드에서)
        if (mode !== 'appended') {
          const formulaCell = formulaGrid[targetRow - 1]?.[colIdx];
          if (
            typeof formulaCell === 'string' &&
            formulaCell.trim().startsWith('=')
          ) {
            continue; // 수식은 보호
          }
        }

        const numeric = typeof value === 'number' ? value : Number(value);
        batchData.push({
          range: `${sheetTitle}!${colIndexToA1(colIdx)}${targetRow}`,
          values: [[Number.isFinite(numeric) ? numeric : String(value)]],
        });
      }

      if (mode === 'matched') result.matched++;
      else if (mode === 'filled') result.filled++;
      else result.appended++;
    }

    // 8) batch update
    if (batchData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: batchData,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        sheet_title: sheetTitle,
        ...result,
        cells_updated: batchData.length,
      },
      { headers: corsHeaders(origin) }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    console.error('[sync-sheet] 에러:', err);
    return NextResponse.json(
      { error: `Sync 실패: ${msg}` },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
