'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { DailyReportTable } from '@/components/campaigns/campaign-detail/daily-report-table';
import { MonthlySummaryTable } from '@/components/campaigns/campaign-detail/monthly-summary-table';
import {
  DateRangePicker,
  type DateRange,
  type DateRangePreset,
} from '@/components/common/date-range-picker';
import { MmpIcon } from '@/components/common/mmp-icon';
import {
  GameCell,
  StatusBadge,
  REGION_FLAG,
  fmtPeriod,
  type PublicCampaign,
} from '@/components/share/share-campaign-ui';
import { parseSheetDate as parseSheetDateRaw } from '@/lib/utils/sheet-formatters';
import { computeMonthlySummary } from '@/lib/utils/monthly-summary';

type Row = Record<string, unknown>;

// 시트 셀 값(unknown) → 날짜 파싱
const parseSheetDate = (v: unknown) =>
  parseSheetDateRaw(v == null ? null : String(v));

interface ShareReportResponse {
  campaign: PublicCampaign;
  rows: Row[];
  hasReport: boolean;
  reportError: string | null;
}

const findDateHeader = (row: Row | undefined): string | null => {
  if (!row) return null;
  return (
    Object.keys(row).find(
      (h) => h === '날짜' || h === 'date' || h.toLowerCase() === 'date'
    ) ?? null
  );
};

// 표 영역 높이: 표가 h-full(내부 스크롤 + sticky 헤더)이라 확정 높이가 필요.
// lg+ 는 남은 화면을 채우고, 그 이하는 고정 높이(최소 320px) + 페이지 스크롤.
const TAB_PANEL_CLS =
  'h-[70dvh] min-h-[320px] min-w-0 lg:h-auto lg:min-h-0 lg:flex-1';

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;

function InfoItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className='flex min-w-0 flex-col gap-1'>
      <span className='text-xs text-muted-foreground'>{label}</span>
      <div className='flex min-w-0 items-center text-sm'>{children}</div>
    </div>
  );
}

