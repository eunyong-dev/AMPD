'use client';

import { RefreshCw, Sparkles } from 'lucide-react';

import { AdminAccessControl } from '@/components/admin-access-control';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';
import { CompanyInfoCard } from '@/components/settings/company-info-card';
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
    <AdminAccessControl>
      <div className='space-y-6 w-full overflow-x-hidden'>
        <CompanyInfoCard />
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Sparkles className='h-5 w-5' />
              게임 캐시 새로고침 (전체 광고주)
            </CardTitle>
            <CardDescription>
              모든 광고주의 캐시 데이터를 외부 스토어 페이지와 동기화하기 위해
              재조회 후 덮어씁니다:
              <ul className='mt-2 ml-4 list-disc space-y-0.5'>
                <li>
                  <strong>게임 로고</strong> — 스토어에서 최신 아이콘을 가져옵니다
                </li>
                <li>
                  <strong>지역별 게임명</strong> — 지역화된 최신 게임명을 가져옵니다
                </li>
              </ul>
              조회에 실패한 경우 기존 값이 유지됩니다. 광고주별 새로고침은
              광고주 상세 → 캠페인 탭의 버튼을 사용하세요.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <Button onClick={refresh} disabled={refreshing} size='sm'>
              <RefreshCw
                className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}
              />
              {refreshing ? '새로고침 중...' : '누락된 데이터 새로고침'}
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
                  <PhaseRow label='로고' phase={progress.logos} />
                  <PhaseRow label='지역별 이름' phase={progress.names} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Toaster position='top-center' />
    </AdminAccessControl>
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
