'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableWrapper, TABLE_STYLES } from '@/components/common/table-wrapper';
import { isRoasColumn, roasBgStyle } from '@/lib/utils/roas';

type MonthlyRow = Record<string, unknown>;

interface MonthlySummaryTableProps {
  rows: MonthlyRow[];
}

export function MonthlySummaryTable({ rows }: MonthlySummaryTableProps) {
  if (!rows || rows.length === 0) {
    return (
      <div className='text-center py-8 text-muted-foreground'>
        No monthly data available.
      </div>
    );
  }

  const cols = Object.keys(rows[0]).filter((k) => k !== 'Month');

  return (
    <TableWrapper fillHeight className='max-h-full'>
      <Table style={{ width: 'max-content', minWidth: '100%' }}>
        <TableHeader className={TABLE_STYLES.header}>
          <TableRow>
            <TableHead
              className='whitespace-nowrap'
              style={{ minWidth: '128px' }}
            >
              Month
            </TableHead>
            {cols.map((h, idx) => (
              <TableHead
                key={h}
                className={`whitespace-nowrap ${
                  idx >= 0 && idx <= 3 ? 'text-center' : ''
                }`}
              >
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className={TABLE_STYLES.body}>
          {rows.map((row, idx) => (
            <TableRow key={(row.Month as string | undefined) ?? idx}>
              <TableCell className='whitespace-nowrap font-medium'>
                {row.Month as React.ReactNode}
              </TableCell>
              {cols.map((col, idx) => (
                <TableCell
                  key={col}
                  className={`whitespace-nowrap ${
                    idx >= 0 && idx <= 3 ? 'text-center' : ''
                  }`}
                  style={
                    isRoasColumn(col) ? roasBgStyle(row[col]) : undefined
                  }
                >
                  {row[col] as React.ReactNode}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableWrapper>
  );
}
