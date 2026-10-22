'use client';

import { useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// MMP → 공식 사이트 도메인. 아이콘은 사이트 파비콘을 그대로 쓴다 (로고 파일 관리 불필요)
// 새 MMP 는 여기에 도메인만 추가하면 된다 — 앱 전체 MMP 아이콘의 단일 소스
const MMP_DOMAINS: Record<string, string> = {
  AppsFlyer: 'appsflyer.com',
  Adjust: 'adjust.com',
  Singular: 'singular.net',
  Tenjin: 'tenjin.com',
  Branch: 'branch.io',
  Kochava: 'kochava.com',
};

const faviconUrl = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

// align-middle: 표 셀(text-center)처럼 인라인으로 놓일 때 행 중앙에 맞춤 (flex 안에선 무시됨)
const BOX =
  'inline-flex h-5 w-5 flex-shrink-0 items-center justify-center align-middle';

/** 파비콘 (불러오지 못하면 MMP 이름 첫 글자) */
function Favicon({ mmp, small = false }: { mmp: string; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  const size = small ? 'h-3.5 w-3.5' : 'h-5 w-5';
  if (failed) {
    return (
      <span className={`flex ${size} items-center justify-center rounded bg-muted text-[9px] font-semibold text-muted-foreground`}>
        {mmp.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={faviconUrl(MMP_DOMAINS[mmp])}
      alt={mmp}
      width={20}
      height={20}
      onError={() => setFailed(true)}
      className={`${size} rounded object-contain`}
    />
  );
}

/** 로고 이미지만 (툴팁 없음). 도메인을 모르는 MMP 면 null — Select 옵션 등에 사용. small: 14px */
export function MmpLogo({
  mmp,
  small = false,
}: {
  mmp: string | null;
  small?: boolean;
}) {
  if (!mmp || !MMP_DOMAINS[mmp]) return null;
  return (
    <span
      className={
        small
          ? 'inline-flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center align-middle'
          : BOX
      }
    >
      <Favicon mmp={mmp} small={small} />
    </span>
  );
}

/**
 * MMP 아이콘 (hover 시 이름 툴팁).
 * 도메인을 모르는 MMP(Other 등)는 텍스트로 표시.
 */
export function MmpIcon({ mmp }: { mmp: string | null }) {
  if (!mmp || !MMP_DOMAINS[mmp]) {
    return (
      <span className='text-xs text-muted-foreground'>{mmp ?? '-'}</span>
    );
  }
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={BOX}>
            <Favicon mmp={mmp} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{mmp}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
