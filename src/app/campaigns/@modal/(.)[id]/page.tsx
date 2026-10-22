'use client';

import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { Maximize2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { CampaignDetailView } from '@/components/campaigns/campaign-detail/campaign-detail-view';

/**
 * 캠페인 현황에서 캠페인을 누르면 — 거의 전체 화면을 덮는 모달로 성과 화면.
 * 주소(/campaigns/[id])는 그대로라 새로고침·링크 공유 시에는 전체 페이지로 열린다.
 */
export default function CampaignModal() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  return (
    <Dialog open onOpenChange={(open) => !open && router.back()}>
      <DialogContent
        className='flex h-[94dvh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[96vw] [&>button.absolute]:hidden'
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
        <div className='min-h-0 flex-1 overflow-hidden p-4'>
          <CampaignDetailView inModal />
        </div>
      </DialogContent>
    </Dialog>
  );
}
