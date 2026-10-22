'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TableWrapper } from '@/components/common/table-wrapper';
import { formatSales, parseSheetDate } from '@/lib/utils/sheet-formatters';
import { isRoasColumn, roasBgStyle } from '@/lib/utils/roas';
import { cn } from '@/lib/utils';
import { useCellSelection } from './use-cell-selection';

type SheetRow = Record<string, unknown>;

// 셀에 부착된 메모(hover note) 조회
function getCellMemo(row: SheetRow, header: string): string | null {
  const notes = row._notes as Record<string, string> | undefined;
  if (!notes) return null;
  return notes[header] ?? null;
}

interface DailyReportTableProps {
  loading: boolean;
  error: string | null;
  data: SheetRow[];
  headers: string[];
  onRetry: () => void;
}

const isDateHeader = (h: string) =>
  h === '날짜' || h === 'date' || h.toLowerCase() === 'date';
const isNoteHeader = (h: string) => h === '비고' || h.toLowerCase() === 'note';
const isCohortRevenue = (h: string) => /^d\d+\s*revenue$/i.test(h.trim());
const isCohortRoas = (h: string) => /^d\d+\s*roas$/i.test(h.trim());

const isSalesHeader = (h: string) =>
  h === '매출(누적)' ||
  h === '매출' ||
  h.toLowerCase().includes('매출') ||
  h.toLowerCase().includes('sales');

type Group = 'base' | 'cohortRevenue' | 'cohortRoas' | 'note';
const GROUP_LABEL: Record<Group, string> = {
  base: '기본 지표',
  cohortRevenue: '코호트 매출',
  cohortRoas: '코호트 ROAS',
  note: '',
};
const groupOf = (h: string): Group =>
  isNoteHeader(h)
    ? 'note'
    : isCohortRevenue(h)
    ? 'cohortRevenue'
    : isCohortRoas(h)
    ? 'cohortRoas'
    : 'base';

// "D7 Revenue" → "D7" (그룹 제목에 매출/ROAS 가 있으니 칸 이름은 짧게)
const shortLabel = (h: string) =>
  isCohortRevenue(h) || isCohortRoas(h) ? h.trim().split(/\s+/)[0] : h;

// "$ 1,234.50" / "23.92%" / "12" → 숫자
const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[$,%\s]/g, '');
  if (!s || s === '-') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

