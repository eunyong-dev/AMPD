'use client';

import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { isRoasColumn, parseRoasPercent } from '@/lib/utils/roas';
import { parseSheetDate as parseSheetDateRaw } from '@/lib/utils/sheet-formatters';

type SheetRow = Record<string, unknown>;
type ChartPoint = Record<string, string | number>;

export type ChartGranularity = 'daily' | 'weekly' | 'monthly';

// 시트 셀 값(unknown) → 날짜 파싱
const parseSheetDate = (v: unknown) =>
  parseSheetDateRaw(v == null ? null : String(v));

const findDateHeader = (row: SheetRow | undefined): string | null => {
  if (!row) return null;
  return (
    Object.keys(row).find(
      (h) => h === '날짜' || h === 'date' || h.toLowerCase() === 'date'
    ) ?? null
  );
};

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;

// 비고/note 컬럼 — 텍스트 그대로 보존 (차트 marker / 툴팁 표시용)
const isNoteKey = (key: string) =>
  key === '비고' ||
  key.toLowerCase() === 'note' ||
  key.toLowerCase() === 'memo' ||
  key.toLowerCase() === 'remark';

// ROAS 코호트 정의 — shadcn Area Chart - Gradient 톤 차용
// 단일 blue hue, 옅은 sky → 짙은 indigo로 코호트 진행을 표현
// Overall은 가장 어두운 톤으로 강조
const ROAS_COHORTS = [
  { key: 'ROAS', label: 'Overall', color: 'hsl(224 76% 28%)' },
  { key: 'D0 ROAS', label: 'D0', color: 'hsl(214 95% 87%)' },
  { key: 'D1 ROAS', label: 'D1', color: 'hsl(213 94% 78%)' },
  { key: 'D7 ROAS', label: 'D7', color: 'hsl(217 91% 65%)' },
  { key: 'D14 ROAS', label: 'D14', color: 'hsl(221 83% 53%)' },
  { key: 'D30 ROAS', label: 'D30', color: 'hsl(224 76% 40%)' },
] as const;

const ROAS_CHART_CONFIG: ChartConfig = ROAS_COHORTS.reduce(
  (acc, c) => ({ ...acc, [c.key]: { label: c.label, color: c.color } }),
  {}
);

// Monthly 차트도 동일 blue family로 통일 (light=Cost, dark=Revenue)
const MONTHLY_CHART_CONFIG: ChartConfig = {
  Cost: { label: 'Cost', color: 'hsl(213 94% 78%)' },
  Revenue: { label: 'Revenue', color: 'hsl(221 83% 53%)' },
};

// Volume 차트의 메트릭들
const VOLUME_METRICS = [
  { key: 'Install', label: 'Install', color: 'hsl(217 91% 65%)' },
  { key: 'Cost', label: 'Cost', color: 'hsl(213 94% 78%)' },
  { key: 'Revenue', label: 'Revenue', color: 'hsl(221 83% 53%)' },
] as const;

const VOLUME_CHART_CONFIG: ChartConfig = VOLUME_METRICS.reduce(
  (acc, m) => ({ ...acc, [m.key]: { label: m.label, color: m.color } }),
  {}
);

// 주/월 합산 대상 절대값 컬럼
const SUM_COLS = [
  'Install',
  'Cost',
  'Revenue',
  'Clicks',
  'D0 Revenue',
  'D1 Revenue',
  'D7 Revenue',
  'D14 Revenue',
  'D30 Revenue',
];

// 합산 후 재계산하는 ROAS (ROAS 컬럼 ← Revenue 컬럼 / Cost)
const ROAS_FROM_REVENUE: Array<[string, string]> = [
  ['ROAS', 'Revenue'],
  ['D0 ROAS', 'D0 Revenue'],
  ['D1 ROAS', 'D1 Revenue'],
  ['D7 ROAS', 'D7 Revenue'],
  ['D14 ROAS', 'D14 Revenue'],
  ['D30 ROAS', 'D30 Revenue'],
];

