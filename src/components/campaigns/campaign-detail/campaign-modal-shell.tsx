'use client';

import { useRouter } from 'next/navigation';
import { Maximize2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

/**
 * 성과 모달 껍데기 — 캠페인 현황(내부·공개)에서 캠페인을 누르면 거의 전체를 덮는 모달.
 * 가로채기 라우트의 layout 에서 써서 클릭 즉시 열리고, 내용은 loading 스켈레톤 → 본문 순.
 */
export function CampaignModalShell({
  fullPageHref,
  children,
}: {
  /** "전체 화면으로" — 가로채기 없이 전체 페이지로 다시 열 주소 */
  fullPageHref: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <Dialog open onOpenChange={(open) => !open && router.back()}>
      <DialogContent
        className='modal-pop flex h-[94dvh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[96vw] [&>button.absolute]:hidden'
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className='sr-only'>캠페인 성과</DialogTitle>
        <div className='flex flex-shrink-0 items-center justify-end gap-1 border-b px-3 py-1.5'>
          <button
            type='button'
            onClick={() => {
              window.location.href = fullPageHref;
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
        <div className='modal-pop-content min-h-0 flex-1 overflow-hidden p-4'>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
