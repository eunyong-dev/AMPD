'use client';

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
import { TableWrapper, TABLE_STYLES } from '@/components/common/table-wrapper';
import {
  formatDateWithWeekday,
  isSunday,
  formatSales,
} from '@/lib/utils/sheet-formatters';
import { isRoasColumn, roasBgStyle } from '@/lib/utils/roas';

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

const isSalesHeader = (h: string) =>
  h === '매출(누적)' ||
  h === '매출' ||
  h.toLowerCase().includes('매출') ||
  h.toLowerCase().includes('sales');

export function DailyReportTable({
  loading,
  error,
  data,
  headers,
  onRetry,
}: DailyReportTableProps) {
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

  if (!data || data.length === 0) {
    return (
      <div className='text-center py-8 text-muted-foreground'>
        No data available.
      </div>
    );
  }

  const dateHeader = headers.find(isDateHeader);

  return (
    <TooltipProvider delayDuration={150}>
    <TableWrapper fillHeight className='max-h-full'>
      <Table style={{ width: 'max-content', minWidth: '100%' }}>
        <TableHeader className={TABLE_STYLES.header}>
          <TableRow>
            {headers.map((header, index) => (
              <TableHead
                key={header}
                className={`whitespace-nowrap ${
                  isDateHeader(header) ? 'sticky left-0 z-30 bg-muted' : ''
                } ${index >= 1 && index <= 4 ? 'text-center' : ''}`}
                style={index === 0 ? { minWidth: '128px' } : undefined}
              >
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className={TABLE_STYLES.body}>
          {data.map((row, rowIndex) => {
            const rowIsSunday = dateHeader ? isSunday(row[dateHeader]) : false;
            return (
              <TableRow
                key={rowIndex}
                className={
                  rowIsSunday
                    ? 'bg-gray-50 dark:bg-gray-900/30 border-b-2 border-gray-300 dark:border-gray-700'
                    : ''
                }
              >
                {headers.map((header, cellIndex) => {
                  const cellValue = row[header];
                  const isDateCol = isDateHeader(header);
                  let cellClassName = 'whitespace-nowrap';
                  if (isDateCol) {
                    cellClassName +=
                      ' sticky left-0 z-10 bg-muted font-medium';
                  }
                  if (cellIndex >= 1 && cellIndex <= 4) {
                    cellClassName += ' text-center';
                  }

                  if (isDateCol) {
                    const formatted = formatDateWithWeekday(cellValue);
                    const dateMatch = formatted.match(/^(.+?)\s+\((.+?)\)$/);
                    if (dateMatch) {
                      const [, datePart, weekdayPart] = dateMatch;
                      return (
                        <TableCell key={cellIndex} className={cellClassName}>
                          <div className='flex items-center gap-2'>
                            <span className='w-24'>{datePart}</span>
                            <span className='text-muted-foreground'>
                              ({weekdayPart})
                            </span>
                          </div>
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell key={cellIndex} className={cellClassName}>
                        {formatted}
                      </TableCell>
                    );
                  }

                  const displayValue = isSalesHeader(header)
                    ? formatSales(cellValue)
                    : cellValue !== null && cellValue !== undefined
                    ? String(cellValue)
                    : '-';

                  const memo = getCellMemo(row, header);

                  return (
                    <TableCell
                      key={header}
                      className={cellClassName}
                      style={
                        isRoasColumn(header) ? roasBgStyle(cellValue) : undefined
                      }
                    >
                      {memo ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {/* 메모 있는 셀 — 우상단 삼각 표시 + 호버 시 메모 */}
                            <span className='relative inline-flex items-center gap-1 cursor-help'>
                              <span>
                                {displayValue === '-' ? '' : displayValue}
                              </span>
                              <span
                                aria-hidden
                                className='h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0'
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
    </TooltipProvider>
  );
}
