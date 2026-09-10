'use client';

/**
 * 캠페인 상세 페이지 상단의 캠페인명 셀에 사용되는 빠른 전환 컴포넌트.
 * - 클릭 시 popover 열림 → 검색 가능한 캠페인 리스트
 * - 선택 시 해당 캠페인 상세 페이지로 이동
 *
 * 권한 정책 — 관리자는 전체, AM 은 본인 담당 만 (`getCampaignList` 로 분기됨)
 * 공개 뷰어 — loadList(공개 목록 조회) + hrefFor(/share/campaigns/[id]) 를 넘겨 로그인 없이 사용
 */

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ChevronsUpDown, Search } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import {
  getAllCampaigns,
  getMyCampaigns,
  type Campaign,
} from '@/hooks/use-campaign-management';
import { useUserContext } from '@/lib/user-context';

interface CampaignSwitcherProps {
  /** 현재 선택된 캠페인 — 트리거에 표시 */
  currentCampaign: Pick<Campaign, 'id' | 'name'> & {
    account_company?: string | null;
    region?: string | null;
  };
  /** 리스트 로더 — 지정 시 권한별 조회 대신 사용 (공개 뷰어) */
  loadList?: () => Promise<CampaignListItem[]>;
  /** 선택 시 이동할 주소 — 기본: 내부 상세 /campaigns/[id] */
  hrefFor?: (id: string) => string;
}

export interface CampaignListItem {
  id: string;
  name: string;
  account_company: string | null;
  region: string | null;
  status: string;
  game_logo_url: string | null;
  game_name: string | null;
}

const STATUS_DOT_COLOR: Record<string, string> = {
  ongoing: 'bg-green-500',
  planning: 'bg-yellow-500',
  holding: 'bg-red-500',
  end: 'bg-gray-400',
};

