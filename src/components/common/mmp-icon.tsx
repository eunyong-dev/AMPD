'use client';

import Image from 'next/image';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// 로고 에셋이 있는 MMP (public/ 폴더)
const MMP_LOGOS: Record<string, string> = {
  Adjust: '/Adjust Logo.svg',
  AppsFlyer: '/AppsFlyer Logo.svg',
};

/**
 * MMP 로고 아이콘 (hover 시 이름 툴팁).
 * 로고가 없는 MMP(Singular, Other 등)는 텍스트로 표시.
 */
export function MmpIcon({ mmp }: { mmp: string | null }) {
  const src = mmp ? MMP_LOGOS[mmp] : undefined;
  if (!mmp || !src) {
    return (
      <span className='text-xs text-muted-foreground'>{mmp ?? '-'}</span>
    );
  }
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className='inline-flex h-5 w-5 flex-shrink-0 items-center justify-center'>
            <Image
              src={src}
              alt={mmp}
              width={20}
              height={20}
              className='h-auto w-auto object-contain'
              unoptimized
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{mmp}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
