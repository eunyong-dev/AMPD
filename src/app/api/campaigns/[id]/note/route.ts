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

/**
 * POST /api/campaigns/[id]/note
 *
 * 캠페인의 daily report 시트의 비고(notes) 컬럼에 메모 기록.
 * - 같은 날짜에 기존 비고가 있으면 줄바꿈으로 append (덮어쓰지 않음)
 * - 비고 컬럼이 시트에 없으면 에러
 * - 해당 날짜 행이 없으면 에러
 *
 * Body: { date: 'YYYY-MM-DD', note: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;

  let body: { date?: string; note?: string };
  try {
    body = (await request.json()) as { date?: string; note?: string };
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 });
  }

  const date = String(body.date ?? '').trim();
  const note = String(body.note ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'date 는 YYYY-MM-DD 형식이어야 합니다.' },
      { status: 400 }
    );
  }
  if (!note) {
    return NextResponse.json({ error: '비고 내용은 필수입니다.' }, { status: 400 });
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

    // 5) 시트 읽기 (FORMATTED_VALUE)
    const range = `${sheetTitle}!A1:AZ1000`;
    const valuesRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const grid = (valuesRes.data.values ?? []) as (string | number)[][];
    if (grid.length === 0) {
      return NextResponse.json(
        { error: '시트가 비어있습니다.' },
        { status: 400 }
      );
    }

    // 6) 헤더에서 Date / 비고 컬럼 찾기
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
    // 비고 또는 note/notes/memo — 여러 명명 대응
    const noteColIdx = headerRow.findIndex((h) =>
      ['비고', 'note', 'notes', 'memo'].includes(h)
    );
    if (noteColIdx === -1) {
      return NextResponse.json(
        { error: '비고/note 컬럼을 찾을 수 없습니다.' },
        { status: 400 }
      );
    }

    // 7) 날짜 행 찾기 (sync-sheet 와 동일한 parseDateCell 로직)
    const parseDateCell = (cell: unknown): string | null => {
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
    };

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

    // 8) 기존 비고 읽기 + append
    const existingNote = String(grid[targetRowNum - 1]?.[noteColIdx] ?? '').trim();
    const newNote = existingNote
      ? `${existingNote}\n${note}`
      : note;

    // A1 표기로 셀 위치 계산
    const colIndexToA1 = (colIdx: number): string => {
      let n = colIdx;
      let s = '';
      while (n >= 0) {
        s = String.fromCharCode((n % 26) + 65) + s;
        n = Math.floor(n / 26) - 1;
      }
      return s;
    };
    const cellA1 = `${sheetTitle}!${colIndexToA1(noteColIdx)}${targetRowNum}`;

    // 9) 비고 셀 업데이트
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: cellA1,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[newNote]],
      },
    });

    return NextResponse.json({
      success: true,
      campaign_name: campaign.name,
      sheet_title: sheetTitle,
      date,
      cell: cellA1,
      appended: !!existingNote,
      note_after: newNote,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    console.error('[campaigns/:id/note] 에러:', err);
    return NextResponse.json(
      { error: `비고 기록 실패: ${msg}` },
      { status: 500 }
    );
  }
}
