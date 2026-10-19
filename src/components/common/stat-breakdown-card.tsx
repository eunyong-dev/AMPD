'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface StatBreakdownItem {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface StatBreakdownCardProps {
  icon?: React.ReactNode;
  title: string;
  items: StatBreakdownItem[];
  /** 항목 클릭 시 호출 — 주면 각 항목이 필터 버튼처럼 동작한다 */
  onItemClick?: (key: string) => void;
  /** 지금 선택된 항목 key — 강조 표시 */
  activeKeys?: string[];
}

/**
 * 통계 분포 카드 — 상단에 stacked bar로 비율 시각화 + 각 항목별 카운트
 */
export function StatBreakdownCard({
  icon,
  title,
  items,
  onItemClick,
  activeKeys,
}: StatBreakdownCardProps) {
  const total = items.reduce((sum, it) => sum + it.value, 0);

  return (
    <Card>
      <CardContent className='p-4 space-y-3'>
        {/* Header */}
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            {icon}
            <h3 className='text-sm font-semibold'>{title}</h3>
          </div>
          <div className='text-xs text-muted-foreground'>
            전체{' '}
            <span className='font-semibold text-foreground tabular-nums'>
              {total}
            </span>
          </div>
        </div>

        {/* Stacked Bar */}
        <div className='flex h-2 w-full overflow-hidden rounded-full bg-muted'>
          {total === 0
            ? null
            : items.map((it) => {
                const pct = (it.value / total) * 100;
                if (pct === 0) return null;
                return (
                  <div
                    key={it.key}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: it.color,
                    }}
                    title={`${it.label}: ${it.value} (${pct.toFixed(1)}%)`}
                  />
                );
              })}
        </div>

        {/* Breakdown */}
        <div className='-mx-2 grid grid-cols-4 gap-1'>
          {items.map((it) => {
            const pct = total === 0 ? 0 : (it.value / total) * 100;
            const isActive = !!activeKeys?.includes(it.key);
            const content = (
              <>
                <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                  <span
                    className='h-2 w-2 rounded-full flex-shrink-0'
                    style={{ backgroundColor: it.color }}
                  />
                  <span className='truncate'>{it.label}</span>
                </div>
                <div className='flex items-baseline gap-1.5'>
                  <span className='text-xl font-bold tabular-nums leading-none'>
                    {it.value}
                  </span>
                  <span className='text-xs text-muted-foreground tabular-nums'>
                    {pct.toFixed(0)}%
                  </span>
                </div>
              </>
            );

            // 클릭 가능하면 필터 버튼처럼, 아니면 기존처럼 표시만
            if (!onItemClick) {
              return (
                <div key={it.key} className='space-y-1 px-2 py-1.5'>
                  {content}
                </div>
              );
            }
            return (
              <button
                key={it.key}
                type='button'
                onClick={() => onItemClick(it.key)}
                aria-pressed={isActive}
                title={`${it.label}만 보기`}
                className={cn(
                  'space-y-1 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted',
                  isActive && 'bg-muted ring-1 ring-border'
                )}
              >
                {content}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
