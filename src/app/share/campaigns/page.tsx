'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableWrapper, TABLE_STYLES } from '@/components/common/table-wrapper';
import { Skeleton } from '@/components/ui/skeleton';

interface PublicCampaign {
  id: string;
  name: string;
  region: string | null;
  mmp: string | null;
  campaign_type: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  game: { game_name: string | null; logo_url: string | null } | null;
  account: { company: string | null } | null;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  planning: {
    label: '계획',
    cls: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/30 dark:border-amber-900',
  },
  ongoing: {
    label: '진행중',
    cls: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-900',
  },
  holding: {
    label: '홀딩',
    cls: 'text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/30 dark:border-red-900',
  },
  end: {
    label: '종료',
    cls: 'text-muted-foreground bg-muted border-border',
  },
};

const REGION_FLAG: Record<string, string> = {
  KR: '🇰🇷',
  JP: '🇯🇵',
  TW: '🇹🇼',
  US: '🇺🇸',
};

const STATUS_ORDER = ['ongoing', 'planning', 'holding', 'end'];

function StatusBadge({ status }: { status: string | null }) {
  const s = STATUS[status ?? ''] ?? {
    label: status ?? '-',
    cls: 'text-muted-foreground bg-muted border-border',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${s.cls}`}
    >
      <span className='h-1.5 w-1.5 rounded-full bg-current opacity-70' />
      {s.label}
    </span>
  );
}

const fmtPeriod = (from: string | null, to: string | null) =>
  from ? `${from} ~ ${to ?? ''}` : '-';

export default function PublicCampaignsPage() {
  const [rows, setRows] = useState<PublicCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('campaigns')
          .select(
            'id, name, region, mmp, campaign_type, status, start_date, end_date, game:games(game_name, logo_url), account:accounts(company)'
          );
        if (error) throw error;
        setRows((data ?? []) as unknown as PublicCampaign[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : '캠페인을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const c = (a.account?.company ?? '').localeCompare(
          b.account?.company ?? ''
        );
        if (c !== 0) return c;
        return (a.name ?? '').localeCompare(b.name ?? '');
      }),
    [rows]
  );

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows) {
      const k = r.status ?? '';
      m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  }, [rows]);

  return (
    <div className='min-h-screen bg-background'>
      <div className='mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6'>
        <header className='mb-6'>
          <div className='flex flex-wrap items-end justify-between gap-3'>
            <div>
              <h1 className='text-2xl font-bold text-foreground'>
                캠페인 현황
              </h1>
              <p className='mt-1 text-sm text-muted-foreground'>
                GNA Company · 총{' '}
                <span className='font-semibold text-foreground'>
                  {rows.length}
                </span>
                개 캠페인
              </p>
            </div>
            {/* 상태 요약 */}
            <div className='flex flex-wrap items-center gap-2'>
              {STATUS_ORDER.filter((k) => counts[k]).map((k) => (
                <span
                  key={k}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS[k].cls}`}
                >
                  {STATUS[k].label}
                  <span className='font-bold tabular-nums'>{counts[k]}</span>
                </span>
              ))}
            </div>
          </div>
        </header>

        {loading ? (
          <div className='space-y-2'>
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
          </div>
        ) : error ? (
          <div className='rounded-xl border py-12 text-center text-sm text-destructive'>
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className='rounded-xl border py-12 text-center text-sm text-muted-foreground'>
            표시할 캠페인이 없습니다.
          </div>
        ) : (
          <TableWrapper>
            <Table style={{ width: '100%' }}>
              <TableHeader className={TABLE_STYLES.header}>
                <TableRow>
                  <TableHead className='whitespace-nowrap'>광고주</TableHead>
                  <TableHead className='whitespace-nowrap'>게임</TableHead>
                  <TableHead className='whitespace-nowrap'>지역</TableHead>
                  <TableHead className='whitespace-nowrap'>MMP</TableHead>
                  <TableHead className='whitespace-nowrap'>타입</TableHead>
                  <TableHead className='whitespace-nowrap tabular-nums'>
                    기간
                  </TableHead>
                  <TableHead className='whitespace-nowrap'>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={TABLE_STYLES.body}>
                {sorted.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className='whitespace-nowrap font-medium'>
                      {r.account?.company ?? '-'}
                    </TableCell>
                    <TableCell className='whitespace-nowrap'>
                      <span className='inline-flex items-center gap-2 align-middle'>
                        {r.game?.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.game.logo_url}
                            alt=''
                            className='h-6 w-6 flex-shrink-0 rounded border border-border object-cover'
                          />
                        ) : (
                          <span className='h-6 w-6 flex-shrink-0 rounded border border-border bg-muted' />
                        )}
                        {r.game?.game_name ?? r.name}
                      </span>
                    </TableCell>
                    <TableCell className='whitespace-nowrap'>
                      {REGION_FLAG[r.region ?? ''] ?? ''}{' '}
                      {r.region ?? '-'}
                    </TableCell>
                    <TableCell className='whitespace-nowrap'>
                      {r.mmp ?? '-'}
                    </TableCell>
                    <TableCell className='whitespace-nowrap'>
                      {r.campaign_type ?? '-'}
                    </TableCell>
                    <TableCell className='whitespace-nowrap tabular-nums text-muted-foreground'>
                      {fmtPeriod(r.start_date, r.end_date)}
                    </TableCell>
                    <TableCell className='whitespace-nowrap'>
                      <StatusBadge status={r.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        )}

        <p className='mt-6 text-center text-xs text-muted-foreground'>
          이 페이지는 공유용 열람 페이지입니다.
        </p>
      </div>
    </div>
  );
}
