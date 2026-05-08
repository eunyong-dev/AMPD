'use client';

import { SettingsIcon, RefreshCw, Sparkles } from 'lucide-react';

import { AccessControl } from '@/components/access-control';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';
import {
  useGameCacheRefresh,
  type PhaseProgress,
} from '@/hooks/use-game-cache-refresh';

export default function SettingsPage() {
  const { refresh, refreshing, progress } = useGameCacheRefresh();

  const totalAll = progress
    ? progress.logos.total + progress.names.total
    : 0;
  const doneAll = progress ? progress.logos.done + progress.names.done : 0;
  const percent = totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0;

  return (
    <AccessControl>
      <div className='space-y-6 w-full overflow-x-hidden'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight flex items-center gap-3'>
            <SettingsIcon className='h-8 w-8 text-primary' />
            Settings
          </h1>
          <p className='text-sm text-muted-foreground mt-1'>
            Administrative tools and maintenance actions.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Sparkles className='h-5 w-5' />
              Refresh Game Cache (All Accounts)
            </CardTitle>
            <CardDescription>
              Re-fetches and overwrites cached data across all accounts to keep
              it in sync with external store pages:
              <ul className='mt-2 ml-4 list-disc space-y-0.5'>
                <li>
                  <strong>Game logos</strong> — fetches latest icon from store
                </li>
                <li>
                  <strong>Regional game names</strong> — fetches latest
                  region-localized name
                </li>
              </ul>
              Existing values are kept if the fetch fails. For per-account
              refresh, use the button on Account Detail → Campaigns tab.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <Button onClick={refresh} disabled={refreshing} size='sm'>
              <RefreshCw
                className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}
              />
              {refreshing ? 'Refreshing...' : 'Refresh missing data'}
            </Button>

            {progress && (
              <div className='space-y-3'>
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

                <div className='grid grid-cols-2 gap-3 text-xs'>
                  <PhaseRow label='Logos' phase={progress.logos} />
                  <PhaseRow label='Regional names' phase={progress.names} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Toaster position='top-center' />
    </AccessControl>
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
    <div className='border rounded-lg p-2.5 space-y-1'>
      <div className='font-medium text-foreground'>
        {label}{' '}
        <span className='text-muted-foreground font-normal tabular-nums'>
          {phase.done}/{phase.total}
        </span>
      </div>
      <div className='flex gap-3 text-muted-foreground'>
        <span>
          <span className='text-emerald-600 dark:text-emerald-500'>✓</span>{' '}
          {phase.updated}
        </span>
        <span>
          <span className='text-yellow-600 dark:text-yellow-500'>⊘</span>{' '}
          {phase.skipped}
        </span>
        <span>
          <span className='text-red-600 dark:text-red-500'>✗</span>{' '}
          {phase.failed}
        </span>
      </div>
    </div>
  );
}
