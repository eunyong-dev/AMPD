'use client';

import * as React from 'react';
import { DailyReportTable } from './daily-report-table';

type MonthlyRow = Record<string, unknown>;

interface MonthlySummaryTableProps {
  rows: MonthlyRow[];
}

/** 월간 집계 — 일간 표와 같은 모양 (묶음 제목·합계 줄·최신 월이 위로) */
export function MonthlySummaryTable({ rows }: MonthlySummaryTableProps) {
  const headers = React.useMemo(() => {
    if (!rows || rows.length === 0) return [];
    return ['Month', ...Object.keys(rows[0]).filter((k) => k !== 'Month')];
  }, [rows]);

  if (!rows || rows.length === 0) {
    return (
      <div className='text-center py-8 text-muted-foreground'>
        No monthly data available.
      </div>
    );
  }

  return (
    <DailyReportTable
      variant='monthly'
      loading={false}
      error={null}
      data={rows}
      headers={headers}
      onRetry={() => {}}
    />
  );
}
