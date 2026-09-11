'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownIcon,
  ArrowDownUpIcon,
  ArrowUpIcon,
  Building2Icon,
  ChevronDownIcon,
  GlobeIcon,
  XIcon,
} from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MmpIcon } from '@/components/common/mmp-icon';
import {
  GameCell,
  StatusBadge,
  STATUS,
  REGION_FLAG,
  fmtPeriod,
  PUBLIC_CAMPAIGN_DETAIL_SELECT,
  rememberShareListQuery,
  type PublicCampaign,
  type PublicCampaignDetail,
} from '@/components/share/share-campaign-ui';
import { ReportSheetBadge } from '@/components/common/report-sheet-badge';

type StatusTab = 'all' | 'planning' | 'ongoing' | 'holding' | 'end';
type SortKey = 'advertiser' | 'latest' | 'oldest';

// 내부 캠페인 페이지와 동일한 탭 순서
const TAB_ORDER: StatusTab[] = ['all', 'planning', 'ongoing', 'holding', 'end'];
// 기본 탭: 진행중 — URL 에 status 가 없으면 진행중, 전체는 ?status=all
const DEFAULT_TAB: StatusTab = 'ongoing';
const REGION_ORDER = ['KR', 'JP', 'TW', 'US'];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'advertiser', label: '광고주순' },
  { value: 'latest', label: '시작일 최신순' },
  { value: 'oldest', label: '시작일 오래된순' },
];

const isStatusTab = (v: string | null): v is StatusTab =>
  !!v && (TAB_ORDER as string[]).includes(v);

const isSortKey = (v: string | null): v is SortKey =>
  !!v && SORT_OPTIONS.some((o) => o.value === v);

const companyOf = (r: PublicCampaign) => r.account?.company ?? '';

// 기본 정렬: 광고주 → 캠페인명
const byAdvertiser = (a: PublicCampaign, b: PublicCampaign) =>
  companyOf(a).localeCompare(companyOf(b)) ||
  (a.name ?? '').localeCompare(b.name ?? '');

// 시작일 비교 (dir 1: 오래된순, -1: 최신순). 시작일 없는 캠페인은 항상 뒤로
const byStartDate = (a: PublicCampaign, b: PublicCampaign, dir: 1 | -1) => {
  const x = a.start_date;
  const y = b.start_date;
  if (x === y) return 0;
  if (!x) return 1;
  if (!y) return -1;
  return dir * x.localeCompare(y);
};

// 지역 정렬: KR → JP → TW → US → 그 외 알파벳순
const byRegion = (a: string, b: string) => {
  const ia = REGION_ORDER.indexOf(a);
  const ib = REGION_ORDER.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
};