const fmtMoney = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`;
const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/** 기간 합계 줄 — 합할 수 있는 값은 합, 비율(CPI·ROAS·CVR)은 합계로 다시 계산 */
function computeTotals(rows: SheetRow[], headers: string[]) {
  const sum = (h: string | undefined) =>
    h ? rows.reduce((acc, r) => acc + (num(r[h]) ?? 0), 0) : 0;
  const find = (re: RegExp) => headers.find((h) => re.test(h.trim()));
  const installH = find(/^install(s)?$/i);
  const costH = find(/^cost$/i);
  const revenueH = find(/^revenue$/i);
  const clicksH = find(/^clicks?$/i);
  const install = sum(installH);
  const cost = sum(costH);
  const revenue = sum(revenueH);
  const clicks = sum(clicksH);

  const out: Record<string, string> = {};
  for (const h of headers) {
    const t = h.trim();
    if (isDateHeader(h) || isNoteHeader(h)) continue;
    if (/^install(s)?$/i.test(t)) out[h] = fmtInt(install);
    else if (/^clicks?$/i.test(t)) out[h] = fmtInt(clicks);
    else if (/^cost$/i.test(t)) out[h] = fmtMoney(cost);
    else if (/^revenue$/i.test(t)) out[h] = fmtMoney(revenue);
    else if (/^cpi$/i.test(t)) out[h] = install ? fmtMoney(cost / install) : '-';
    else if (/^roas$/i.test(t)) out[h] = cost ? fmtPct(revenue / cost) : '-';
    else if (/^cvr$/i.test(t)) out[h] = clicks ? fmtPct(install / clicks) : '-';
    else if (isCohortRevenue(h)) out[h] = fmtMoney(sum(h));
    else if (isCohortRoas(h)) {
      const revH = headers.find(
        (x) => isCohortRevenue(x) && shortLabel(x) === shortLabel(h)
      );
      out[h] = revH && cost ? fmtPct(sum(revH) / cost) : '-';
    }
  }
  return out;
}

export function DailyReportTable({
  loading,
  error,
  data,
  headers,
  onRetry,
}: DailyReportTableProps) {
  // 칸 순서: 날짜 · 기본 지표 · 코호트 매출 · 코호트 ROAS · 비고(맨 끝)
  const cols = React.useMemo(() => {
    const order: Group[] = ['base', 'cohortRevenue', 'cohortRoas', 'note'];
    const dateH = headers.filter(isDateHeader);
    const rest = headers.filter((h) => !isDateHeader(h));
    return [
      ...dateH,
      ...order.flatMap((g) => rest.filter((h) => groupOf(h) === g)),
    ];
  }, [headers]);

  const dateHeader = cols.find(isDateHeader);

  // 최신 날짜가 위로
  const rows = React.useMemo(() => [...data].reverse(), [data]);
  const totals = React.useMemo(() => computeTotals(rows, cols), [rows, cols]);

  // 주(월~일) 단위로 배경을 번갈아 — 한 주가 한 덩어리로 보이게
  const shadedWeek = React.useMemo(() => {
    const dh = cols.find(isDateHeader);
    let shade = false;
    let prevKey: number | null = null;
    return rows.map((r) => {
      const d = dh ? parseSheetDate(r[dh] as string) : null;
      if (!d) return shade;
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = monday.getTime();
      if (prevKey !== null && key !== prevKey) shade = !shade;
      prevKey = key;
      return shade;
    });
  }, [rows, cols]);

  const { containerRef, dragging, cellProps, selectionStyle, chip } =
    useCellSelection(rows, cols);

  if (loading) {
    return (
      <div className='space-y-2'>
        <Skeleton className='h-10 w-full' />
        <Skeleton className='h-10 w-full' />
        <Skeleton className='h-10 w-full' />
      </div>
    );
  }

  if (error) {
    return (
      <div className='text-center py-8'>
        <p className='text-destructive mb-2'>{error}</p>
        <Button variant='outline' onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className='text-center py-8 text-muted-foreground'>
        No data available.
      </div>
    );
  }

  // 그룹 제목 줄: 연속된 같은 그룹을 colSpan 으로 묶음
  const groupSpans: { group: Group | 'date'; span: number }[] = [];
  for (const h of cols) {
    const g = isDateHeader(h) ? 'date' : groupOf(h);
    const last = groupSpans[groupSpans.length - 1];
    if (last && last.group === g) last.span++;
    else groupSpans.push({ group: g, span: 1 });
  }
  // 그룹이 시작하는 칸 (왼쪽 구분선)
  const groupStart = new Set<number>();
  {
    let i = 0;
    for (const g of groupSpans) {
      if (i > 0) groupStart.add(i);
      i += g.span;
    }
  }

  const stickyDate = 'sticky left-0 z-20';

  return (
    <TooltipProvider delayDuration={150}>
      <div ref={containerRef} className='relative h-full min-h-0'>
        <TableWrapper fillHeight className='max-h-full h-full'>
          <Table
            style={{ width: 'max-content', minWidth: '100%' }}
            className={cn(
              'text-xs tabular-nums [&_td]:cursor-default [&_th]:cursor-default',
              dragging && 'select-none'
            )}
          >
            <TableHeader className='sticky top-0 z-30 bg-muted [&_tr]:border-b'>
              {/* 그룹 제목 */}
              <TableRow className='hover:bg-transparent'>
                {groupSpans.map((g, i) => (
                  <TableHead
                    key={i}
                    colSpan={g.span}
                    className={cn(
                      'h-6 bg-muted px-2 py-0 text-center text-[11px] font-medium',
                      g.group === 'cohortRevenue' || g.group === 'cohortRoas'
                        ? 'text-primary'
                        : 'text-muted-foreground',
                      i > 0 && 'border-l',
                      g.group === 'date' && cn(stickyDate, 'bg-muted')
                    )}
                  >
                    {g.group === 'date' ? '' : GROUP_LABEL[g.group]}
                  </TableHead>
                ))}
              </TableRow>
              {/* 칸 이름 */}
              <TableRow className='hover:bg-transparent'>
                {cols.map((h, i) => (
                  <TableHead
                    key={h}
                    className={cn(
                      'h-8 whitespace-nowrap bg-muted px-3 py-0 text-xs',
                      isDateHeader(h)
                        ? cn(stickyDate, 'bg-muted text-left')
                        : 'text-right',
                      groupStart.has(i) && 'border-l'
                    )}
                    style={isDateHeader(h) ? { width: '1px' } : undefined}
                  >
                    {isDateHeader(h) ? 'Date' : shortLabel(h)}
                  </TableHead>
                ))}
              </TableRow>
              {/* 기간 합계 */}
              <TableRow className='border-b-2 hover:bg-transparent'>
                {cols.map((h, i) => (
                  <TableHead
                    key={h}
                    className={cn(
                      'h-8 whitespace-nowrap bg-blue-50 px-3 py-0 text-xs font-semibold text-foreground dark:bg-slate-800',
                      isDateHeader(h) ? cn(stickyDate, 'text-left') : 'text-right',
                      groupStart.has(i) && 'border-l'
                    )}
                  >
                    {isDateHeader(h) ? '합계' : totals[h] ?? ''}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, rowIndex) => {
                const date = dateHeader ? parseSheetDate(row[dateHeader] as string) : null;
                const day = date ? date.getDay() : null;
                // 최신순이라 월요일 줄 아래가 주 경계
                const weekEnd = day === 1;
                return (
                  <TableRow
                    key={rowIndex}
                    className={cn(
                      shadedWeek[rowIndex]
                        ? 'bg-muted/50 hover:bg-muted/70'
                        : 'bg-background hover:bg-muted/30',
                      weekEnd && 'border-b-2 border-border'
                    )}
                  >
                    {cols.map((header, cellIndex) => {
                      const cellValue = row[header];
                      const isDateCol = isDateHeader(header);
                      const overlay = selectionStyle(rowIndex, cellIndex);
                      const baseStyle =
                        !isDateCol && isRoasColumn(header)
                          ? roasBgStyle(cellValue)
                          : undefined;
                      const cellStyle: React.CSSProperties | undefined =
                        baseStyle || overlay || isDateCol
                          ? {
                              ...baseStyle,
                              ...overlay,
                              ...(isDateCol ? { width: '1px' } : {}),
                            }
                          : undefined;
                      const cls = cn(
                        'whitespace-nowrap px-3 py-1.5',
                        isDateCol
                          ? cn(
                              stickyDate,
                              'z-10 font-medium',
                              shadedWeek[rowIndex] ? 'bg-muted' : 'bg-background'
                            )
                          : 'text-right',
                        groupStart.has(cellIndex) && 'border-l'
                      );

                      // ── 날짜 ──
                      if (isDateCol) {
                        return (
                          <TableCell
                            key={cellIndex}
                            className={cls}
                            style={cellStyle}
                            {...cellProps(rowIndex, cellIndex)}
                          >
                            {date ? (
                              <span className='flex items-center gap-1.5'>
                                <span>
                                  {`${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`}
                                </span>
                                <span
                                  className={cn(
                                    'text-[10px]',
                                    day === 0
                                      ? 'text-red-500'
                                      : day === 6
                                      ? 'text-blue-500'
                                      : 'text-muted-foreground'
                                  )}
                                >
                                  {WEEKDAY[day ?? 0]}
                                </span>
                              </span>
                            ) : (
                              String(cellValue ?? '')
                            )}
                          </TableCell>
                        );
                      }

                      // ── 값 ──
                      const displayValue = isSalesHeader(header)
                        ? formatSales(cellValue)
                        : cellValue !== null &&
                          cellValue !== undefined &&
                          cellValue !== ''
                        ? String(cellValue).replace(/^\$\s+/, '$')
                        : '';
                      const memo = getCellMemo(row, header);

                      return (
                        <TableCell
                          key={header}
                          className={cn(cls, isNoteHeader(header) && 'text-left')}
                          style={cellStyle}
                          {...cellProps(rowIndex, cellIndex)}
                        >
                          {memo ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className='relative inline-flex items-center gap-1'>
                                  <span>{displayValue}</span>
                                  <span
                                    aria-hidden
                                    className='h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500'
                                  />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side='top'
                                className='max-w-xs whitespace-pre-wrap text-left'
                              >
                                {memo}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            displayValue
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableWrapper>

        {chip}
      </div>
    </TooltipProvider>
  );
}
