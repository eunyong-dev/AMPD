'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DateRangePicker,
  type DateRange,
  type DateRangePreset,
} from '@/components/common/date-range-picker';
import { DailyReportTable } from '@/components/campaigns/campaign-detail/daily-report-table';
import { MonthlySummaryTable } from '@/components/campaigns/campaign-detail/monthly-summary-table';
import { PeriodComparison } from '@/components/campaigns/campaign-detail/period-comparison';
import {
  CampaignCharts,
  type ChartGranularity,
} from '@/components/campaigns/campaign-detail/campaign-charts';
import {
  aggregateCampaignMetrics,
  filterRowsByDateRange,
  findDateHeader as findCampaignDateHeader,
} from '@/lib/utils/campaign-metrics';
import { computeMonthlySummary } from '@/lib/utils/monthly-summary';
import { parseSheetDate as parseSheetDateRaw } from '@/lib/utils/sheet-formatters';

type SheetRow = Record<string, unknown>;

// 시트 셀 값(unknown) → 날짜 파싱
const parseSheetDate = (v: unknown) =>
  parseSheetDateRaw(v == null ? null : String(v));

// 날짜 컬럼 이름 찾기
const findDateHeader = (row: SheetRow | undefined): string | null => {
  if (!row) return null;
  return (
    Object.keys(row).find(
      (h) => h === '날짜' || h === 'date' || h.toLowerCase() === 'date'
    ) ?? null
  );
};

// 날짜를 YYYY-MM-DD 형식으로 변환
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;

const TAB_TRIGGER_CLS = 'rounded-lg text-sm px-3 py-1';

interface CampaignPerformanceProps {
  /** 시트 전체 행 (순서 무관 — 내부에서 날짜 오름차순 정렬) */
  allData: SheetRow[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** 기간 비교 버튼/패널 — 내부 전용 */
  enableCompare?: boolean;
  /** 툴바 오른쪽 끝 버튼 (변경 기록 / 시트 보기 / 새로고침 등) — 내부 전용 */
  toolbarActions?: React.ReactNode;
  /** Tabs 루트 className — 레이아웃별 높이 규칙 */
  className?: string;
  /** 탭 패널 className — 기본: 남은 높이 채우기 (표 내부 스크롤 + sticky 헤더) */
  panelClassName?: string;
}

/**
 * 캠페인 성과 영역 — 일간 / 월간 / 차트 탭 + 기간 선택.
 * 내부 캠페인 상세(/campaigns/[id])와 공개 성과 뷰어(/share/campaigns/[id])가 공유.
 * 데이터 로드는 각 페이지가 담당하고, 여기서는 정렬·기간 필터·집계·표시만 한다.
 */
export function CampaignPerformance({
  allData,
  loading,
  error,
  onRetry,
  enableCompare = false,
  toolbarActions,
  className = 'flex flex-1 flex-col min-h-0 min-w-0 gap-4',
  panelClassName = 'flex-1 min-h-0 min-w-0',
}: CampaignPerformanceProps) {
  // 활성 탭 — 차트 탭일 때만 granularity 드롭다운 표시
  const [activeTab, setActiveTab] = useState<string>('daily');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  // 차트 단위 — daily / weekly / monthly
  const [granularity, setGranularity] = useState<ChartGranularity>('daily');
  // 기간 비교 모드
  const [compareEnabled, setCompareEnabled] = useState<boolean>(false);
  const [compareDateRange, setCompareDateRange] = useState<
    DateRange | undefined
  >(undefined);

  // 오래된 날짜부터 정렬 + 첫/마지막 날짜 (프리셋·기본 30일 기준)
  const { rows, dateHeader, firstDate, lastDate } = useMemo(() => {
    const src = allData ?? [];
    const dh = findDateHeader(src[0]);
    if (!dh) {
      return { rows: src, dateHeader: null, firstDate: null, lastDate: null };
    }
    const sorted = [...src].sort((a, b) => {
      const dateA = parseSheetDate(a[dh]);
      const dateB = parseSheetDate(b[dh]);
      if (!dateA || !dateB) return 0;
      return dateA.getTime() - dateB.getTime();
    });
    const times = sorted
      .map((r) => parseSheetDate(r[dh]))
      .filter((d): d is Date => d !== null)
      .map((d) => d.getTime());
    return {
      rows: sorted,
      dateHeader: dh,
      firstDate: times.length ? new Date(Math.min(...times)) : null,
      lastDate: times.length ? new Date(Math.max(...times)) : null,
    };
  }, [allData]);

  // DateRangePicker presets:
  //  - last-N-days / all: 시트 데이터 기준 (마지막 날짜, 전체 min/max)
  //  - last-week / last-month: 실제 달력 기준 (오늘)
  const datePickerPresets = useMemo<DateRangePreset[]>(() => {
    const nDays = (n: number) => {
      if (!lastDate) return null;
      const to = new Date(lastDate);
      const from = new Date(lastDate);
      from.setDate(from.getDate() - (n - 1));
      return { from, to };
    };

    return [
      { id: 'last-7', label: 'Last 7 days', getRange: () => nDays(7) },
      { id: 'last-14', label: 'Last 14 days', getRange: () => nDays(14) },
      { id: 'last-30', label: 'Last 30 days', getRange: () => nDays(30) },
      { id: 'last-90', label: 'Last 90 days', getRange: () => nDays(90) },
      { id: '---', label: '', getRange: () => null },
      {
        id: 'last-week',
        label: 'Last week',
        getRange: () => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const day = today.getDay();
          const lastMonday = new Date(today);
          lastMonday.setDate(today.getDate() - ((day + 6) % 7) - 7);
          const lastSunday = new Date(lastMonday);
          lastSunday.setDate(lastMonday.getDate() + 6);
          return { from: lastMonday, to: lastSunday };
        },
      },
      {
        id: 'last-month',
        label: 'Last month',
        getRange: () => {
          const today = new Date();
          const thisMonthFirst = new Date(
            today.getFullYear(),
            today.getMonth(),
            1
          );
          const lastMonthFirst = new Date(
            today.getFullYear(),
            today.getMonth() - 1,
            1
          );
          const lastMonthLast = new Date(thisMonthFirst);
          lastMonthLast.setDate(0);
          return { from: lastMonthFirst, to: lastMonthLast };
        },
      },
      { id: '---', label: '', getRange: () => null },
      {
        id: 'all',
        label: 'All time',
        getRange: () =>
          firstDate && lastDate
            ? { from: new Date(firstDate), to: new Date(lastDate) }
            : null,
      },
    ];
  }, [firstDate, lastDate]);

