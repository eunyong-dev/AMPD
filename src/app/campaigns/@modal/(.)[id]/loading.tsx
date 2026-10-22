import { Skeleton } from '@/components/ui/skeleton';

/** 모달이 뜬 직후 내용이 준비되기 전까지 — 성과 화면 모양의 스켈레톤 */
export default function CampaignModalLoading() {
  return (
    <div className='flex h-full flex-col gap-4'>
      <Skeleton className='h-[72px] w-full rounded-xl' />
      <div className='flex items-center justify-between'>
        <Skeleton className='h-9 w-[153px] rounded-xl' />
        <Skeleton className='h-9 w-[320px] rounded-xl' />
      </div>
      <Skeleton className='w-full flex-1 rounded-xl' />
    </div>
  );
}
