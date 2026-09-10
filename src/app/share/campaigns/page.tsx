'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
import {
  FilterTabs,
  type FilterTabOption,
} from '@/components/common/filter-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { MmpIcon } from '@/components/common/mmp-icon';
import {
  GameCell,
  StatusBadge,
  STATUS,
  REGION_FLAG,
  fmtPeriod,
  PUBLIC_CAMPAIGN_SELECT,
  type PublicCampaign,
} from '@/components/share/share-campaign-ui';

type StatusTab = 'all' | 'planning' | 'ongoing' | 'holding' | 'end';

// 내부 캠페인 페이지와 동일한 탭 순서
const TAB_ORDER: StatusTab[] = ['all', 'planning', 'ongoing', 'holding', 'end'];

const isStatusTab = (v: string | null): v is StatusTab =>
  !!v && (TAB_ORDER as string[]).includes(v);

export default function PublicCampaignsPage() {
  const [rows, setRows] = useState<PublicCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<StatusTab>('all');

  // 공유 링크의 ?status= 로 초기 탭 복원 (useSearchParams 대신 window 사용 → Suspense 불필요)
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('status');
    if (isStatusTab(s)) setTab(s);
  }, []);

  const changeTab = (next: StatusTab) => {
    setTab(next);
    // 현재 탭을 URL 에 반영 → 그 상태 그대로 링크 공유 가능 (히스토리 누적 없이 교체)
    const url = new URL(window.location.href);
    if (next === 'all') url.searchParams.delete('status');
    else url.searchParams.set('status', next);
    window.history.replaceState(null, '', url.pathname + url.search);
  };

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('campaigns')
          .select(PUBLIC_CAMPAIGN_SELECT);
        if (error) throw error;
        setRows((data ?? []) as unknown as PublicCampaign[]);
      } catch (e) {
        console.error('[share] 캠페인 목록 조회 실패:', e);
        setError('캠페인을 불러오지 못했습니다.');
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

  const filtered = useMemo(
    () => (tab === 'all' ? sorted : sorted.filter((r) => r.status === tab)),
    [sorted, tab]
  );

  // 탭 옵션 (개수 표시) — 0건이어도 5개 탭 모두 항상 표시 (내부 캠페인 페이지와 동일)
  const tabOptions: FilterTabOption<StatusTab>[] = TAB_ORDER.map((k) => {
    const name = k === 'all' ? '전체' : STATUS[k].label;
    const n = k === 'all' ? rows.length : counts[k] ?? 0;
    // 로딩 중엔 개수 생략 → "0" 깜빡임 방지
    return { value: k, label: loading ? name : `${name} ${n}` };
  });

  return (
    <div className='min-h-screen bg-background'>
      <div className='mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6'>
        <header className='mb-6'>
          <h1 className='text-2xl font-bold text-foreground'>캠페인 현황</h1>
          <p className='mt-1 text-sm text-muted-foreground'>
            Moon · 총{' '}
            <span className='font-semibold text-foreground'>{rows.length}</span>
            개 캠페인
          </p>
        </header>

        {/* 상태 탭 */}
        <div className='mb-4 overflow-x-auto py-1'>
          <FilterTabs<StatusTab>
            value={tab}
            onValueChange={changeTab}
            options={tabOptions}
          />
        </div>

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
        ) : filtered.length === 0 ? (
          <div className='rounded-xl border py-12 text-center text-sm text-muted-foreground'>
            {rows.length === 0
              ? '표시할 캠페인이 없습니다.'
              : '해당 상태의 캠페인이 없습니다.'}
          </div>
        ) : (
          <TableWrapper>
            <Table style={{ width: '100%' }}>
              <TableHeader className={TABLE_STYLES.header}>
                <TableRow>
                  <TableHead className='whitespace-nowrap'>캠페인</TableHead>
                  <TableHead className='whitespace-nowrap'>광고주</TableHead>
                  <TableHead className='whitespace-nowrap'>게임</TableHead>
                  <TableHead className='whitespace-nowrap'>지역</TableHead>
                  <TableHead className='whitespace-nowrap text-center'>
                    MMP
                  </TableHead>
                  <TableHead className='whitespace-nowrap'>타입</TableHead>
                  <TableHead className='whitespace-nowrap tabular-nums'>
                    기간
                  </TableHead>
                  <TableHead className='whitespace-nowrap'>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={TABLE_STYLES.body}>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className='whitespace-nowrap'>
                      <Link
                        href={`/share/campaigns/${r.id}`}
                        className='font-medium text-foreground transition-colors hover:text-primary hover:underline'
                      >
                        {r.name}
                      </Link>
                    </TableCell>
                    <TableCell className='whitespace-nowrap'>
                      {r.account?.company ?? '-'}
                    </TableCell>
                    <TableCell className='max-w-[260px] whitespace-nowrap'>
                      <GameCell game={r.game} fallbackName={r.name} />
                    </TableCell>
                    <TableCell className='whitespace-nowrap'>
                      {REGION_FLAG[r.region ?? ''] ?? ''} {r.region ?? '-'}
                    </TableCell>
                    <TableCell className='whitespace-nowrap text-center'>
                      <MmpIcon mmp={r.mmp} />
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
          이 페이지는 공유용 열람 페이지입니다. 캠페인명을 누르면 성과를 볼 수
          있습니다.
        </p>
      </div>
    </div>
  );
}
