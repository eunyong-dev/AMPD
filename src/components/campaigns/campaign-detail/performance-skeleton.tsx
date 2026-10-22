import { Skeleton } from '@/components/ui/skeleton';

/**
 * 성과 화면 스켈레톤 — 모달 loading.tsx 와 상세 화면 첫 로딩이 같은 모양을 쓴다
 * (스켈레톤이 두 번 바뀌며 깜빡이지 않게)
 */
export function PerformanceSkeleton() {
  return (
    <div className='flex h-full min-h-[480px] flex-col gap-4'>
      <Skeleton className='h-[68px] w-full rounded-xl' />
      <div className='flex items-center justify-between'>
        <Skeleton className='h-8 w-[136px] rounded-lg' />
        <Skeleton className='h-8 w-[260px] rounded-lg' />
      </div>
      <Skeleton className='w-full flex-1 rounded-xl' />
    </div>
  );
}
