import 'server-only';
import { google, sheets_v4 } from 'googleapis';

/**
 * Google Sheets 서비스 계정 클라이언트
 *
 * 시트를 읽으려면 해당 시트를
 * GOOGLE_SERVICE_ACCOUNT_EMAIL 이메일에 최소 "뷰어"로 공유해야 합니다.
 */
let cachedClient: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !privateKey) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_EMAIL과 GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY 환경변수가 필요합니다.'
    );
  }

  const auth = new google.auth.JWT({
    email,
    // .env에 \n 문자로 escape된 개행을 실제 개행으로 복원
    key: privateKey.replace(/\\n/g, '\n'),
    // 읽기 + 쓰기 (쓰기는 시트가 service account 에 Editor 로 공유되어 있어야 함)
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  cachedClient = google.sheets({ version: 'v4', auth });
  return cachedClient;
}

/**
 * 외부에서 쓰기 작업이 필요한 곳에서 사용 (sheets.spreadsheets.values.batchUpdate 등)
 */
export function getSheetsClientForWrite(): sheets_v4.Sheets {
  return getSheetsClient();
}

/**
 * Google Sheets API 호출을 429(quota 초과) 시 지수 백오프로 재시도.
 * 분당 읽기 한도(사용자당 ~60회/분) 초과 시 잠시 대기 후 재시도.
 */
export async function sheetsApiWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 4
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const e = err as { code?: number; response?: { status?: number } };
      const code = e?.code ?? e?.response?.status;
      const isQuota =
        code === 429 ||
        /quota|rate limit|too many requests/i.test(
          err instanceof Error ? err.message : ''
        );
      if (!isQuota || attempt === maxRetries) throw err;
      // 1.5s, 3s, 6s, 12s ... (+지터)
      const delay = 1500 * 2 ** attempt + Math.floor(Math.random() * 500);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ─────────────────────────────────────────────────────────────
// 서버 메모리 캐시
// ─────────────────────────────────────────────────────────────
type CacheEntry<T> = { data: T; expiresAt: number };

// 시트 탭 제목은 거의 안 바뀌므로 길게 캐시
const titleCache = new Map<string, CacheEntry<string>>();
const TITLE_TTL_MS = 60 * 60 * 1000; // 1시간

// 시트 데이터는 변경 가능성 있으므로 짧게 캐시
const rowsCache = new Map<string, CacheEntry<SheetRow[]>>();
const ROWS_TTL_MS = 5 * 60 * 1000; // 5분

// 같은 키로 동시 진행 중인 요청 dedup
const inflight = new Map<string, Promise<SheetRow[]>>();

const getCached = <T>(map: Map<string, CacheEntry<T>>, key: string): T | null => {
  const hit = map.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    map.delete(key);
    return null;
  }
  return hit.data;
};

const setCached = <T>(
  map: Map<string, CacheEntry<T>>,
  key: string,
  data: T,
  ttl: number
) => {
  map.set(key, { data, expiresAt: Date.now() + ttl });
};

/**
 * gid(sheetId 내의 탭 ID)로 시트의 제목을 찾습니다.
 * 1시간 캐시.
 */
export async function resolveSheetTitle(
  spreadsheetId: string,
  gid: string,
  noCache = false
): Promise<string> {
  const key = `${spreadsheetId}:${gid}`;
  if (!noCache) {
    const cached = getCached(titleCache, key);
    if (cached) return cached;
  }

  const sheets = getSheetsClient();
  const { data } = await sheetsApiWithRetry(() =>
    sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets(properties(sheetId,title))',
    })
  );

  const gidNum = Number(gid);
  const sheet = data.sheets?.find((s) => s.properties?.sheetId === gidNum);

  if (!sheet?.properties?.title) {
    const available = (data.sheets ?? [])
      .map((s) => `${s.properties?.sheetId}(${s.properties?.title})`)
      .join(', ');
    throw new Error(
      `gid ${gid}에 해당하는 탭을 찾을 수 없습니다. 사용 가능한 탭: ${available || '(없음)'}`
    );
  }

  setCached(titleCache, key, sheet.properties.title, TITLE_TTL_MS);
  return sheet.properties.title;
}

// 셀 값은 string, 단 _notes 는 { [header]: 메모텍스트 } 객체.
// _ 접두 키는 헤더/집계에서 제외됨 (page.tsx, campaign-metrics 에서 필터).
type SheetRow = Record<string, string | Record<string, string>>;

/**
 * YYYY-MM-DD 형식인지 확인 (날짜 컬럼 탐지용)
 */