// 주 시작일(월요일) 구하기
const getMondayOfWeek = (d: Date): Date => {
  const day = d.getDay(); // 0=일, 1=월, ... 6=토
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

/** 주/월 그룹 → 절대값 합산 + 비고/메모 결합 + ROAS 재계산(% 단위) */
function summarizeGroup(rows: SheetRow[], label: string): ChartPoint {
  const sums: Record<string, number> = {};
  for (const col of SUM_COLS) {
    sums[col] = 0;
    for (const row of rows) {
      const n = parseRoasPercent(row[col]);
      if (n !== null) sums[col] += n;
    }
  }

  const out: ChartPoint = { date: label, ...sums };

  // 그 기간의 비고들을 모아 결합
  const notes = rows
    .map((r) => String(r['비고'] ?? '').trim())
    .filter((n) => n);
  if (notes.length > 0) out['note'] = notes.join(' / ');
  // 그 기간의 셀 메모들을 모아 결합
  const memos = rows
    .map((r) => {
      const cn = r._notes as Record<string, string> | undefined;
      return cn ? String(cn['비고'] ?? '').trim() : '';
    })
    .filter((m) => m);
  if (memos.length > 0) out['memo'] = memos.join('\n');

  if (sums['Cost'] > 0) {
    for (const [roasKey, revenueKey] of ROAS_FROM_REVENUE) {
      out[roasKey] = +((sums[revenueKey] / sums['Cost']) * 100).toFixed(2);
    }
  }
  return out;
}

// 비고 마커 — 비고(셀 텍스트) 또는 메모(셀 hover note) 있는 포인트만 노란 점
const renderNoteDot = (props: any) => {
  const { cx, cy, payload, key, index } = props;
  const hasNote = Boolean(payload?.note || payload?.memo);
  return (
    <circle
      key={key ?? `dot-${index}`}
      cx={cx}
      cy={cy}
      r={hasNote ? 5 : 0}
      fill={hasNote ? '#f59e0b' : 'transparent'}
      stroke={hasNote ? '#fff' : 'transparent'}
      strokeWidth={hasNote ? 2 : 0}
    />
  );
};

// 툴팁 — 기본 ChartTooltipContent + 비고/메모 있으면 하단에 박스 추가
const renderTooltipWithNote = (
  props: any,
  formatter: (value: any, name: any) => [string, string]
) => {
  const { active, payload, label } = props;
  if (!active || !payload || payload.length === 0) return null;
  const note = payload[0]?.payload?.note as string | undefined;
  const memo = payload[0]?.payload?.memo as string | undefined;
  return (
    <div className='overflow-hidden rounded-lg border bg-background shadow-xl'>
      <ChartTooltipContent
        active={active}
        payload={payload}
        label={label}
        indicator='dot'
        formatter={formatter}
        className='border-0 shadow-none'
      />
      {note || memo ? (
        <div className='border-t bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-200 space-y-0.5'>
          {note ? <div>🏷️ {note}</div> : null}
          {memo ? <div className='whitespace-pre-wrap'>📝 {memo}</div> : null}
        </div>
      ) : null}
    </div>
  );
};

interface CampaignChartsProps {
  /** 기간 필터가 적용된 일별 시트 행 (날짜 오름차순) */
  data: SheetRow[];
  granularity: ChartGranularity;
}

/**
 * 캠페인 성과 차트 (ROAS 추이 / 볼륨 추이 / Cost vs Revenue).
 * 내부 캠페인 상세와 공개 성과 뷰어가 공유.
 */
export function CampaignCharts({ data, granularity }: CampaignChartsProps) {
  // 한 번에 하나의 코호트만 표시 (single-select)
  const [visibleCohort, setVisibleCohort] = useState<string>('ROAS');
  // Volume 차트의 메트릭 (단일 선택)
  const [visibleMetric, setVisibleMetric] = useState<string>('Install');

  // 일별: ROAS 계열은 %단위 값(130.20 형태), Install/Cost/Revenue 등은 숫자 원본
  const dailyChartData = useMemo(() => {
    if (data.length === 0) return [];
    const dateHeader = findDateHeader(data[0]);
    if (!dateHeader) return [];

    return data
      .map((row) => {
        const d = parseSheetDate(row[dateHeader]);
        if (!d) return null;
        const entry: ChartPoint = { date: `${d.getMonth() + 1}/${d.getDate()}` };
        for (const [key, raw] of Object.entries(row)) {
          if (key === dateHeader) continue;
          if (key.startsWith('_')) continue; // _notes 등 내부 키 제외
          if (isNoteKey(key)) {
            const text = raw == null ? '' : String(raw).trim();
            if (text) entry['note'] = text;
            continue;
          }
          const n = parseRoasPercent(raw);
          if (n === null) continue;
          entry[key] = isRoasColumn(key) ? +(n * 100).toFixed(2) : n;
        }
        // 셀 메모(hover note) → 차트 툴팁용 (비고 컬럼의 메모)
        const cellNotes = row._notes as Record<string, string> | undefined;
        if (cellNotes) {
          for (const [k, memo] of Object.entries(cellNotes)) {
            if (isNoteKey(k) && memo && String(memo).trim()) {
              entry['memo'] = String(memo).trim();
              break;
            }
          }
        }
        return entry;
      })
      .filter((v): v is ChartPoint => v !== null);
  }, [data]);

  // 주별: 월요일 기준 그룹 (절대값 합산 + ROAS 재계산)
  const weeklyChartData = useMemo(() => {
    if (data.length === 0) return [];
    const dateHeader = findDateHeader(data[0]);
    if (!dateHeader) return [];

    const groups = new Map<string, SheetRow[]>();
    for (const row of data) {
      const d = parseSheetDate(row[dateHeader]);
      if (!d) continue;
      const key = toIso(getMondayOfWeek(d));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    return Array.from(groups.keys())
      .sort()
      .map((key) => {
        const monday = new Date(`${key}T00:00:00`);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        // 같은 달이면 "3/16-22", 다른 달이면 "3/30-4/5"
        const label =
          monday.getMonth() === sunday.getMonth()
            ? `${monday.getMonth() + 1}/${monday.getDate()}-${sunday.getDate()}`
            : `${monday.getMonth() + 1}/${monday.getDate()}-${
                sunday.getMonth() + 1
              }/${sunday.getDate()}`;
        return summarizeGroup(groups.get(key)!, label);
      });
  }, [data]);

  // 월별: YYYY-MM 그룹 (weekly와 동일한 패턴)
  const monthlyChartData = useMemo(() => {
    if (data.length === 0) return [];
    const dateHeader = findDateHeader(data[0]);
    if (!dateHeader) return [];

    const groups = new Map<string, SheetRow[]>();
    for (const row of data) {
      const d = parseSheetDate(row[dateHeader]);
      if (!d) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0'
      )}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    return Array.from(groups.keys())
      .sort()
      .map((key) => summarizeGroup(groups.get(key)!, key));
  }, [data]);

  // ROAS / Volume / Cost-Revenue 차트가 공유하는 데이터 (granularity 적용)
  const chartData =
    granularity === 'monthly'
      ? monthlyChartData
      : granularity === 'weekly'
      ? weeklyChartData
      : dailyChartData;

  const periodLabel =
    granularity === 'monthly'
      ? '월간'
      : granularity === 'weekly'
      ? '주간'
      : '일간';

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader className='flex flex-row items-start justify-between gap-4 flex-wrap'>
          <div>
            <CardTitle>ROAS 추이</CardTitle>
            <CardDescription>
              {periodLabel} 코호트별 ROAS. 빨간 점선 = 100% BEP.
            </CardDescription>
          </div>
          <ToggleGroup
            type='single'
            size='sm'
            variant='outline'
            value={visibleCohort}
            onValueChange={(v) => {
              if (v) setVisibleCohort(v);
            }}
            className='flex-wrap justify-end'
          >
            {ROAS_COHORTS.map((c) => (
              <ToggleGroupItem
                key={c.key}
                value={c.key}
                className='h-8 px-3 text-xs'
              >
                <span
                  className='mr-1.5 inline-block h-2 w-2 rounded-full'
                  style={{ backgroundColor: c.color }}
                />
                {c.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardHeader>
        <CardContent>
          <ChartContainer config={ROAS_CHART_CONFIG} className='h-[320px] w-full'>
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
            >
              <defs>
                {ROAS_COHORTS.map((c) => (
                  <linearGradient
                    key={c.key}
                    id={`fill-${c.key.replace(/\s+/g, '_')}`}
                    x1='0'
                    y1='0'
                    x2='0'
                    y2='1'
                  >
                    <stop offset='5%' stopColor={c.color} stopOpacity={0.45} />
                    <stop offset='95%' stopColor={c.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} strokeDasharray='3 3' />
              <XAxis
                dataKey='date'
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickFormatter={(v) => `${v}%`}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <ChartTooltip
                cursor={{
                  stroke: '#94a3b8',
                  strokeWidth: 1,
                  strokeDasharray: '4 4',
                }}
                content={(p) =>
                  renderTooltipWithNote(p, (v, name) => [
                    `${Number(v).toFixed(2)}%`,
                    ` ${String(name)}`,
                  ])
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <ReferenceLine
                y={100}
                stroke='#ef4444'
                strokeDasharray='5 5'
                label={{
                  value: 'BEP 100%',
                  position: 'right',
                  fill: '#ef4444',
                  fontSize: 11,
                }}
              />
              {ROAS_COHORTS.filter((c) => c.key === visibleCohort).map((c) => (
                <Area
                  key={c.key}
                  type='monotone'
                  dataKey={c.key}
                  stroke={c.color}
                  strokeWidth={2.5}
                  fill={`url(#fill-${c.key.replace(/\s+/g, '_')})`}
                  fillOpacity={1}
                  dot={renderNoteDot}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Volume Trend (Install / Cost / Revenue) */}
      <Card>
        <CardHeader className='flex flex-row items-start justify-between gap-4 flex-wrap'>
          <div>
            <CardTitle>볼륨 추이</CardTitle>
            <CardDescription>{periodLabel} 지표별 볼륨</CardDescription>
          </div>
          <ToggleGroup
            type='single'
            size='sm'
            variant='outline'
            value={visibleMetric}
            onValueChange={(v) => {
              if (v) setVisibleMetric(v);
            }}
            className='flex-wrap justify-end'
          >
            {VOLUME_METRICS.map((m) => (
              <ToggleGroupItem
                key={m.key}
                value={m.key}
                className='h-8 px-3 text-xs'
              >
                <span
                  className='mr-1.5 inline-block h-2 w-2 rounded-full'
                  style={{ backgroundColor: m.color }}
                />
                {m.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={VOLUME_CHART_CONFIG}
            className='h-[280px] w-full'
          >
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
            >
              <defs>
                {VOLUME_METRICS.map((m) => (
                  <linearGradient
                    key={m.key}
                    id={`vol-fill-${m.key}`}
                    x1='0'
                    y1='0'
                    x2='0'
                    y2='1'
                  >
                    <stop offset='5%' stopColor={m.color} stopOpacity={0.45} />
                    <stop offset='95%' stopColor={m.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} strokeDasharray='3 3' />
              <XAxis
                dataKey='date'
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickFormatter={(v) =>
                  visibleMetric === 'Install' ? `${v}` : `$${v}`
                }
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <ChartTooltip
                cursor={{
                  stroke: '#94a3b8',
                  strokeWidth: 1,
                  strokeDasharray: '4 4',
                }}
                content={(p) =>
                  renderTooltipWithNote(p, (v, name) => [
                    visibleMetric === 'Install'
                      ? Number(v).toLocaleString()
                      : `$ ${Number(v).toFixed(2)}`,
                    ` ${String(name)}`,
                  ])
                }
              />
              {VOLUME_METRICS.filter((m) => m.key === visibleMetric).map((m) => (
                <Area
                  key={m.key}
                  type='monotone'
                  dataKey={m.key}
                  stroke={m.color}
                  strokeWidth={2.5}
                  fill={`url(#vol-fill-${m.key})`}
                  fillOpacity={1}
                  dot={renderNoteDot}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost vs Revenue</CardTitle>
          <CardDescription>{periodLabel} Cost vs Revenue 비교</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={MONTHLY_CHART_CONFIG}
            className='h-[280px] w-full'
          >
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray='3 3' />
              <XAxis
                dataKey='date'
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickFormatter={(v) => `$${v}`}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <ChartTooltip
                content={(p) =>
                  renderTooltipWithNote(p, (v, name) => [
                    `$ ${Number(v).toFixed(2)}`,
                    ` ${String(name)}`,
                  ])
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey='Cost' fill='hsl(213 94% 78%)' radius={4} />
              <Bar dataKey='Revenue' fill='hsl(221 83% 53%)' radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
