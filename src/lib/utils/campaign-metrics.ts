/**
 * 캠페인 시트 데이터에서 기간별 핵심 지표 집계
 */

import { parseSheetDate } from '@/lib/utils/sheet-formatters';
import { parseRoasPercent } from '@/lib/utils/roas';

export type SheetRow = Record<string, unknown>;

export interface CampaignAggregates {
  cost: number;
  install: number;
  revenue: number;
  clicks: number;
  // 재계산 비율 (단순 합산이 아닌 합산 후 재계산)
  cpi: number | null; // cost / install
  roas: number | null; // revenue / cost
  cvr: number | null; // install / clicks
  rowCount: number;
}

export const findDateHeader = (row: SheetRow | undefined): string | null => {
  if (!row) return null;
  for (const k of Object.keys(row)) {
    if (k === '날짜' || k === 'date' || k.toLowerCase() === 'date') return k;
  }
  return null;
};

const sumColumn = (rows: SheetRow[], col: string): number => {
  let total = 0;
  for (const row of rows) {
    const n = parseRoasPercent(row[col]);
    if (n !== null) total += n;
  }
  return total;
};

/**
 * 주어진 시트 행들에서 핵심 지표 집계.
 * rows는 이미 기간 필터링된 상태여야 함.
 */
export function aggregateCampaignMetrics(
  rows: SheetRow[]
): CampaignAggregates {
  const cost = sumColumn(rows, 'Cost');
  const install = sumColumn(rows, 'Install');
  const revenue = sumColumn(rows, 'Revenue');
  const clicks = sumColumn(rows, 'Clicks');

  return {
    cost,
    install,
    revenue,
    clicks,
    cpi: install > 0 ? cost / install : null,
    roas: cost > 0 ? revenue / cost : null,
    cvr: clicks > 0 ? install / clicks : null,
    rowCount: rows.length,
  };
}

/**
 * allData에서 [from, to] 기간만 필터링.
 */
export function filterRowsByDateRange(
  allRows: SheetRow[],
  from: Date | undefined,
  to: Date | undefined,
  dateHeader: string
): SheetRow[] {
  if (!from && !to) return allRows;

  const fromTime = from ? new Date(from).setHours(0, 0, 0, 0) : -Infinity;
  const toTime = to ? new Date(to).setHours(23, 59, 59, 999) : Infinity;

  return allRows.filter((row) => {
    const raw = row[dateHeader];
    const d = parseSheetDate(typeof raw === 'string' ? raw : String(raw ?? ''));
    if (!d) return false;
    const t = d.getTime();
    return t >= fromTime && t <= toTime;
  });
}

/**
 * 두 값의 변화율(%). 기준이 0/null이면 null.
 */
export function deltaPercent(
  current: number | null,
  baseline: number | null
): number | null {
  if (current === null || baseline === null) return null;
  if (baseline === 0) return null;
  return ((current - baseline) / Math.abs(baseline)) * 100;
}