function isDateString(value: unknown): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * 2차원 배열을 헤더 기반 객체 배열로 변환합니다.
 * Apps Script 응답 형식(`{rows: [{header: value, ...}]}`)과 호환되도록 맞춤.
 *
 * @param noteGrid 같은 형태의 2차원 메모 배열 (셀 hover note). 있으면 행에 _notes 부착.
 */
function rowsToObjects(
  values: string[][],
  noteGrid?: (string | null)[][]
): SheetRow[] {
  if (values.length === 0) return [];
  const [headerRow, ...dataRows] = values;
  const headers = headerRow.map((h) => String(h ?? '').trim());

  return dataRows
    .map((row, i) => {
      const obj: SheetRow = {};
      headers.forEach((header, idx) => {
        if (!header) return;
        obj[header] = row[idx] != null ? String(row[idx]) : '';
      });
      // 메모 부착 — noteGrid 의 원본 행 인덱스는 i+1 (헤더 1행 제외)
      const noteRow = noteGrid?.[i + 1];
      if (noteRow) {
        const notes: Record<string, string> = {};
        headers.forEach((header, idx) => {
          if (!header) return;
          const n = noteRow[idx];
          if (n) notes[header] = n;
        });
        if (Object.keys(notes).length > 0) obj._notes = notes;
      }
      return obj;
    })
    .filter((obj) => {
      // 값이 하나라도 있거나 메모가 있는 행만 유지
      return Object.keys(obj).some(
        (k) => k !== '_notes' && obj[k] !== ''
      );
    });
}

/**
 * 날짜 범위 필터. 행의 첫 번째 date-looking 컬럼을 기준으로 비교.
 */
function filterByDateRange(
  rows: SheetRow[],
  fromDate: string | null,
  toDate: string | null
): SheetRow[] {
  if (!fromDate && !toDate) return rows;

  const findDateValue = (row: SheetRow): string | null => {
    for (const value of Object.values(row)) {
      if (typeof value === 'string' && isDateString(value)) return value;
    }
    return null;
  };

  return rows.filter((row) => {
    const date = findDateValue(row);
    if (!date) return true; // 날짜 컬럼이 없는 행은 유지
    if (fromDate && date < fromDate) return false;
    if (toDate && date > toDate) return false;
    return true;
  });
}

export async function getSheetRows(params: {
  sheetId: string;
  gid: string;
  fromDate?: string | null;
  toDate?: string | null;
  /** true면 캐시 무시하고 재fetch */
  noCache?: boolean;
}): Promise<SheetRow[]> {
  const { sheetId, gid, fromDate, toDate, noCache = false } = params;
  const cacheKey = `${sheetId}:${gid}:${fromDate ?? ''}:${toDate ?? ''}`;

  // 1) 캐시 hit
  if (!noCache) {
    const cached = getCached(rowsCache, cacheKey);
    if (cached) return cached;
  } else {
    rowsCache.delete(cacheKey);
  }

  // 2) 같은 키 in-flight 요청 dedup
  const ongoing = inflight.get(cacheKey);
  if (ongoing) return ongoing;

  // 3) 새로 fetch — 값(formattedValue) + 셀 메모(note)를 한 번의 호출로 조회.
  //    (이전엔 values.get + spreadsheets.get 2회 → 읽기 quota 부담. 1회로 통합)
  const promise = (async () => {
    const sheets = getSheetsClient();
    const title = await resolveSheetTitle(sheetId, gid, noCache);
    const quotedRange = `'${title.replace(/'/g, "''")}'`;

    const gridRes = await sheetsApiWithRetry(() =>
      sheets.spreadsheets.get({
        spreadsheetId: sheetId,
        ranges: [quotedRange],
        // formattedValue = 표시값, note = 셀 메모. 둘 다 한 응답에서 추출
        fields: 'sheets.data.rowData.values(formattedValue,note)',
      })
    );

    const rowData = gridRes.data.sheets?.[0]?.data?.[0]?.rowData ?? [];
    const values: string[][] = rowData.map((r) =>
      (r.values ?? []).map((c) => c.formattedValue ?? '')
    );
    const noteGrid: (string | null)[][] = rowData.map((r) =>
      (r.values ?? []).map((c) => c.note ?? null)
    );

    const rows = rowsToObjects(values, noteGrid);
    return filterByDateRange(rows, fromDate ?? null, toDate ?? null);
  })().finally(() => {
    inflight.delete(cacheKey);
  });

  inflight.set(cacheKey, promise);
  const result = await promise;
  setCached(rowsCache, cacheKey, result, ROWS_TTL_MS);
  return result;
}
