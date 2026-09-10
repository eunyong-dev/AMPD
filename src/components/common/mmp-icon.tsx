'use client';

import Image from 'next/image';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// 로고 에셋이 있는 MMP (public/ 폴더) — 앱 전체 MMP 아이콘의 단일 소스
const MMP_LOGOS: Record<string, { src: string; cls: string }> = {
  Adjust: { src: '/Adjust Logo.svg', cls: 'h-auto w-auto object-contain' },
  AppsFlyer: {
    src: '/AppsFlyer Logo.svg',
    cls: 'h-auto w-auto object-contain',
  },
  // 정사각 앱 아이콘(PNG, 원본 96px) → 박스 크기로 고정 + 모서리 라운드
  Tenjin: { src: '/Tenjin Logo.png', cls: 'h-5 w-5 rounded object-cover' },
};

// align-middle: 표 셀(text-center)처럼 인라인으로 놓일 때 행 중앙에 맞춤 (flex 안에선 무시됨)
const BOX =
  'inline-flex h-5 w-5 flex-shrink-0 items-center justify-center align-middle';

function LogoImage({ mmp }: { mmp: string }) {
  const logo = MMP_LOGOS[mmp];
  return (
    <Image
      src={logo.src}
      alt={mmp}
      width={20}
      height={20}
      className={logo.cls}
      unoptimized
    />
  );
}

/** 로고 이미지만 (툴팁 없음). 로고 에셋이 없으면 null — Select 옵션 등에 사용 */
export function MmpLogo({ mmp }: { mmp: string | null }) {
  if (!mmp || !MMP_LOGOS[mmp]) return null;
  return (
    <span className={BOX}>
      <LogoImage mmp={mmp} />
    </span>
  );
}

/**
 * MMP 로고 아이콘 (hover 시 이름 툴팁).
 * 로고가 없는 MMP(Singular, Other 등)는 텍스트로 표시.
 */
export function MmpIcon({ mmp }: { mmp: string | null }) {
  if (!mmp || !MMP_LOGOS[mmp]) {
    return (
      <span className='text-xs text-muted-foreground'>{mmp ?? '-'}</span>
    );
  }
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={BOX}>
            <LogoImage mmp={mmp} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{mmp}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
