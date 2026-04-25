'use client';

import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  TableWrapper,
  TABLE_STYLES,
} from '@/components/common/table-wrapper';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { accountUrl } from '@/lib/utils/account-url';
import type { SettlementWithDetail } from '@/hooks/use-settlement-management';

interface SettlementsTableProps {
  settlements: SettlementWithDetail[];
  /** raw 회사명 — 내부에서 URL 인코딩 처리 */
  accountCompany: string;
  loading?: boolean;
}

const formatPeriod = (from: string, to: string) => `${from} ~ ${to}`;

const formatAmount = (n: number) =>
  `$ ${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatCreated = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR');
  } catch {
    return iso;
  }
};

export function SettlementsTable({
  settlements,
  accountCompany,
  loading,
}: SettlementsTableProps) {
  const accountBase = accountUrl(accountCompany);
  if (loading) {
    return (
      <div className='space-y-2'>
        <Skeleton className='h-10 w-full' />
        <Skeleton className='h-10 w-full' />
        <Skeleton className='h-10 w-full' />
      </div>
    );
  }

  if (settlements.length === 0) {
    return (
      <div className='border rounded-xl py-12 text-center text-sm text-muted-foreground'>
        No settlements yet.
      </div>
    );
  }

  return (
    <TableWrapper>
      <Table style={{ width: 'max-content', minWidth: '100%' }}>
        <TableHeader className={TABLE_STYLES.header}>
          <TableRow>
            <TableHead className='whitespace-nowrap' style={{ minWidth: 200 }}>
              Title
            </TableHead>
            <TableHead className='whitespace-nowrap' style={{ minWidth: 200 }}>
              Period
            </TableHead>
            <TableHead className='whitespace-nowrap'>Campaigns</TableHead>
            <TableHead className='whitespace-nowrap text-right'>
              Total
            </TableHead>
            <TableHead className='whitespace-nowrap'>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className={TABLE_STYLES.body}>
          {settlements.map((s) => (
            <TableRow
              key={s.id}
              className='cursor-pointer hover:bg-muted/50'
              onClick={() => {
                window.location.href = `${accountBase}/settlements/${s.id}`;
              }}
            >
              <TableCell className='whitespace-nowrap font-medium'>
                <Link
                  href={`${accountBase}/settlements/${s.id}`}
                  className='hover:underline'
                  onClick={(e) => e.stopPropagation()}
                >
                  {s.title}
                </Link>
              </TableCell>
              <TableCell className='whitespace-nowrap tabular-nums text-muted-foreground'>
                {formatPeriod(s.period_from, s.period_to)}
              </TableCell>
              <TableCell>
                <div className='flex flex-wrap gap-1.5'>
                  {s.campaigns.length === 0 ? (
                    <span className='text-sm text-muted-foreground'>—</span>
                  ) : (
                    s.campaigns.map((c) => (
                      <Badge
                        key={c.id}
                        variant='outline'
                        className='font-normal'
                      >
                        {c.name}
                      </Badge>
                    ))
                  )}
                </div>
              </TableCell>
              <TableCell className='whitespace-nowrap text-right tabular-nums font-medium'>
                {formatAmount(Number(s.total_amount))}
              </TableCell>
              <TableCell className='whitespace-nowrap text-sm text-muted-foreground'>
                {formatCreated(s.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableWrapper>
  );
}
