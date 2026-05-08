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
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  cachedClient = google.sheets({ version: 'v4', auth });
  return cachedClient;
}

/**
 * gid(sheetId 내의 탭 ID)로 시트의 제목을 찾습니다.
 */
async function resolveSheetTitle(
  spreadsheetId: string,
  gid: string
): Promise<string> {
  const sheets = getSheetsClient();
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))',
  });

  const gidNum = Number(gid);
  const sheet = data.sheets?.find(
    (s) => s.properties?.sheetId === gidNum
  );

  if (!sheet?.properties?.title) {
    const available = (data.sheets ?? [])
      .map((s) => `${s.properties?.sheetId}(${s.properties?.title})`)
      .join(', ');
    throw new Error(
      `gid ${gid}에 해당하는 탭을 찾을 수 없습니다. 사용 가능한 탭: ${available || '(없음)'}`
    );
  }
  return sheet.properties.title;
}

type SheetRow = Record<string, string>;

/**
 * YYYY-MM-DD 형식인지 확인 (날짜 컬럼 탐지용)
 */
function isDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * 2차원 배열을 헤더 기반 객체 배열로 변환합니다.
 * Apps Script 응답 형식(`{rows: [{header: value, ...}]}`)과 호환되도록 맞춤.
 */
function rowsToObjects(values: string[][]): SheetRow[] {
  if (values.length === 0) return [];
  const [headerRow, ...dataRows] = values;
  const headers = headerRow.map((h) => String(h ?? '').trim());

  return dataRows
    .filter((row) => row.some((cell) => cell !== '' && cell != null))
    .map((row) => {
      const obj: SheetRow = {};
      headers.forEach((header, idx) => {
        if (!header) return;
        obj[header] = row[idx] != null ? String(row[idx]) : '';
      });
      return obj;
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
      if (isDateString(value)) return value;
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
}): Promise<SheetRow[]> {
  const { sheetId, gid, fromDate, toDate } = params;
  const sheets = getSheetsClient();
  const title = await resolveSheetTitle(sheetId, gid);

  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${title.replace(/'/g, "''")}'`,
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  const values = (data.values ?? []) as string[][];
  const rows = rowsToObjects(values);
  return filterByDateRange(rows, fromDate ?? null, toDate ?? null);
}
