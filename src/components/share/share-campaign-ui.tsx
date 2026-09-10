'use client';

import { useEffect, useState } from 'react';
import { GameThumbnailTooltip } from '@/components/common/game-thumbnail-tooltip';

import { createClient } from '@/utils/supabase/client';
import type { CampaignListItem } from '@/components/campaigns/campaign-detail/campaign-switcher';
import {
  PUBLIC_CAMPAIGN_SELECT,
  type PublicCampaign,
  type PublicGame,
} from '@/lib/share/public-campaign';

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

// 목록의 필터 쿼리(?status=&advertiser=...) — 성과 뷰어에서 같은 필터로 돌아가기 위해 기억.
// 탭 단위(sessionStorage)가 아니라 브라우저 단위(localStorage) → 캠페인을 새 탭으로 열어도 유지
const LIST_QUERY_KEY = 'share:campaigns:listQuery';

export function rememberShareListQuery(search: string) {
  try {
    localStorage.setItem(LIST_QUERY_KEY, search);
  } catch {
    // 저장소 접근 불가(프라이빗 모드 등) — 기본 목록으로 돌아가면 됨
  }
}

/** "← 캠페인 현황" 링크 주소 — 마지막으로 본 목록 필터 유지 */
export function useShareListHref() {
  const [href, setHref] = useState('/share/campaigns');
  useEffect(() => {
    try {
      const q = localStorage.getItem(LIST_QUERY_KEY);
      if (q && q.startsWith('?')) setHref(`/share/campaigns${q}`);
    } catch {
      // 저장소 접근 불가 — 기본 목록 주소 유지
    }
  }, []);
  return href;
}

/** 캠페인 전환(CampaignSwitcher) 공개 모드 — 로그인 없이, 공개 목록과 같은 필드만 조회 */
export async function loadPublicSwitcherCampaigns(): Promise<
  CampaignListItem[]
> {
  const { data, error } = await createClient()
    .from('campaigns')
    .select(PUBLIC_CAMPAIGN_SELECT);
  if (error) throw error;
  return ((data ?? []) as unknown as PublicCampaign[]).map((c) => ({
    id: c.id,
    name: c.name,
    account_company: c.account?.company ?? null,
    region: c.region,
    status: c.status ?? '',
    game_logo_url: c.game?.logo_url ?? null,
    game_name: c.game?.game_name ?? null,
  }));
}

/** 공개 성과 뷰어 주소 */
export const shareCampaignHref = (id: string) => `/share/campaigns/${id}`;

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