export default function SharedCampaignViewerPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [campaign, setCampaign] = useState<PublicCampaign | null>(null);
  const [allRows, setAllRows] = useState<Row[] | null>(null);
  const [hasReport, setHasReport] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);
  const [tab, setTab] = useState<'daily' | 'monthly'>('daily');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFatal(null);
      try {
        const res = await fetch(
          `/api/share/campaigns/${encodeURIComponent(id)}`
        );
        const json = (await res.json().catch(() => ({}))) as Partial<
          ShareReportResponse & { error: string }
        >;
        if (!res.ok || !json.campaign) {
          throw new Error(json.error || '캠페인을 불러오지 못했습니다.');
        }
        if (cancelled) return;

        // 오래된 날짜부터 정렬
        const rows = [...(json.rows ?? [])];
        const dh = findDateHeader(rows[0]);
        if (dh) {
          rows.sort((a, b) => {
            const da = parseSheetDate(a[dh]);
            const db = parseSheetDate(b[dh]);
            if (!da || !db) return 0;
            return da.getTime() - db.getTime();
          });
        }

        setCampaign(json.campaign);
        setHasReport(json.hasReport ?? false);
        setReportError(json.reportError ?? null);
        setAllRows(rows);
      } catch (e) {
        if (!cancelled) {
          setFatal(
            e instanceof Error ? e.message : '캠페인을 불러오지 못했습니다.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const dateHeader = useMemo(
    () => findDateHeader(allRows?.[0]),
    [allRows]
  );

  // 시트 데이터의 최소/최대 날짜 (기간 프리셋 기준)
  const { minDate, lastDate } = useMemo(() => {
    if (!allRows || !dateHeader) return { minDate: null, lastDate: null };
    const ds = allRows
      .map((r) => parseSheetDate(r[dateHeader]))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    return {
      minDate: ds[0] ?? null,
      lastDate: ds[ds.length - 1] ?? null,
    };
  }, [allRows, dateHeader]);

  const presets = useMemo<DateRangePreset[]>(() => {
    const nDays = (n: number) => {
      if (!lastDate) return null;
      const from = new Date(lastDate);
      from.setDate(from.getDate() - (n - 1));
      return { from, to: new Date(lastDate) };
    };
    return [
      { id: 'last-7', label: 'Last 7 days', getRange: () => nDays(7) },
      { id: 'last-14', label: 'Last 14 days', getRange: () => nDays(14) },
      { id: 'last-30', label: 'Last 30 days', getRange: () => nDays(30) },
      { id: 'last-90', label: 'Last 90 days', getRange: () => nDays(90) },
      {
        id: 'all',
        label: 'All',
        getRange: () =>
          minDate && lastDate
            ? { from: new Date(minDate), to: new Date(lastDate) }
            : null,
      },
    ];
  }, [lastDate, minDate]);

  // 일간 표시 데이터: 기간 미설정 시 최신 날짜 기준 30일 (내부 상세와 동일)
  const dailyData = useMemo<Row[] | null>(() => {
    if (!allRows) return null;
    if (!dateHeader) return allRows;
    const withDate = allRows.filter(
      (r) => parseSheetDate(r[dateHeader]) !== null
    );

    let from: Date | undefined;
    let to: Date | undefined;
    if (dateRange) {
      from = dateRange.from;
      to = dateRange.to;
    } else if (lastDate) {
      to = lastDate;
      from = new Date(lastDate);
      from.setDate(from.getDate() - 30);
    }
    if (!from && !to) return withDate;

    const fromStr = from ? toIso(from) : null;
    const toStr = to ? toIso(to) : null;
    return withDate.filter((r) => {
      const s = toIso(parseSheetDate(r[dateHeader])!);
      if (fromStr && s < fromStr) return false;
      if (toStr && s > toStr) return false;
      return true;
    });
  }, [allRows, dateHeader, dateRange, lastDate]);

  const headers = useMemo(() => {
    if (!dailyData || dailyData.length === 0) return [];
    return Object.keys(dailyData[0]).filter((k) => !k.startsWith('_'));
  }, [dailyData]);

  // 월간 집계는 기간 필터와 무관하게 전체 데이터 기준 (내부 상세와 동일 로직 공유)
  const monthly = useMemo(() => computeMonthlySummary(allRows), [allRows]);

  if (fatal) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center'>
        <p className='text-sm text-muted-foreground'>{fatal}</p>
        <div className='flex gap-2'>
          <Button variant='outline' asChild>
            <Link href='/share/campaigns'>
              <ArrowLeft className='h-4 w-4' />
              캠페인 현황
            </Link>
          </Button>
          <Button onClick={() => setReloadKey((k) => k + 1)}>
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  return (
    // 데스크톱(lg+): 화면 높이에 고정 → 표 내부 스크롤 + sticky 헤더 (내부 상세와 동일)
    // 모바일/짧은 화면: 페이지 자체가 스크롤 (헤더가 커도 표가 0px 로 접히지 않게)
    <div className='flex min-h-[100dvh] flex-col bg-background lg:h-[100dvh]'>
      <div className='mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 px-4 py-6 sm:px-6 lg:min-h-0'>
        {/* 헤더 */}
        <div className='flex-shrink-0'>
          <Link
            href='/share/campaigns'
            className='inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground'
          >
            <ArrowLeft className='h-4 w-4' />
            캠페인 현황
          </Link>

          {loading && !campaign ? (
            <div className='mt-3 space-y-3'>
              <Skeleton className='h-8 w-72' />
              <Skeleton className='h-16 w-full' />
            </div>
          ) : campaign ? (
            <>
              <h1 className='mt-2 text-2xl font-bold text-foreground'>
                {campaign.name}
              </h1>
              <div className='mt-3 grid grid-cols-2 gap-4 rounded-xl border p-4 sm:grid-cols-3 lg:grid-cols-7'>
                <InfoItem label='광고주'>
                  <span className='truncate font-medium'>
                    {campaign.account?.company ?? '-'}
                  </span>
                </InfoItem>
                <InfoItem label='게임'>
                  <GameCell game={campaign.game} fallbackName={campaign.name} />
                </InfoItem>
                <InfoItem label='지역'>
                  {REGION_FLAG[campaign.region ?? ''] ?? ''}{' '}
                  {campaign.region ?? '-'}
                </InfoItem>
                <InfoItem label='MMP'>
                  <MmpIcon mmp={campaign.mmp} />
                </InfoItem>
                <InfoItem label='타입'>{campaign.campaign_type ?? '-'}</InfoItem>
                <InfoItem label='기간'>
                  <span className='tabular-nums text-muted-foreground'>
                    {fmtPeriod(campaign.start_date, campaign.end_date)}
                  </span>
                </InfoItem>
                <InfoItem label='상태'>
                  <StatusBadge status={campaign.status} />
                </InfoItem>
              </div>
            </>
          ) : null}
        </div>

        {/* 성과 */}
        {!loading && campaign && !hasReport ? (
          <div className='rounded-xl border py-16 text-center text-sm text-muted-foreground'>
            성과 리포트가 연결되지 않은 캠페인입니다.
          </div>
        ) : (
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as 'daily' | 'monthly')}
            className='flex min-w-0 flex-col gap-4 lg:min-h-0 lg:flex-1'
          >
            <div className='flex flex-shrink-0 flex-wrap items-center justify-between gap-2'>
              <TabsList className='h-9 rounded-xl'>
                <TabsTrigger value='daily' className='rounded-lg px-3 py-1 text-sm'>
                  일간
                </TabsTrigger>
                <TabsTrigger value='monthly' className='rounded-lg px-3 py-1 text-sm'>
                  월간
                </TabsTrigger>
              </TabsList>
              {tab === 'daily' && (
                <DateRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  presets={presets}
                  placeholder={lastDate ? '최근 30일' : '기간 선택'}
                />
              )}
            </div>

            <TabsContent value='daily' className={TAB_PANEL_CLS}>
              <DailyReportTable
                loading={loading}
                error={reportError}
                data={dailyData ?? []}
                headers={headers}
                onRetry={() => setReloadKey((k) => k + 1)}
              />
            </TabsContent>
            <TabsContent value='monthly' className={TAB_PANEL_CLS}>
              {loading ? (
                <div className='space-y-2'>
                  <Skeleton className='h-10 w-full' />
                  <Skeleton className='h-10 w-full' />
                </div>
              ) : (
                <MonthlySummaryTable rows={monthly ?? []} />
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