export function CampaignSwitcher({
  currentCampaign,
  loadList,
  hrefFor,
}: CampaignSwitcherProps) {
  const router = useRouter();
  const { profile } = useUserContext();
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignListItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // 캠페인 리스트 fetch (popover 처음 열릴 때만)
  // - loadList 가 있으면 그것으로 (공개 뷰어: 로그인 없이 공개 목록)
  // - 없으면 권한별 (관리자 전체 / AM 본인 담당)
  const loadCampaigns = useCallback(async () => {
    if (!loadList && !profile) return;
    setLoading(true);
    try {
      let compact: CampaignListItem[];
      if (loadList) {
        compact = await loadList();
      } else if (profile) {
        const list =
          profile.role === 'admin'
            ? await getAllCampaigns()
            : await getMyCampaigns(profile.id);
        compact = list.map((c) => ({
          id: c.id,
          name: c.name,
          account_company: c.account_company ?? null,
          region: c.region ?? null,
          status: c.status,
          game_logo_url: c.game_logo_url ?? null,
          game_name: c.game_name ?? null,
        }));
      } else {
        return;
      }
      // 정렬: 광고주 → status 우선순위 → 게임명 → 지역 우선순위(KR→JP→TW→US...)
      const statusOrder: Record<string, number> = {
        ongoing: 0,
        planning: 1,
        holding: 2,
        end: 3,
      };
      const regionOrder: Record<string, number> = {
        KR: 0,
        JP: 1,
        TW: 2,
        US: 3,
      };
      // 이름에서 지역 접미사(_KR 등)를 뗀 게임 기준명
      const baseName = (c: CampaignListItem) =>
        c.region ? c.name.replace(new RegExp(`_${c.region}$`), '') : c.name;
      compact.sort((a, b) => {
        // 1) 광고주(회사)명 기준 그룹
        const companyCmp = (a.account_company ?? '').localeCompare(
          b.account_company ?? ''
        );
        if (companyCmp !== 0) return companyCmp;
        // 2) 상태
        const aS = statusOrder[a.status] ?? 99;
        const bS = statusOrder[b.status] ?? 99;
        if (aS !== bS) return aS - bS;
        // 3) 게임명
        const nameCmp = baseName(a).localeCompare(baseName(b));
        if (nameCmp !== 0) return nameCmp;
        // 4) 지역
        const aR = regionOrder[a.region ?? ''] ?? 99;
        const bR = regionOrder[b.region ?? ''] ?? 99;
        if (aR !== bR) return aR - bR;
        return (a.region ?? '').localeCompare(b.region ?? '');
      });
      setCampaigns(compact);
    } catch (e) {
      console.error('캠페인 리스트 로드 실패:', e);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [profile, loadList]);

  // popover 열릴 때 fetch + input focus
  useEffect(() => {
    if (open) {
      if (!campaigns) loadCampaigns();
      // input focus (다음 tick)
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setHighlightIdx(0);
    }
  }, [open, campaigns, loadCampaigns]);

  // 검색 필터
  const filtered = useMemo(() => {
    if (!campaigns) return [];
    const q = query.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter((c) => {
      const haystack = [
        c.name,
        c.account_company ?? '',
        c.region ?? '',
        c.game_name ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [campaigns, query]);

  // 검색어 바뀌면 highlight 첫 항목으로
  useEffect(() => {
    setHighlightIdx(0);
  }, [query]);

  // 처음 열릴 때 현재 캠페인에 highlight 맞춤
  useEffect(() => {
    if (!open || !campaigns) return;
    const idx = filtered.findIndex((c) => c.id === currentCampaign.id);
    if (idx >= 0) setHighlightIdx(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campaigns]);

  // highlight 변경 시 해당 아이템 보이도록 스크롤
  useEffect(() => {
    const el = itemRefs.current[highlightIdx];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx]);

  const handleSelect = useCallback(
    (id: string) => {
      if (id === currentCampaign.id) {
        setOpen(false);
        return;
      }
      setOpen(false);
      router.push(hrefFor ? hrefFor(id) : `/campaigns/${id}`);
    },
    [currentCampaign.id, router, hrefFor]
  );

  // 키보드 네비게이션 (input 에서 발생) — Popover 의 기본 focus 가두기 회피
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (filtered.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx((prev) =>
          prev < filtered.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx((prev) =>
          prev > 0 ? prev - 1 : filtered.length - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const target = filtered[highlightIdx];
        if (target) handleSelect(target.id);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setHighlightIdx(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setHighlightIdx(filtered.length - 1);
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        setHighlightIdx((prev) =>
          Math.min(prev + 5, filtered.length - 1)
        );
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        setHighlightIdx((prev) => Math.max(prev - 5, 0));
      }
    },
    [filtered, highlightIdx, handleSelect]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type='button'
          className='group flex items-center gap-1.5 text-sm font-medium truncate hover:text-primary transition-colors text-left w-full'
          title='캠페인 전환'
        >
          <span className='truncate'>{currentCampaign.name || '-'}</span>
          <ChevronsUpDown className='h-3.5 w-3.5 flex-shrink-0 opacity-50 group-hover:opacity-100' />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className='w-[400px] p-0 rounded-xl overflow-hidden'
        align='start'
      >
        {/* 검색 */}
        <div className='border-b p-2'>
          <div className='relative'>
            <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none' />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='캠페인 / 광고주 / 게임 / 지역 검색...'
              className='h-9 pl-8 text-sm'
            />
          </div>
        </div>

        {/* 리스트 — 상단 패딩 제거(sticky 헤더가 검색창에 밀착) */}
        <div ref={listRef} className='max-h-[400px] overflow-y-auto px-1 pb-1'>
          {loading && (
            <div className='px-3 py-6 text-center text-xs text-muted-foreground'>
              불러오는 중...
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className='px-3 py-6 text-center text-xs text-muted-foreground'>
              {query ? '일치하는 캠페인 없음' : '캠페인 없음'}
            </div>
          )}
          {!loading &&
            filtered.map((c, idx) => {
              const isCurrent = c.id === currentCampaign.id;
              const isHighlighted = idx === highlightIdx;
              // 광고주가 바뀌는 지점마다 그룹 헤더 삽입
              const company = c.account_company || '기타';
              const showHeader =
                idx === 0 ||
                (filtered[idx - 1].account_company || '기타') !== company;
              return (
                <Fragment key={c.id}>
                  {showHeader && (
                    <div
                      className={`sticky top-0 z-10 bg-background px-2 pb-1 text-[11px] font-semibold text-muted-foreground ${
                        idx === 0 ? 'pt-1' : 'pt-2'
                      }`}
                    >
                      {company}
                    </div>
                  )}
                  <button
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    type='button'
                    onClick={() => handleSelect(c.id)}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    className={`w-full text-left px-2 py-2 text-sm flex items-center gap-2.5 rounded-xl transition-colors ${
                      isHighlighted
                        ? 'bg-accent text-accent-foreground'
                        : isCurrent
                        ? 'bg-accent/40'
                        : 'hover:bg-accent/60'
                    }`}
                  >
                  {/* 게임 로고 */}
                  {c.game_logo_url ? (
                    <div className='w-7 h-7 rounded-lg border border-border overflow-hidden flex items-center justify-center bg-muted flex-shrink-0'>
                      <Image
                        src={c.game_logo_url}
                        alt={c.game_name || c.name}
                        width={28}
                        height={28}
                        className='max-w-full max-h-full w-auto h-auto object-contain'
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className='w-7 h-7 rounded-lg border border-border bg-muted flex items-center justify-center flex-shrink-0'>
                      <span className='text-[9px] text-muted-foreground'>-</span>
                    </div>
                  )}

                  {/* 텍스트 영역 */}
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-1.5'>
                      <span
                        className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                          STATUS_DOT_COLOR[c.status] || 'bg-gray-300'
                        }`}
                        title={c.status}
                      />
                      <span
                        className={`truncate ${
                          isCurrent ? 'font-semibold' : 'font-medium'
                        }`}
                      >
                        {c.name}
                      </span>
                    </div>
                    {c.region && (
                      <div className='text-xs text-muted-foreground truncate pl-3'>
                        {c.region}
                      </div>
                    )}
                  </div>

                  {isCurrent && (
                    <span className='text-[10px] text-primary font-semibold flex-shrink-0 px-2 py-0.5 rounded-full bg-primary/10'>
                      현재
                    </span>
                  )}
                  </button>
                </Fragment>
              );
            })}
        </div>

        {/* 푸터 */}
        {!loading && campaigns && campaigns.length > 0 && (
          <div className='border-t px-3 py-2 text-[10px] text-muted-foreground'>
            총 {campaigns.length}개
            {query ? ` · 검색 결과 ${filtered.length}개` : ''}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
