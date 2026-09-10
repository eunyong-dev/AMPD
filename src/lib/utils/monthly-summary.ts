import { parseSheetDate as parseSheetDateRaw } from '@/lib/utils/sheet-formatters';

type Row = Record<string, unknown>;

// 시트 셀 값(unknown) → 날짜 파싱
const parseSheetDate = (v: unknown) =>
  parseSheetDateRaw(v == null ? null : String(v));
export type MonthlySummaryRow = Record<string, string>;

const findDateHeader = (row: Row | undefined): string | null => {
  if (!row) return null;
  return (
    Object.keys(row).find(
      (h) => h === '날짜' || h === 'date' || h.toLowerCase() === 'date'
    ) ?? null
  );
};

/**
 * 일간 시트 행 → 월간 집계.
 * 합산 가능한 컬럼은 합계, ROAS / CPI / CVR 같은 비율 컬럼은 합계 기반으로 재계산.
 * 내부 캠페인 상세와 공개 뷰어가 공유하는 단일 로직.
 */
export function computeMonthlySummary(
  allData: Row[] | null | undefined
): MonthlySummaryRow[] | null {
  if (!allData || allData.length === 0) return null;
  const dateHeader = findDateHeader(allData[0]);
  if (!dateHeader) return null;

  const parseNumeric = (val: unknown): number | null => {
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    if (!str || str === '-') return null;
    const hasPercent = str.endsWith('%');
    const cleaned = str.replace(/[$,\s]/g, '').replace(/%$/, '');
    const n = parseFloat(cleaned);
    if (isNaN(n)) return null;
    return hasPercent ? n / 100 : n;
  };

  // 비율 컬럼 재계산 규칙 (컬럼명 정확 매칭)
  const recalc: Record<string, (s: Record<string, number>) => number | null> = {
    CPI: (s) => (s['Install'] > 0 ? s['Cost'] / s['Install'] : null),
    ROAS: (s) => (s['Cost'] > 0 ? s['Revenue'] / s['Cost'] : null),
    CVR: (s) => (s['Clicks'] > 0 ? s['Install'] / s['Clicks'] : null),
    'D0 ROAS': (s) => (s['Cost'] > 0 ? s['D0 Revenue'] / s['Cost'] : null),
    'D1 ROAS': (s) => (s['Cost'] > 0 ? s['D1 Revenue'] / s['Cost'] : null),
    'D7 ROAS': (s) => (s['Cost'] > 0 ? s['D7 Revenue'] / s['Cost'] : null),
    'D14 ROAS': (s) => (s['Cost'] > 0 ? s['D14 Revenue'] / s['Cost'] : null),
    'D30 ROAS': (s) => (s['Cost'] > 0 ? s['D30 Revenue'] / s['Cost'] : null),
  };

  const dataColumns = Object.keys(allData[0]).filter(
    (h) => h !== dateHeader && !h.startsWith('_')
  );

  // 컬럼별 표시 형식 감지 (첫 유효 값 기준)
  const columnFormats: Record<string, 'dollar' | 'percent' | 'number'> = {};
  for (const col of dataColumns) {
    columnFormats[col] = 'number';
    for (const row of allData) {
      const val = String(row[col] ?? '').trim();
      if (!val || val === '-') continue;
      if (val.startsWith('$')) columnFormats[col] = 'dollar';
      else if (val.endsWith('%')) columnFormats[col] = 'percent';
      else columnFormats[col] = 'number';
      break;
    }
  }

  // 월별 그룹화
  const groups: Record<string, Row[]> = {};
  for (const row of allData) {
    const d = parseSheetDate(row[dateHeader]);
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      '0'
    )}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }

  // 월별 합계 + 재계산 + 포맷
  const format = (num: number | null, fmt: 'dollar' | 'percent' | 'number') => {
    if (num === null || !isFinite(num)) return '-';
    if (fmt === 'dollar') return `$ ${num.toFixed(2)}`;
    if (fmt === 'percent') return `${(num * 100).toFixed(2)}%`;
    return Number.isInteger(num) ? num.toLocaleString() : num.toFixed(2);
  };

  return Object.keys(groups)
    .sort()
    .map((month) => {
      const rows = groups[month];
      const sums: Record<string, number> = {};
      for (const col of dataColumns) {
        sums[col] = 0;
        for (const row of rows) {
          const n = parseNumeric(row[col]);
          if (n !== null) sums[col] += n;
        }
      }

      const out: MonthlySummaryRow = { Month: month };
      for (const col of dataColumns) {
        const value = recalc[col] ? recalc[col](sums) : sums[col];
        out[col] = format(value, columnFormats[col]);
      }
      return out;
    });
}