const countBy = (
  items: PublicCampaign[],
  key: (r: PublicCampaign) => string
) => {
  const m: Record<string, number> = {};
  for (const r of items) {
    const k = key(r);
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
};

const toggleIn = (list: string[], v: string) =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

// 다중 선택 체크박스 (내부 캠페인 페이지 필터와 동일한 스타일). 클릭은 메뉴 항목이 처리
const CHECK_CLS =
  'pointer-events-none data-[state=checked]:bg-black data-[state=checked]:border-black';

export default function PublicCampaignsPage() {
  const [rows, setRows] = useState<PublicCampaignDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<StatusTab>(DEFAULT_TAB);
  const [advertisers, setAdvertisers] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>('advertiser');
  const [urlReady, setUrlReady] = useState(false);

  // 공유 링크의 쿼리로 필터 복원 (useSearchParams 대신 window 사용 → Suspense 불필요)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get('status');
    if (isStatusTab(s)) setTab(s);
    setAdvertisers(p.getAll('advertiser').filter(Boolean));
    setRegions(p.getAll('region').filter(Boolean));
    const so = p.get('sort');
    if (isSortKey(so)) setSort(so);
    setUrlReady(true);
  }, []);

  // 현재 필터를 URL 에 반영 → 그 상태 그대로 링크 공유 가능 (히스토리 누적 없이 교체)
  useEffect(() => {
    if (!urlReady) return;
    const url = new URL(window.location.href);
    const p = url.searchParams;
    ['status', 'advertiser', 'region', 'sort'].forEach((k) => p.delete(k));
    if (tab !== DEFAULT_TAB) p.set('status', tab);
    advertisers.forEach((a) => p.append('advertiser', a));
    regions.forEach((r) => p.append('region', r));
    if (sort !== 'advertiser') p.set('sort', sort);
    window.history.replaceState(null, '', url.pathname + url.search);
    // 성과 뷰어의 "← 캠페인 현황" 이 같은 필터로 돌아오도록 기억
    rememberShareListQuery(url.search);
  }, [urlReady, tab, advertisers, regions, sort]);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('campaigns')
          .select(PUBLIC_CAMPAIGN_DETAIL_SELECT); // 시트 연결 여부(아이콘)까지
        if (error) throw error;
        setRows((data ?? []) as unknown as PublicCampaignDetail[]);
      } catch (e) {
        console.error('[share] 캠페인 목록 조회 실패:', e);
        setError('캠페인을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 링크에 남아 있던, 지금은 없는 광고주/지역은 로드 후 정리 (0건 필터에 갇히지 않게)
  useEffect(() => {
    if (loading || rows.length === 0) return;
    const companies = new Set(rows.map(companyOf));
    const regionSet = new Set(rows.map((r) => r.region ?? ''));
    setAdvertisers((prev) => {
      const next = prev.filter((a) => companies.has(a));
      return next.length === prev.length ? prev : next;
    });
    setRegions((prev) => {
      const next = prev.filter((r) => regionSet.has(r));
      return next.length === prev.length ? prev : next;
    });
  }, [loading, rows]);

  // 필터 결과 + 개수. 각 개수는 "자기 자신을 뺀 나머지 필터" 기준 → 선택하면 그 숫자만큼 나옴
  const view = useMemo(() => {
    const byTab = (r: PublicCampaign) => tab === 'all' || r.status === tab;
    const byAdv = (r: PublicCampaign) =>
      advertisers.length === 0 || advertisers.includes(companyOf(r));
    const byReg = (r: PublicCampaign) =>
      regions.length === 0 || regions.includes(r.region ?? '');

    const inFilters = rows.filter((r) => byAdv(r) && byReg(r));
    const list = inFilters
      .filter(byTab)
      .sort((a, b) =>
        sort === 'advertiser'
          ? byAdvertiser(a, b)
          : byStartDate(a, b, sort === 'latest' ? -1 : 1) || byAdvertiser(a, b)
      );

    return {
      list,
      total: inFilters.length,
      statusCounts: countBy(inFilters, (r) => r.status ?? ''),
      advertiserCounts: countBy(
        rows.filter((r) => byTab(r) && byReg(r)),
        companyOf
      ),
      regionCounts: countBy(
        rows.filter((r) => byTab(r) && byAdv(r)),
        (r) => r.region ?? ''
      ),
    };
  }, [rows, tab, advertisers, regions, sort]);

  const advertiserOptions = useMemo(
    () =>
      [...new Set(rows.map(companyOf).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [rows]
  );

  const regionOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => r.region ?? '').filter(Boolean))].sort(
        byRegion
      ),
    [rows]
  );

  // 탭 옵션 (개수 표시) — 0건이어도 5개 탭 모두 항상 표시 (내부 캠페인 페이지와 동일)
  const tabOptions: FilterTabOption<StatusTab>[] = TAB_ORDER.map((k) => {
    const name = k === 'all' ? '전체' : STATUS[k].label;
    const n = k === 'all' ? view.total : view.statusCounts[k] ?? 0;
    return { value: k, label: `${name} ${n}` };
  });

  const filtersActive = advertisers.length > 0 || regions.length > 0;
  const resetFilters = () => {
    setAdvertisers([]);
    setRegions([]);
  };

  const advertiserLabel =
    advertisers.length === 0
      ? '전체 광고주'
      : advertisers.length === 1
      ? advertisers[0]
      : `광고주 ${advertisers.length}곳`;
  const regionLabel =
    regions.length === 0 ? '전체 지역' : [...regions].sort(byRegion).join(' · ');
  const sortLabel =
    SORT_OPTIONS.find((o) => o.value === sort)?.label ?? '광고주순';

  return (
    <div className='min-h-screen bg-background'>
      <div className='mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6'>
        <header className='mb-6'>
          <h1 className='text-2xl font-bold text-foreground'>캠페인 현황</h1>
          {loading ? (
            <Skeleton className='mt-1 h-5 w-40' />
          ) : (
            <p className='mt-1 text-sm text-muted-foreground'>
              Moon · 총{' '}
              <span className='font-semibold text-foreground'>{rows.length}</span>
              개 캠페인
            </p>
          )}
        </header>

        {/* 상태 탭 + 필터 — 처음 불러오는 동안은 스켈레톤 (개수·필터 항목이 아직 없음) */}
        {loading ? (
          <div className='mb-4 flex flex-wrap items-center justify-between gap-2 py-1'>
            <Skeleton className='h-9 w-[360px] max-w-full rounded-xl' />
            <div className='flex flex-wrap items-center gap-2'>
              <Skeleton className='h-9 w-[138px] rounded-xl' />
              <Skeleton className='h-9 w-[126px] rounded-xl' />
              <Skeleton className='h-9 w-[122px] rounded-xl' />
            </div>
          </div>
        ) : (
        <div className='mb-4 flex flex-wrap items-center justify-between gap-2 py-1'>
          <div className='max-w-full overflow-x-auto'>
            <FilterTabs<StatusTab>
              value={tab}
              onValueChange={setTab}
              options={tabOptions}
            />
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            {filtersActive && (
              <Button
                variant='ghost'
                size='sm'
                onClick={resetFilters}
                className='text-muted-foreground'
              >
                <XIcon className='h-4 w-4' />
                필터 초기화
              </Button>
            )}

            {/* 광고주 (다중 선택) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='outline'
                  size='sm'
                  className='max-w-[220px]'
                >
                  <Building2Icon className='h-4 w-4' />
                  <span className='truncate'>{advertiserLabel}</span>
                  <ChevronDownIcon className='h-4 w-4 opacity-50' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-[240px]'>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setAdvertisers([]);
                  }}
                  className='flex items-center gap-2'
                >
                  <Checkbox
                    checked={advertisers.length === 0}
                    tabIndex={-1}
                    aria-hidden
                    className={CHECK_CLS}
                  />
                  <span>전체 광고주</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className='max-h-[320px] overflow-y-auto'>
                  {advertiserOptions.map((name) => (
                    <DropdownMenuItem
                      key={name}
                      onSelect={(e) => {
                        e.preventDefault();
                        setAdvertisers((prev) => toggleIn(prev, name));
                      }}
                      className='flex items-center gap-2'
                    >
                      <Checkbox
                        checked={advertisers.includes(name)}
                        tabIndex={-1}
                        aria-hidden
                        className={CHECK_CLS}
                      />
                      <span className='min-w-0 flex-1 truncate text-xs'>
                        {name}
                      </span>
                      <span className='text-xs tabular-nums text-muted-foreground'>
                        {view.advertiserCounts[name] ?? 0}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 지역 (다중 선택) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='outline' size='sm'>
                  <GlobeIcon className='h-4 w-4' />
                  <span>{regionLabel}</span>
                  <ChevronDownIcon className='h-4 w-4 opacity-50' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-[180px]'>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setRegions([]);
                  }}
                  className='flex items-center gap-2'
                >
                  <Checkbox
                    checked={regions.length === 0}
                    tabIndex={-1}
                    aria-hidden
                    className={CHECK_CLS}
                  />
                  <span>전체 지역</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {regionOptions.map((code) => (
                  <DropdownMenuItem
                    key={code}
                    onSelect={(e) => {
                      e.preventDefault();
                      setRegions((prev) => toggleIn(prev, code));
                    }}
                    className='flex items-center gap-2'
                  >
                    <Checkbox
                      checked={regions.includes(code)}
                      tabIndex={-1}
                      aria-hidden
                      className={CHECK_CLS}
                    />
                    <span className='flex-1 text-xs'>
                      {REGION_FLAG[code] ?? ''} {code}
                    </span>
                    <span className='text-xs tabular-nums text-muted-foreground'>
                      {view.regionCounts[code] ?? 0}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 정렬 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='outline' size='sm'>
                  <ArrowDownUpIcon className='h-4 w-4' />
                  <span>{sortLabel}</span>
                  <ChevronDownIcon className='h-4 w-4 opacity-50' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-[180px]'>
                <DropdownMenuRadioGroup
                  value={sort}
                  onValueChange={(v) => setSort(v as SortKey)}
                >
                  {SORT_OPTIONS.map((o) => (
                    <DropdownMenuRadioItem key={o.value} value={o.value}>
                      {o.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        )}

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
        ) : view.list.length === 0 ? (
          <div className='flex flex-col items-center gap-3 rounded-xl border py-12 text-center text-sm text-muted-foreground'>
            {rows.length === 0
              ? '표시할 캠페인이 없습니다.'
              : filtersActive
              ? '조건에 맞는 캠페인이 없습니다.'
              : '해당 상태의 캠페인이 없습니다.'}
            {filtersActive && (
              <Button variant='outline' size='sm' onClick={resetFilters}>
                필터 초기화
              </Button>
            )}
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
                  <TableHead className='whitespace-nowrap'>
                    {/* 헤더 클릭: 시작일 최신순 ↔ 오래된순 */}
                    <button
                      type='button'
                      onClick={() =>
                        setSort(sort === 'latest' ? 'oldest' : 'latest')
                      }
                      className='inline-flex items-center gap-1 transition-colors hover:text-foreground'
                      title='시작일 기준 정렬'
                    >
                      기간
                      {sort === 'latest' ? (
                        <ArrowDownIcon className='h-3.5 w-3.5' />
                      ) : sort === 'oldest' ? (
                        <ArrowUpIcon className='h-3.5 w-3.5' />
                      ) : (
                        <ArrowDownUpIcon className='h-3.5 w-3.5 opacity-40' />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className='whitespace-nowrap'>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={TABLE_STYLES.body}>
                {view.list.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className='whitespace-nowrap'>
                      {r.daily_report_url ? (
                        <Link
                          href={`/share/campaigns/${r.id}`}
                          className='inline-flex items-center gap-1.5 font-medium text-foreground transition-colors hover:text-primary hover:underline'
                        >
                          <ReportSheetBadge connected />
                          {r.name}
                        </Link>
                      ) : (
                        // 리포트 미연동 — 성과 화면이 비어 있으므로 링크 없이 비활성 표시
                        <span
                          className='inline-flex items-center gap-1.5 font-medium text-muted-foreground'
                          title='리포트 미연동'
                        >
                          <ReportSheetBadge connected={false} />
                          {r.name}
                        </span>
                      )}
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
