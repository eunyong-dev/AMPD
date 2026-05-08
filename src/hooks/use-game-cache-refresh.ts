'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';
import { convertStoreUrlByRegion } from '@/lib/store-url-utils';

export interface PhaseProgress {
  total: number;
  done: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface RefreshProgress {
  logos: PhaseProgress;
  names: PhaseProgress;
}

const emptyPhase = (): PhaseProgress => ({
  total: 0,
  done: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
});

const CONCURRENCY = 4;

async function fetchGameInfo(url: string): Promise<{
  game_name?: string;
  logo_url?: string;
} | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch('/api/fetch-game-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, noCache: true }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface UseGameCacheRefreshOptions {
  /** 특정 account의 게임/캠페인만 backfill (없으면 전체) */
  accountId?: string;
}

export function useGameCacheRefresh(options?: UseGameCacheRefreshOptions) {
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState<RefreshProgress | null>(null);

  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setProgress(null);

    try {
      const supabase = createClient();
      const accountId = options?.accountId;

      // Phase 1: 게임 logo_url backfill 대상
      let gamesQuery = supabase
        .from('games')
        .select('id, game_name, store_url, logo_url');
      if (accountId) gamesQuery = gamesQuery.eq('account_id', accountId);
      const { data: games, error: gamesError } = await gamesQuery;

      if (gamesError) {
        toast.error(`Failed to load games: ${gamesError.message}`);
        return;
      }

      // store_url이 있는 모든 게임을 갱신 — 외부 데이터가 변경됐을 수 있으므로
      // 기존 logo_url이 있어도 다시 fetch해서 최신화. fetch 실패 시 기존 값 유지.
      const logoTargets = (games ?? []).filter((g) => !!g.store_url);

      // Phase 2: 캠페인 regional_game_name backfill 대상
      let campaignsQuery = supabase
        .from('campaigns')
        .select('id, name, region, regional_game_name, account_id, games(store_url)');
      if (accountId) campaignsQuery = campaignsQuery.eq('account_id', accountId);
      const { data: campaigns, error: campaignsError } = await campaignsQuery;

      if (campaignsError) {
        toast.error(`Failed to load campaigns: ${campaignsError.message}`);
        return;
      }

      // store_url + region이 있는 모든 캠페인을 갱신 — 게임 이름이 변경됐을 수 있으므로
      const nameTargets = (campaigns ?? [])
        .filter((c: any) => c.games?.store_url && c.region)
        .map((c: any) => ({
          id: c.id as string,
          name: c.name as string,
          region: c.region as string,
          store_url: c.games.store_url as string,
        }));

      if (logoTargets.length === 0 && nameTargets.length === 0) {
        toast.success('Nothing to refresh.');
        setProgress(null);
        return;
      }

      setProgress({
        logos: { ...emptyPhase(), total: logoTargets.length },
        names: { ...emptyPhase(), total: nameTargets.length },
      });

      // Phase 1: logos
      const logoQueue = [...logoTargets];
      const logoWorker = async () => {
        while (logoQueue.length > 0) {
          const game = logoQueue.shift();
          if (!game) break;
          try {
            const info = await fetchGameInfo(game.store_url!);
            if (!info?.logo_url) {
              setProgress((p) =>
                p
                  ? {
                      ...p,
                      logos: {
                        ...p.logos,
                        done: p.logos.done + 1,
                        skipped: p.logos.skipped + 1,
                      },
                    }
                  : p
              );
              continue;
            }
            const { error: upErr } = await supabase
              .from('games')
              .update({ logo_url: info.logo_url })
              .eq('id', game.id);
            if (upErr) throw upErr;
            setProgress((p) =>
              p
                ? {
                    ...p,
                    logos: {
                      ...p.logos,
                      done: p.logos.done + 1,
                      updated: p.logos.updated + 1,
                    },
                  }
                : p
            );
          } catch (err) {
            console.error(`Logo failed for ${game.game_name}:`, err);
            setProgress((p) =>
              p
                ? {
                    ...p,
                    logos: {
                      ...p.logos,
                      done: p.logos.done + 1,
                      failed: p.logos.failed + 1,
                    },
                  }
                : p
            );
          }
        }
      };

      await Promise.all(
        Array.from(
          { length: Math.min(CONCURRENCY, logoTargets.length) },
          logoWorker
        )
      );

      // Phase 2: regional names
      const nameQueue = [...nameTargets];
      const nameWorker = async () => {
        while (nameQueue.length > 0) {
          const target = nameQueue.shift();
          if (!target) break;
          try {
            const regionalUrl = convertStoreUrlByRegion(
              target.store_url,
              target.region
            );
            if (!regionalUrl) {
              setProgress((p) =>
                p
                  ? {
                      ...p,
                      names: {
                        ...p.names,
                        done: p.names.done + 1,
                        skipped: p.names.skipped + 1,
                      },
                    }
                  : p
              );
              continue;
            }
            const info = await fetchGameInfo(regionalUrl);
            if (!info?.game_name) {
              setProgress((p) =>
                p
                  ? {
                      ...p,
                      names: {
                        ...p.names,
                        done: p.names.done + 1,
                        skipped: p.names.skipped + 1,
                      },
                    }
                  : p
              );
              continue;
            }
            const { error: upErr } = await supabase
              .from('campaigns')
              .update({ regional_game_name: info.game_name })
              .eq('id', target.id);
            if (upErr) throw upErr;
            setProgress((p) =>
              p
                ? {
                    ...p,
                    names: {
                      ...p.names,
                      done: p.names.done + 1,
                      updated: p.names.updated + 1,
                    },
                  }
                : p
            );
          } catch (err) {
            console.error(`Name failed for ${target.name}:`, err);
            setProgress((p) =>
              p
                ? {
                    ...p,
                    names: {
                      ...p.names,
                      done: p.names.done + 1,
                      failed: p.names.failed + 1,
                    },
                  }
                : p
            );
          }
        }
      };

      await Promise.all(
        Array.from(
          { length: Math.min(CONCURRENCY, nameTargets.length) },
          nameWorker
        )
      );

      setProgress((p) => {
        if (!p) return p;
        const totalUpdated = p.logos.updated + p.names.updated;
        const totalFailed = p.logos.failed + p.names.failed;
        toast.success(
          `Refresh complete: ${totalUpdated} updated${
            totalFailed > 0 ? `, ${totalFailed} failed` : ''
          }.`
        );
        return p;
      });
    } catch (err) {
      toast.error(
        `Refresh failed: ${err instanceof Error ? err.message : 'Unknown'}`
      );
    } finally {
      setRefreshing(false);
    }
  }, [options?.accountId, refreshing]);

  return { refresh, refreshing, progress };
}
