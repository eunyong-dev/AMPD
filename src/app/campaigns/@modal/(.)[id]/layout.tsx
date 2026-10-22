'use client';

import { useParams, useRouter } from 'next/navigation';
import { Maximize2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

/**
 * 성과 모달 껍데기 — layout 이라 클릭 즉시 열리고(애니메이션 1회),
 * 안쪽 내용이 준비되는 동안은 loading.tsx 스켈레톤이 보인다.
 */
export default function CampaignModalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  return (
    <Dialog open onOpenChange={(open) => !open && router.back()}>
      <DialogContent
        className='flex h-[94dvh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden rounded-2xl p-0 ![animation-duration:380ms] ![animation-timing-function:cubic-bezier(0.16,1,0.3,1)] sm:max-w-[96vw] data-[state=open]:zoom-in-90 data-[state=open]:slide-in-from-top-[46%] [&>button.absolute]:hidden'
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className='sr-only'>캠페인 성과</DialogTitle>
        <div className='flex flex-shrink-0 items-center justify-end gap-1 border-b px-3 py-1.5'>
          <button
            type='button'
            onClick={() => {
              // 전체 페이지로 다시 열기 (가로채기 없이)
              window.location.href = `/campaigns/${params?.id}`;
            }}
            className='inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground'
          >
            <Maximize2 className='h-3.5 w-3.5' />
            전체 화면으로
          </button>
          <button
            type='button'
            onClick={() => router.back()}
            aria-label='닫기'
            className='rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground'
          >
            <X className='h-4 w-4' />
          </button>
        </div>
        <div className='min-h-0 flex-1 overflow-hidden p-4'>{children}</div>
      </DialogContent>
    </Dialog>
  );
}
