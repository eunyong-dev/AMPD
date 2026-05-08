'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  type CampaignAggregates,
  deltaPercent,
} from '@/lib/utils/campaign-metrics';

const formatDollar = (n: number) =>
  `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

const formatInt = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 0 });

const formatPercent = (n: number | null) =>
  n === null ? '-' : `${(n * 100).toFixed(2)}%`;

const formatDollarOrDash = (n: number | null) =>
  n === null ? '-' : formatDollar(n);

const formatRange = (range: { from?: Date; to?: Date } | undefined) => {
  if (!range?.from || !range?.to) return 'No range selected';
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(d.getDate()).padStart(2, '0')}`;
  return `${fmt(range.from)} ~ ${fmt(range.to)}`;
};

interface MetricSpec {
  key: keyof CampaignAggregates;
  label: string;
  format: (v: number | null) => string;
  /** delta 방향 — 'up'은 증가가 긍정(녹색), 'down'은 감소가 긍정 */
  goodDirection: 'up' | 'down';
}

const METRICS: MetricSpec[] = [
  {
    key: 'cost',
    label: 'Cost',
    format: (v) => formatDollar(v ?? 0),
    goodDirection: 'down',
  },
  {
    key: 'install',
    label: 'Install',
    format: (v) => formatInt(v ?? 0),
    goodDirection: 'up',
  },
  {
    key: 'revenue',
    label: 'Revenue',
    format: (v) => formatDollar(v ?? 0),
    goodDirection: 'up',
  },
  {
    key: 'roas',
    label: 'ROAS',
    format: formatPercent,
    goodDirection: 'up',
  },
  {
    key: 'cpi',
    label: 'CPI',
    format: formatDollarOrDash,
    goodDirection: 'down',
  },
  {
    key: 'cvr',
    label: 'CVR',
    format: formatPercent,
    goodDirection: 'up',
  },
];

interface PeriodComparisonProps {
  current: CampaignAggregates;
  comparison: CampaignAggregates;
  currentRange: { from?: Date; to?: Date } | undefined;
  comparisonRange: { from?: Date; to?: Date } | undefined;
}

export function PeriodComparison({
  current,
  comparison,
  currentRange,
  comparisonRange,
}: PeriodComparisonProps) {
  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-sm'>
        <div className='flex items-center gap-2'>
          <span className='inline-block h-2 w-2 rounded-full bg-foreground' />
          <span className='font-medium'>Current</span>
          <span className='text-muted-foreground tabular-nums'>
            {formatRange(currentRange)}
          </span>
        </div>
        <div className='flex items-center gap-2'>
          <span className='inline-block h-2 w-2 rounded-full bg-muted-foreground/50' />
          <span className='font-medium'>Comparison</span>
          <span className='text-muted-foreground tabular-nums'>
            {formatRange(comparisonRange)}
          </span>
        </div>
      </div>

      <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3'>
        {METRICS.map((m) => {
          const cur = current[m.key] as number | null;
          const base = comparison[m.key] as number | null;
          const delta = deltaPercent(
            cur as number | null,
            base as number | null
          );

          return (
            <Card key={m.key} className='overflow-hidden'>
              <CardContent className='p-4'>
                <div className='text-xs text-muted-foreground mb-1'>
                  {m.label}
                </div>
                <div className='text-2xl font-semibold tabular-nums'>
                  {m.format(cur)}
                </div>
                <div className='mt-2 flex items-center justify-between text-xs'>
                  <span className='text-muted-foreground tabular-nums'>
                    vs {m.format(base)}
                  </span>
                  <DeltaBadge delta={delta} good={m.goodDirection} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DeltaBadge({
  delta,
  good,
}: {
  delta: number | null;
  good: 'up' | 'down';
}) {
  if (delta === null) {
    return (
      <span className='text-muted-foreground inline-flex items-center gap-0.5'>
        <Minus className='h-3 w-3' /> -
      </span>
    );
  }
  if (Math.abs(delta) < 0.01) {
    return (
      <span className='text-muted-foreground inline-flex items-center gap-0.5'>
        <Minus className='h-3 w-3' /> 0%
      </span>
    );
  }

  const isUp = delta > 0;
  const isPositive = (good === 'up' && isUp) || (good === 'down' && !isUp);
  const colorClass = isPositive
    ? 'text-emerald-600 dark:text-emerald-500'
    : 'text-red-600 dark:text-red-500';
  const Icon = isUp ? TrendingUp : TrendingDown;

  return (
    <span className={`inline-flex items-center gap-0.5 ${colorClass}`}>
      <Icon className='h-3 w-3' />
      {isUp ? '+' : ''}
      {delta.toFixed(1)}%
    </span>
  );
}
