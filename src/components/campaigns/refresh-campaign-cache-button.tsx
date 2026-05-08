'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  useGameCacheRefresh,
  type PhaseProgress,
} from '@/hooks/use-game-cache-refresh';

interface RefreshCampaignCacheButtonProps {
  accountId: string;
}

export function RefreshCampaignCacheButton({
  accountId,
}: RefreshCampaignCacheButtonProps) {
  const { refresh, refreshing, progress } = useGameCacheRefresh({ accountId });

  const totalAll = progress
    ? progress.logos.total + progress.names.total
    : 0;
  const doneAll = progress ? progress.logos.done + progress.names.done : 0;
  const percent = totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0;
  const showPopover = refreshing || (!!progress && totalAll > 0);

  return (
    <Popover open={showPopover}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='flex-shrink-0'
          onClick={refresh}
          disabled={refreshing}
          title='Refresh missing game logos and regional names for this account'
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
          />
          Refresh cache
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align='end'
        className='w-80 p-3 space-y-3'
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className='space-y-1.5'>
          <div className='flex items-center justify-between text-sm'>
            <span className='font-medium'>
              {doneAll} / {totalAll}
            </span>
            <span className='text-muted-foreground tabular-nums'>
              {percent}%
            </span>
          </div>
          <div className='h-2 w-full bg-muted rounded-full overflow-hidden'>
            <div
              className='h-full bg-primary transition-all'
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {progress && (
          <div className='grid grid-cols-2 gap-2 text-xs'>
            <PhaseRow label='Logos' phase={progress.logos} />
            <PhaseRow label='Names' phase={progress.names} />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function PhaseRow({
  label,
  phase,
}: {
  label: string;
  phase: PhaseProgress;
}) {
  return (
    <div className='border rounded-md p-2 space-y-1'>
      <div className='font-medium text-foreground'>
        {label}{' '}
        <span className='text-muted-foreground font-normal tabular-nums'>
          {phase.done}/{phase.total}
        </span>
      </div>
      <div className='flex gap-2 text-muted-foreground'>
        <span className='text-emerald-600 dark:text-emerald-500'>
          ✓ {phase.updated}
        </span>
        <span className='text-yellow-600 dark:text-yellow-500'>
          ⊘ {phase.skipped}
        </span>
        <span className='text-red-600 dark:text-red-500'>
          ✗ {phase.failed}
        </span>
      </div>
    </div>
  );
}
