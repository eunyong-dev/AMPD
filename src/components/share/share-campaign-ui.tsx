'use client';

import { useState } from 'react';
import { GameThumbnailTooltip } from '@/components/common/game-thumbnail-tooltip';

import type { PublicGame } from '@/lib/share/public-campaign';

// 데이터 계약(타입/select)은 서버 API 와 공유 — 'use client' 가 없는 모듈에 정의
export {
  PUBLIC_CAMPAIGN_SELECT,
  type PublicGame,
  type PublicCampaign,
} from '@/lib/share/public-campaign';

export const STATUS: Record<string, { label: string; cls: string }> = {
  planning: {
    label: '계획',
    cls: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/30 dark:border-amber-900',
  },
  ongoing: {
    label: '진행중',
    cls: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-900',
  },
  holding: {
    label: '홀딩',
    cls: 'text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/30 dark:border-red-900',
  },
  end: {
    label: '종료',
    cls: 'text-muted-foreground bg-muted border-border',
  },
};

export const REGION_FLAG: Record<string, string> = {
  KR: '🇰🇷',
  JP: '🇯🇵',
  TW: '🇹🇼',
  US: '🇺🇸',
};

export const fmtPeriod = (from: string | null, to: string | null) =>
  from ? `${from} ~ ${to ?? ''}` : '-';

export function StatusBadge({ status }: { status: string | null }) {
  const s = STATUS[status ?? ''] ?? {
    label: status ?? '-',
    cls: 'text-muted-foreground bg-muted border-border',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${s.cls}`}
    >
      <span className='h-1.5 w-1.5 rounded-full bg-current opacity-70' />
      {s.label}
    </span>
  );
}

const LOGO_PLACEHOLDER = (
  <span className='h-6 w-6 flex-shrink-0 rounded border border-border bg-muted' />
);

/** 게임 로고 — URL 이 없거나 로드 실패 시 placeholder (깨진 이미지 아이콘 방지) */
function GameLogo({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return LOGO_PLACEHOLDER;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=''
      onError={() => setFailed(true)}
      className='h-6 w-6 flex-shrink-0 rounded border border-border object-cover'
    />
  );
}

/**
 * 게임 셀 — 로고 + 이름. 스토어 URL 이 있으면 hover 시 썸네일 툴팁, 클릭 시 스토어로 이동.
 */
export function GameCell({
  game,
  fallbackName,
}: {
  game: PublicGame | null;
  fallbackName: string;
}) {
  const name = game?.game_name || fallbackName;
  const logo = game?.logo_url ?? null;

  const inner = (
    <>
      <GameLogo key={logo ?? ''} src={logo} />
      <span className='truncate'>{name}</span>
    </>
  );

  if (!game?.store_url) {
    return (
      <span className='inline-flex min-w-0 items-center gap-2 align-middle'>
        {inner}
      </span>
    );
  }

  return (
    <GameThumbnailTooltip
      imageUrl={logo}
      gameName={name}
      packageIdentifier={game.package_identifier}
      storeUrl={game.store_url}
    >
      <a
        href={game.store_url}
        target='_blank'
        rel='noopener noreferrer'
        className='inline-flex min-w-0 items-center gap-2 align-middle transition-colors hover:text-primary'
      >
        {inner}
      </a>
    </GameThumbnailTooltip>
  );
}
