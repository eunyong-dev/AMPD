import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerSupabase } from '@/utils/supabase/server';
import { createClient as createDirectSupabase } from '@supabase/supabase-js';
import { getSheetsClientForWrite } from '@/lib/google-sheets';
import type { Database } from '@/lib/database.types';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * 인증 모드:
 *  - 일반: 브라우저 세션 (Supabase cookies)
 *  - 자동화: X-API-Key (user_profiles.appsflyer_api_key) — server-to-server / CLI 용
 *
 * 둘 중 하나라도 통과하면 진행.
 */
async function authenticate(request: NextRequest): Promise<
  | { ok: true; via: 'session' | 'api-key'; userId: string }
  | { ok: false; status: number; error: string }
> {
  // 1) API key 우선 체크
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && anon) {
      const direct = createDirectSupabase<Database>(url, anon, {
        auth: { persistSession: false },
      });
      const { data: profile } = await direct
        .from('user_profiles')
        .select('id, is_active')
        .eq('appsflyer_api_key', apiKey)
        .single();
      if (profile && profile.is_active) {
        return { ok: true, via: 'api-key', userId: profile.id };
      }
      return { ok: false, status: 403, error: '유효하지 않은 API 키' };
    }
  }
  // 2) 세션 인증 fallback
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return { ok: true, via: 'session', userId: user.id };
  return { ok: false, status: 401, error: '인증이 필요합니다.' };
}