  // 전체 데이터 + 날짜 범위 조합으로 화면에 표시할 데이터를 도출
  // dateRange 미설정 시: 최신 날짜 기준 30일
  // dateRange 설정 시: 해당 범위 (부분 설정도 허용)
  // 날짜가 비어있는 행(시트에 미리 만들어 둔 빈 행)은 항상 제외
  const data = useMemo<SheetRow[] | null>(() => {
    if (!allData) return null;
    if (!dateHeader) return rows;

    const rowsWithDate = rows.filter(
      (row) => parseSheetDate(row[dateHeader]) !== null
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
    if (!from && !to) return rowsWithDate;

    const fromStr = from ? toIso(from) : null;
    const toStr = to ? toIso(to) : null;
    return rowsWithDate.filter((row) => {
      const s = toIso(parseSheetDate(row[dateHeader])!);
      if (fromStr && s < fromStr) return false;
      if (toStr && s > toStr) return false;
      return true;
    });
  }, [allData, rows, dateHeader, dateRange, lastDate]);

  // 비교 기간 메트릭 (비교 모드 + 비교 기간 선택 시)
  const comparisonMetrics = useMemo(() => {
    if (!enableCompare || !compareEnabled || !allData || allData.length === 0)
      return null;
    const dh = findCampaignDateHeader(allData[0]);
    if (!dh) return null;

    const compareRows = filterRowsByDateRange(
      allData,
      compareDateRange?.from,
      compareDateRange?.to,
      dh
    );
    return {
      current: aggregateCampaignMetrics(data ?? []),
      comparison: aggregateCampaignMetrics(compareRows),
    };
  }, [enableCompare, compareEnabled, allData, data, compareDateRange]);

  // 테이블 헤더 (_ 접두 내부 키 — _notes 등 — 제외)
  const headers = useMemo(() => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]).filter((k) => !k.startsWith('_'));
  }, [data]);

  // 월간 집계 — 기간 필터와 무관하게 전체 데이터 기준 (비율 컬럼은 재계산)
  const monthlySummary = useMemo(() => computeMonthlySummary(allData), [allData]);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className={className}>
      <div className='flex-shrink-0 flex items-center justify-between gap-2 flex-wrap'>
        <TabsList className='rounded-xl h-9'>
          <TabsTrigger value='daily' className={TAB_TRIGGER_CLS}>
            일간
          </TabsTrigger>
          <TabsTrigger value='monthly' className={TAB_TRIGGER_CLS}>
            월간
          </TabsTrigger>
          <TabsTrigger value='charts' className={TAB_TRIGGER_CLS}>
            차트
          </TabsTrigger>
        </TabsList>
        <div className='flex flex-wrap items-center gap-2'>
          {activeTab !== 'monthly' && (
            <>
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                presets={datePickerPresets}
                placeholder={lastDate ? '최근 30일' : '기간 선택'}
                triggerClassName='max-[1100px]:justify-center'
                hideLabelClassName='max-[1100px]:hidden'
              />
              {enableCompare && (
                <>
                  <Button
                    variant={compareEnabled ? 'default' : 'outline'}
                    size='sm'
                    className='flex-shrink-0'
                    onClick={() => setCompareEnabled((v) => !v)}
                    title='다른 기간과 비교'
                  >
                    <span className='max-[1100px]:hidden'>
                      {compareEnabled ? '비교중' : '비교'}
                    </span>
                    <span className='hidden max-[1100px]:inline'>vs</span>
                  </Button>
                  {compareEnabled && (
                    <DateRangePicker
                      value={compareDateRange}
                      onChange={setCompareDateRange}
                      presets={datePickerPresets}
                      placeholder='비교 기간'
                      triggerClassName='max-[1100px]:justify-center'
                      hideLabelClassName='max-[1100px]:hidden'
                    />
                  )}
                </>
              )}
            </>
          )}
          {activeTab === 'charts' && (
            <Select
              value={granularity}
              onValueChange={(v) => setGranularity(v as ChartGranularity)}
            >
              <SelectTrigger className='h-9 w-auto gap-2 flex-shrink-0'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='daily'>일간</SelectItem>
                <SelectItem value='weekly'>주간</SelectItem>
                <SelectItem value='monthly'>월간</SelectItem>
              </SelectContent>
            </Select>
          )}
          {toolbarActions}
        </div>
      </div>

      {/* Period Comparison */}
      {comparisonMetrics && activeTab !== 'monthly' && (
        <div className='flex-shrink-0'>
          <PeriodComparison
            current={comparisonMetrics.current}
            comparison={comparisonMetrics.comparison}
            currentRange={dateRange}
            comparisonRange={compareDateRange}
          />
        </div>
      )}

      {/* Charts */}
      <TabsContent
        value='charts'
        className={`${panelClassName} overflow-y-auto data-[state=active]:flex flex-col gap-4`}
      >
        {loading ? (
          <div className='space-y-4'>
            <Skeleton className='h-[360px] w-full' />
            <Skeleton className='h-[300px] w-full' />
          </div>
        ) : error ? (
          <div className='text-center py-8'>
            <p className='text-destructive mb-2'>{error}</p>
            <Button variant='outline' onClick={onRetry}>
              다시 시도
            </Button>
          </div>
        ) : !data || data.length === 0 ? (
          <div className='text-center py-8 text-muted-foreground'>
            데이터가 없습니다.
          </div>
        ) : (
          <CampaignCharts data={data} granularity={granularity} />
        )}
      </TabsContent>

      {/* Monthly Summary (전체 데이터 기준) */}
      <TabsContent value='monthly' className={panelClassName}>
        {loading ? (
          <div className='space-y-2'>
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
          </div>
        ) : (
          <MonthlySummaryTable rows={monthlySummary ?? []} />
        )}
      </TabsContent>

      {/* Daily Report Data */}
      <TabsContent value='daily' className={panelClassName}>
        <DailyReportTable
          loading={loading}
          error={error}
          data={data ?? []}
          headers={headers}
          onRetry={onRetry}
        />
      </TabsContent>
    </Tabs>
  );
}
