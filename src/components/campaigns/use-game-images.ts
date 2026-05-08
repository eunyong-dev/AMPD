'use client';

import { useMemo } from 'react';
import type { Game } from '@/hooks/use-game-management';

/**
 * 게임 ID → logo_url 매핑 (DB의 logo_url 만 사용).
 *
 * logo_url이 비어있는 레거시 게임은 NULL 반환 — 호출자가 placeholder 표시.
 * 일괄 backfill은 /settings 페이지의 "Refresh missing logos" 버튼으로 가능.
 */
export function useGameImages(games: Game[]) {
  return useMemo(() => {
    const map: Record<string, string | null> = {};
    games.forEach((game) => {
      map[game.id] = game.logo_url ?? null;
    });
    return map;
  }, [games]);
}