// 시트 셀 → 'YYYY-MM-DD' (sync-sheet 와 동일 로직)
function parseDateCell(cell: unknown): string | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (typeof cell === 'number' && Number.isFinite(cell)) {
    const ms = Math.round((cell - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const str = String(cell).trim();
  const m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

// 0-based 컬럼 인덱스 → A1 표기 (A, B, ... Z, AA, AB)
function colIndexToA1(colIdx: number): string {
  let n = colIdx;
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

interface RequestBody {
  date?: string;
  type?: 'note' | 'cpi'; // 기본 'note' (하위호환)
  cpi?: number | string; // type='cpi' 일 때 새 단가
  categories?: string[]; // 비고 컬럼 셀에 텍스트로 기록 (히든퀘스트 등)
  note?: string; // 비고 셀 메모(hover note)로 기록
}

/**
 * POST /api/campaigns/[id]/note
 *
 * 캠페인의 daily report 시트에 변경 사항 기록.
 *  - categories → 비고 컬럼 셀에 텍스트로 기록 (테이블에 보임)
 *  - note → 비고 셀 메모(hover note)로 기록 (셀에 마우스 올리면 보임)
 *  - type='cpi': CPI 컬럼 단가 변경 + 비고 셀에 "CPI old→new" 텍스트 추가
 *
 * 셀 값(텍스트)과 셀 메모는 같은 비고 셀에 공존. 둘 다 기존 내용에 append.
 *
 * Body:
 *  - { date, categories?, note? }              — 비고 기록
 *  - { date, type:'cpi', cpi, categories?, note? } — 단가 변경
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 });
  }

  const date = String(body.date ?? '').trim();
  const type = body.type === 'cpi' ? 'cpi' : 'note';
  const note = String(body.note ?? '').trim(); // 셀 메모(hover note)로
  const categories = Array.isArray(body.categories)
    ? body.categories.map((c) => String(c).trim()).filter(Boolean)
    : [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'date 는 YYYY-MM-DD 형식이어야 합니다.' },
      { status: 400 }
    );
  }

  // 타입별 입력 검증
  let cpiValue: number | null = null;
  if (type === 'cpi') {
    cpiValue = Number(body.cpi);
    if (!Number.isFinite(cpiValue) || cpiValue < 0) {
      return NextResponse.json(
        { error: 'cpi 는 0 이상의 숫자여야 합니다.' },
        { status: 400 }
      );
    }
  } else {
    // note 타입: 카테고리 또는 메모 중 하나는 있어야 함
    if (categories.length === 0 && !note) {
      return NextResponse.json(
        { error: '카테고리 또는 비고 내용 중 하나는 입력해야 합니다.' },
        { status: 400 }
      );
    }
  }

  // 1) 인증 (세션 or X-API-Key)
  const auth = await authenticate(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = await createServerSupabase();

  // 2) 캠페인 조회 + 시트 URL 확인
  const { data: campaign, error: campErr } = await supabase
    .from('campaigns')
    .select('id, name, daily_report_url')
    .eq('id', campaignId)
    .single();
  if (campErr || !campaign) {
    return NextResponse.json(
      { error: '캠페인을 찾을 수 없습니다.' },
      { status: 404 }
    );
  }
  if (!campaign.daily_report_url) {
    return NextResponse.json(
      { error: 'Daily Report URL 이 설정되지 않았습니다.' },
      { status: 400 }
    );
  }

  // 3) sheet_url 파싱 (id + gid)
  const idMatch = campaign.daily_report_url.match(/\/spreadsheets\/d\/([^/]+)/);
  const gidMatch = campaign.daily_report_url.match(/[?&#]gid=(\d+)/);
  if (!idMatch) {
    return NextResponse.json(
      { error: 'sheet_url 에서 spreadsheet ID 추출 실패' },
      { status: 400 }
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
        { status: 404 }
      );
    }
    const sheetTitle = targetSheet.properties.title;
    const sheetNumericId = targetSheet.properties.sheetId; // 셀 메모 updateCells 용

    // 5) 시트 읽기 (값 + 수식 별도 — CPI 셀에 수식 있으면 보호)
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
    const grid = (valuesRes.data.values ?? []) as (string | number)[][];
    const formulaGrid = (formulaRes.data.values ?? []) as (string | number)[][];
    if (grid.length === 0) {
      return NextResponse.json(
        { error: '시트가 비어있습니다.' },
        { status: 400 }
      );
    }

    // 6) 헤더에서 Date / 비고 / CPI 컬럼 찾기
    const normalize = (s: string) =>
      s.trim().toLowerCase().replace(/\s+/g, ' ');
    const headerRow = grid[0].map((h) => normalize(String(h ?? '')));

    const dateColIdx = headerRow.indexOf('date');
    if (dateColIdx === -1) {
      return NextResponse.json(
        { error: 'Date 컬럼을 찾을 수 없습니다.' },
        { status: 400 }
      );
    }
    const noteColIdx = headerRow.findIndex((h) =>
      ['비고', 'note', 'notes', 'memo'].includes(h)
    );
    const cpiColIdx = headerRow.findIndex((h) => h === 'cpi');

    // note 타입은 비고 컬럼 필수. cpi 타입은 비고 없어도 CPI 만 변경 가능.
    if (type === 'note' && noteColIdx === -1) {
      return NextResponse.json(
        { error: '비고/note 컬럼을 찾을 수 없습니다.' },
        { status: 400 }
      );
    }
    if (type === 'cpi' && cpiColIdx === -1) {
      return NextResponse.json(
        { error: 'CPI 컬럼을 찾을 수 없습니다.' },
        { status: 400 }
      );
    }

    // 7) 날짜 행 찾기
    let targetRowNum = -1; // 1-based sheet row number
    for (let r = 1; r < grid.length; r++) {
      const parsed = parseDateCell(grid[r]?.[dateColIdx]);
      if (parsed === date) {
        targetRowNum = r + 1;
        break;
      }
    }
    if (targetRowNum === -1) {
      return NextResponse.json(
        { error: `시트에 ${date} 행이 없습니다.` },
        { status: 404 }
      );
    }
    const rowZeroIdx = targetRowNum - 1;

    // ── 셀 값(비고 컬럼) 업데이트 모음 (values.batchUpdate) ──
    const valueData: { range: string; values: (string | number)[][] }[] = [];

    // ── type: 'cpi' — CPI 셀 변경 ──
    let oldCpiDisplay: string | null = null;
    let cpiWasFormula = false;
    if (type === 'cpi') {
      // CPI 셀이 수식이어도 덮어씀 (단가 변경이 기능 목적). 수식이었으면 안내용 플래그.
      const cpiFormula = formulaGrid[rowZeroIdx]?.[cpiColIdx];
      cpiWasFormula =
        typeof cpiFormula === 'string' && cpiFormula.trim().startsWith('=');
      // 기존 CPI 값 (표시용)
      oldCpiDisplay = String(grid[rowZeroIdx]?.[cpiColIdx] ?? '').trim();
      // CPI 셀 업데이트 (수식 → 정적값으로 대체)
      valueData.push({
        range: `${sheetTitle}!${colIndexToA1(cpiColIdx)}${targetRowNum}`,
        values: [[cpiValue as number]],
      });
    }

    // ── 비고 셀 텍스트 = 카테고리 + (cpi 요약). 셀에 직접 보임 ──
    const cellTextParts: string[] = [];
    if (categories.length > 0) cellTextParts.push(categories.join(', '));
    if (type === 'cpi') {
      cellTextParts.push(
        oldCpiDisplay
          ? `CPI ${oldCpiDisplay}→$${cpiValue}`
          : `CPI $${cpiValue}`
      );
    }
    const cellText = cellTextParts.join(' · ');

    // 비고 셀 텍스트 업데이트 (컬럼 존재 + 수식 아닐 때만, append)
    let cellTextAppended = false;
    const noteFormula =
      noteColIdx !== -1 ? formulaGrid[rowZeroIdx]?.[noteColIdx] : undefined;
    const noteIsFormula =
      typeof noteFormula === 'string' && noteFormula.trim().startsWith('=');
    if (cellText && noteColIdx !== -1 && !noteIsFormula) {
      const existing = String(grid[rowZeroIdx]?.[noteColIdx] ?? '').trim();
      const merged = existing ? `${existing}\n${cellText}` : cellText;
      cellTextAppended = !!existing;
      valueData.push({
        range: `${sheetTitle}!${colIndexToA1(noteColIdx)}${targetRowNum}`,
        values: [[merged]],
      });
    }

    // 셀 값 batchUpdate 실행
    if (valueData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: 'USER_ENTERED', data: valueData },
      });
    }

    // ── 비고 셀 메모(hover note) 업데이트 — 자유 텍스트 ──
    // 비고 컬럼이 있고 메모 내용이 있을 때만. 기존 메모에 줄바꿈으로 append.
    let memoWritten = false;
    if (note && noteColIdx !== -1 && sheetNumericId != null) {
      const cellA1 = `${sheetTitle}!${colIndexToA1(noteColIdx)}${targetRowNum}`;
      // 기존 셀 메모 읽기 (append 위해)
      let existingMemo = '';
      try {
        const memoRead = await sheets.spreadsheets.get({
          spreadsheetId,
          ranges: [cellA1],
          fields: 'sheets.data.rowData.values.note',
        });
        existingMemo =
          memoRead.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0]
            ?.note ?? '';
      } catch {
        // 메모 읽기 실패해도 새로 작성은 진행
      }
      const mergedMemo = existingMemo
        ? `${existingMemo}\n${note}`
        : note;

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              updateCells: {
                range: {
                  sheetId: sheetNumericId,
                  startRowIndex: rowZeroIdx,
                  endRowIndex: rowZeroIdx + 1,
                  startColumnIndex: noteColIdx,
                  endColumnIndex: noteColIdx + 1,
                },
                rows: [{ values: [{ note: mergedMemo }] }],
                fields: 'note',
              },
            },
          ],
        },
      });
      memoWritten = true;
    }

    if (valueData.length === 0 && !memoWritten) {
      return NextResponse.json(
        { error: '기록할 내용이 없습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      type,
      campaign_name: campaign.name,
      sheet_title: sheetTitle,
      date,
      cell_text: cellText || null,
      cell_text_appended: cellTextAppended,
      memo_written: memoWritten,
      ...(type === 'cpi'
        ? {
            old_cpi: oldCpiDisplay,
            new_cpi: cpiValue,
            cpi_was_formula: cpiWasFormula,
          }
        : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    console.error('[campaigns/:id/note] 에러:', err);
    return NextResponse.json(
      { error: `기록 실패: ${msg}` },
      { status: 500 }
    );
  }
}
