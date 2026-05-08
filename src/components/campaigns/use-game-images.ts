'use client';

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { Game } from '@/hooks/use-game-management';

export function useGameImages(games: Game[]) {
  const queries = useQueries({
    queries: games.map((game) => ({
      queryKey: ['game-info', game.store_url],
      queryFn: async () => {
        if (!game.store_url) return { logo_url: null };
        const response = await fetch('/api/fetch-game-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: game.store_url }),
        });
        if (!response.ok) return { logo_url: null };
        const result = await response.json();
        return result.data || { logo_url: null };
      },
      enabled: !!game.store_url,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 1,
    })),
  });

  return useMemo(() => {
    const map: Record<string, string | null> = {};
    games.forEach((game, idx) => {
      map[game.id] = queries[idx]?.data?.logo_url ?? null;
    });
    return map;
  }, [games, queries]);
}
