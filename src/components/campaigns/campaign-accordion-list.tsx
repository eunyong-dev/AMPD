'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  EditIcon,
  MoreHorizontalIcon,
  TrashIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DeleteConfirmationDialog } from '@/components/common/delete-confirmation-dialog';
import { MmpLogo } from '@/components/common/mmp-icon';
import { GameThumbnailTooltip } from '@/components/common/game-thumbnail-tooltip';
import { ServiceLink } from '@/components/common/service-favicon';
import { REGION_PRIORITY } from '@/lib/utils/campaign-sort';
import { accountUrl } from '@/lib/utils/account-url';
import { canManageResource } from '@/lib/utils/permissions';
import { cn } from '@/lib/utils';
import type { Campaign as FullCampaign } from '@/hooks/use-campaign-management';
import type { UserProfile } from '@/lib/permissions';

/**
 * 캠페인 현황 — 광고주별 아코디언 목록
 * 접힌 상태: 게임 아이콘 · 광고주명 · 시장 배지 · "N개 캠페인 · 지역"
 * 펼친 상태: 캠페인 줄 (캠페인·게임 / 리전 / MMP / 상태 / 기간 · N일째 / 시트 · JIRA)
 */

// 직접 운영하지 않는 애드네트워크 — 목록 아래 "애드네트워크" 묶음으로 따로
const AD_NETWORK_COMPANIES = new Set(['NetMarvel', 'Mobisummer']);

const MARKET_BADGE: Record<string, { label: string; cls: string }> = {
  CN: {
    label: '중화권',
    cls: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  },
  KR: {
    label: '한국',
    cls: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
  },
  JP: {
    label: '일본',
    cls: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400',
  },
  US: {
    label: '미국',
    cls: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400',
  },
};

export const STATUS_STYLE: Record<string, { label: string; dot: string; text: string }> = {
  planning: { label: '계획', dot: 'bg-yellow-500', text: 'text-yellow-700 dark:text-yellow-400' },
  ongoing: { label: '진행중', dot: 'bg-green-500', text: 'text-green-700 dark:text-green-400' },
  holding: { label: '홀딩', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
  end: { label: '종료', dot: 'bg-slate-400', text: 'text-muted-foreground' },
};

// 시안처럼 앞의 3개만 겹쳐서 — 나머지 개수(+N)는 표시하지 않음 (캠페인 수는 아래 줄에)
const MAX_ICONS = 3;

/** 목록에 필요한 필드만 — 내부 Campaign 과 공개 뷰어 캠페인 둘 다 받는다 */
export type AccordionCampaign = Pick<
  FullCampaign,
  | 'id'
  | 'name'
  | 'region'
  | 'mmp'
  | 'campaign_type'
  | 'status'
  | 'start_date'
  | 'end_date'
  | 'jira_url'
  | 'daily_report_url'
  | 'regional_game_name'
> & {
  game_id?: string | null;
  game_name?: string | null;
  game_logo_url?: string | null;
  game_store_url?: string | null;
  game_package_identifier?: string | null;
  account_company?: string | null;
  account_country?: string | null;
  assigned_user_id?: string | null;
};
type Campaign = AccordionCampaign;
const DAY_MS = 86_400_000;

export const shortDate = (d: string | null) =>
  d && !d.startsWith('1900') ? `${d.slice(2, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}` : '';

// 진행중: 시작일부터 며칠째 (시작일 = 1일째)
export function dayCount(start: string | null) {
  if (!start || start.startsWith('1900')) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const s = new Date(`${start.slice(0, 10)}T00:00:00`).getTime();
  const n = Math.floor((today.getTime() - s) / DAY_MS) + 1;
  return n > 0 ? n : null;
}

interface Group {
  company: string;
  country: string | null;
  campaigns: Campaign[];
  games: { key: string; logo: string | null; name: string }[];
  regions: string[];
}

function buildGroups(campaigns: Campaign[]): Group[] {
  const map = new Map<string, Group>();
  for (const c of campaigns) {
    const company = c.account_company ?? '';
    let g = map.get(company);
    if (!g) {
      g = {
        company,
        country: c.account_country ?? null,
        campaigns: [],
        games: [],
        regions: [],
      };
      map.set(company, g);
    }
    g.campaigns.push(c);
    const key = c.game_id ?? c.game_name ?? c.id;
    if (!g.games.some((x) => x.key === key)) {
      g.games.push({ key, logo: c.game_logo_url ?? null, name: c.game_name ?? '' });
    }
    if (c.region && !g.regions.includes(c.region)) g.regions.push(c.region);
  }
  const groups = [...map.values()];
  for (const g of groups) {
    g.regions.sort((a, b) => (REGION_PRIORITY[a] ?? 99) - (REGION_PRIORITY[b] ?? 99));
    // 캠페인은 최근 시작 순
    g.campaigns.sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''));
  }
  // 캠페인이 많은 광고주부터
  return groups.sort(
    (a, b) =>
      b.campaigns.length - a.campaigns.length ||
      a.company.localeCompare(b.company, 'ko-KR')
  );
}

export function GameIcon({ logo, name, size }: { logo: string | null; name: string; size: 'sm' | 'md' }) {
  const [failed, setFailed] = useState(false);
  const box = size === 'md' ? 'h-7 w-7 rounded-md' : 'h-6 w-6 rounded-md';
  if (!logo || failed) {
    return (
      <span
        title={name}
        className={cn(
          'relative flex flex-shrink-0 items-center justify-center bg-muted text-[11px] font-semibold text-muted-foreground ring-2 ring-card',
          box
        )}
      >
        {name.trim().charAt(0).toUpperCase() || '-'}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt={name}
      title={name}
      onError={() => setFailed(true)}
      className={cn('relative flex-shrink-0 object-cover ring-2 ring-card', box)}
    />
  );
}

// 게임명 앞 스토어 아이콘 — Google Play / App Store 파비콘
export function StoreFavicon({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  const domain = !url
    ? null
    : /play\.google\.com/i.test(url)
    ? 'play.google.com'
    : /apps\.apple\.com|itunes\.apple\.com/i.test(url)
    ? 'apps.apple.com'
    : null;
  if (!domain || failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt=''
      aria-hidden
      onError={() => setFailed(true)}
      className='h-2.5 w-2.5 flex-shrink-0 object-contain'
    />
  );
}

function GroupHeader({
  group,
  open,
  isAdNetwork,
  onToggle,
  companyHref,
}: {
  group: Group;
  open: boolean;
  isAdNetwork: boolean;
  onToggle: () => void;
  /** 광고주명을 누르면 이동할 주소 (없으면 텍스트) */
  companyHref?: string | null;
}) {
  const shown = group.games.slice(0, MAX_ICONS);
  const badge = group.country ? MARKET_BADGE[group.country] : undefined;
  return (
    <div
      role='button'
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      aria-expanded={open}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        open && 'bg-primary/5'
      )}
    >
      <div className='flex flex-shrink-0 items-center -space-x-2'>
        {shown.map((g) => (
          <GameIcon key={g.key} logo={g.logo} name={g.name} size='sm' />
        ))}
      </div>
      <div className='min-w-0'>
        <div className='flex items-center gap-2'>
          {companyHref && group.company ? (
            // 광고주명 → 광고주 페이지 (줄 접기/펼치기와 따로)
            <Link
              href={companyHref}
              onClick={(e) => e.stopPropagation()}
              className='truncate text-[13px] font-semibold hover:text-primary hover:underline'
            >
              {group.company}
            </Link>
          ) : (
            <span className='truncate text-[13px] font-semibold'>
              {group.company || '광고주 없음'}
            </span>
          )}
          {badge && (
            <span className={cn('flex-shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium', badge.cls)}>
              {badge.label}
            </span>
          )}
          {isAdNetwork && (
            <span className='flex-shrink-0 rounded-full border px-1.5 py-px text-[10px] text-muted-foreground'>
              애드네트워크
            </span>
          )}
        </div>
        <div className='text-[11px] text-muted-foreground'>
          {group.campaigns.length}개 캠페인
          {group.regions.map((r) => (
            <span key={r}> · {r}</span>
          ))}
        </div>
      </div>
      <ChevronDown
        className={cn(
          'ml-auto h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform',
          open && 'rotate-180'
        )}
      />
    </div>
  );
}

function CampaignRow({
  campaign,
  canManage,
  onEdit,
  onDelete,
  href,
  readOnly,
}: {
  campaign: Campaign;
  canManage: boolean;
  onEdit?: (c: Campaign) => void;
  onDelete: (c: Campaign) => void;
  href: string;
  readOnly: boolean;
}) {
  const status = STATUS_STYLE[campaign.status] ?? {
    label: campaign.status,
    dot: 'bg-muted-foreground',
    text: 'text-muted-foreground',
  };
  const router = useRouter();
  const gameName = campaign.regional_game_name || campaign.game_name || '-';
  const days = campaign.status === 'ongoing' ? dayCount(campaign.start_date) : null;
  const canOpen = !!campaign.daily_report_url;

  // 줄 아무 데나 누르면 성과 화면으로 (링크·버튼·메뉴를 누른 경우는 그 동작 우선)
  const handleRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canOpen) return;
    if ((e.target as HTMLElement).closest('a, button, [role="menu"], [role="menuitem"]')) return;
    if (e.metaKey || e.ctrlKey) window.open(href, '_blank');
    else router.push(href);
  };
  const ended = campaign.status === 'holding' || campaign.status === 'end';

  return (
    <div
      onClick={handleRowClick}
      // 마우스를 올리면 성과 화면 코드를 미리 받아 둔다 (눌렀을 때 바로 열리게)
      onMouseEnter={() => canOpen && router.prefetch(href)}
      title={canOpen ? undefined : '리포트 미연동 — 성과 화면 없음'}
      className={cn(
        'grid grid-cols-[minmax(240px,340px)_44px_100px_64px_150px_1fr_150px] items-center gap-x-3 px-3 py-1.5',
        canOpen ? 'cursor-pointer hover:bg-muted/50' : 'hover:bg-muted/20'
      )}
    >
      {/* 캠페인 · 게임 */}
      <div className='flex min-w-0 items-center gap-2.5'>
        {campaign.game_store_url ? (
          <a href={campaign.game_store_url} target='_blank' rel='noopener noreferrer' title='스토어에서 보기'>
            <GameIcon logo={campaign.game_logo_url ?? null} name={gameName} size='md' />
          </a>
        ) : (
          <GameIcon logo={campaign.game_logo_url ?? null} name={gameName} size='md' />
        )}
        <div className='min-w-0'>
          {campaign.daily_report_url ? (
            <Link
              href={href}
              className='block truncate text-[13px] font-medium hover:text-primary hover:underline'
            >
              {campaign.name}
            </Link>
          ) : (
            <span
              className='block truncate text-[13px] font-medium text-muted-foreground'
              title='리포트 미연동'
            >
              {campaign.name}
            </span>
          )}
          <div className='flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground'>
            {/* 게임명에 마우스를 올리면 썸네일 툴팁, 누르면 스토어 */}
            <GameThumbnailTooltip
              imageUrl={campaign.game_logo_url ?? null}
              gameName={gameName}
              packageIdentifier={campaign.game_package_identifier ?? null}
              storeUrl={campaign.game_store_url ?? null}
              enableCopy
            >
              {campaign.game_store_url ? (
                <a
                  href={campaign.game_store_url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='flex min-w-0 items-center gap-1 hover:text-foreground'
                >
                  <StoreFavicon url={campaign.game_store_url} />
                  <span className='truncate'>{gameName}</span>
                </a>
              ) : (
                <span className='truncate'>{gameName}</span>
              )}
            </GameThumbnailTooltip>
            <span className='flex-shrink-0'>· {campaign.campaign_type}</span>
          </div>
        </div>
      </div>

      {/* 리전 */}
      <div>
        <span className='rounded border px-1 py-px text-[10px] font-medium text-muted-foreground'>
          {campaign.region}
        </span>
      </div>

      {/* MMP */}
      <div className='flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground'>
        <MmpLogo mmp={campaign.mmp} small />
        <span className='truncate'>{campaign.mmp}</span>
      </div>

      {/* 상태 */}
      <div className={cn('flex items-center gap-1.5 text-xs', status.text)}>
        <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
        {status.label}
      </div>

      {/* 기간 */}
      <div className='flex items-center gap-2 whitespace-nowrap text-xs tabular-nums'>
        <span className={cn(ended ? 'text-muted-foreground' : '')}>
          {shortDate(campaign.start_date)} → {ended ? shortDate(campaign.end_date) : ''}
        </span>
        {days !== null && <span className='font-semibold'>{days}일째</span>}
      </div>

      <div />

      {/* 시트 · JIRA · 메뉴 */}
      <div className='flex items-center justify-end gap-1 text-xs'>
        <ServiceLink service='sheet' url={campaign.daily_report_url} />
        <ServiceLink service='jira' url={campaign.jira_url} />
        {!readOnly && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='icon' className='h-7 w-7'>
              <MoreHorizontalIcon className='h-4 w-4' />
              <span className='sr-only'>메뉴 열기</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='min-w-[120px]'>
            <DropdownMenuItem disabled={!canManage || !onEdit} onClick={() => onEdit?.(campaign)}>
              <EditIcon className='mr-1 h-4 w-4' />
              캠페인 수정
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canManage}
              onClick={() => onDelete(campaign)}
              className='text-red-600 focus:text-red-600'
            >
              <TrashIcon className='mr-1 h-4 w-4' />
              캠페인 삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  groups,
  openSet,
  onToggle,
  isAdNetwork,
  renderRows,
  action,
  companyHref,
}: {
  title: string;
  hint: string;
  groups: Group[];
  openSet: Set<string>;
  onToggle: (company: string) => void;
  isAdNetwork: boolean;
  renderRows: (g: Group) => React.ReactNode;
  action?: React.ReactNode;
  companyHref?: (company: string) => string | null;
}) {
  if (groups.length === 0) return null;
  return (
    <section className='space-y-1.5'>
      <div className='flex items-baseline gap-2 px-1'>
        <h2 className='text-sm font-semibold'>{title}</h2>
        <span className='text-xs text-muted-foreground'>
          {groups.length}곳 · {hint}
        </span>
        {action && <div className='ml-auto'>{action}</div>}
      </div>
      {groups.map((g) => {
        const open = openSet.has(g.company);
        return (
          <div
            key={g.company}
            className={cn(
              'overflow-hidden rounded-xl border bg-card',
              open && 'border-primary/30 shadow-sm'
            )}
          >
            <GroupHeader
              group={g}
              open={open}
              isAdNetwork={isAdNetwork}
              onToggle={() => onToggle(g.company)}
              companyHref={companyHref?.(g.company)}
            />
            {open && renderRows(g)}
          </div>
        );
      })}
    </section>
  );
}

interface CampaignAccordionListProps<T extends AccordionCampaign> {
  campaigns: T[];
  currentUserProfile?: UserProfile | null;
  onEditCampaign?: (campaign: T) => void;
  onDeleteCampaign?: (campaignId: string) => Promise<void>;
  /** 캠페인명 링크 (기본: 내부 캠페인 상세) */
  campaignHref?: (campaign: T) => string;
  /** 공개 뷰어용 — 수정·삭제 메뉴, 광고주 페이지 링크 숨김 */
  readOnly?: boolean;
  className?: string;
}

export function CampaignAccordionList<T extends AccordionCampaign>({
  campaigns,
  currentUserProfile,
  onEditCampaign,
  onDeleteCampaign,
  campaignHref = (c) => `/campaigns/${c.id}`,
  readOnly = false,
  className,
}: CampaignAccordionListProps<T>) {
  const [openSet, setOpenSet] = useState<Set<string>>(() => new Set());
  const [toDelete, setToDelete] = useState<Campaign | null>(null);

  const { advertisers, adNetworks } = useMemo(() => {
    const groups = buildGroups(campaigns);
    return {
      advertisers: groups.filter((g) => !AD_NETWORK_COMPANIES.has(g.company)),
      adNetworks: groups.filter((g) => AD_NETWORK_COMPANIES.has(g.company)),
    };
  }, [campaigns]);

  const allCompanies = [...advertisers, ...adNetworks].map((g) => g.company);
  const allOpen = allCompanies.length > 0 && allCompanies.every((c) => openSet.has(c));

  const toggle = (company: string) =>
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(company)) next.delete(company);
      else next.add(company);
      return next;
    });

  // 내부 화면: 광고주명 → 광고주 페이지 / 공개 뷰어: 링크 없음
  const companyHref = readOnly
    ? undefined
    : (company: string) => (company ? accountUrl(company) : null);

  const toggleAllButton = (
    <button
      type='button'
      onClick={() => setOpenSet(allOpen ? new Set() : new Set(allCompanies))}
      className='rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground'
    >
      {allOpen ? '모두 접기' : '모두 펼치기'}
    </button>
  );

  const renderRows = (g: Group) => (
    <div className='border-t'>
      <div className='overflow-x-auto'>
        <div className='min-w-[900px]'>
          <div className='grid grid-cols-[minmax(240px,340px)_44px_100px_64px_150px_1fr_150px] gap-x-3 border-b bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground'>
            <span>캠페인 · 게임</span>
            <span>리전</span>
            <span>MMP</span>
            <span>상태</span>
            <span>기간</span>
            <span />
            <span />
          </div>
          <div className='divide-y'>
            {g.campaigns.map((c) => (
              <CampaignRow
                key={c.id}
                campaign={c}
                canManage={canManageResource(currentUserProfile, c.assigned_user_id || '')}
                onEdit={onEditCampaign as ((c: Campaign) => void) | undefined}
                href={campaignHref(c as T)}
                readOnly={readOnly}
                onDelete={(campaign) => {
                  if (!canManageResource(currentUserProfile, campaign.assigned_user_id || '')) {
                    toast.error('본인에게 할당된 광고주의 캠페인만 삭제할 수 있습니다.');
                    return;
                  }
                  setToDelete(campaign);
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn('space-y-4', className)}>
      <Section
        title='광고주'
        hint='직거래 · 최적화 관리'
        groups={advertisers}
        openSet={openSet}
        onToggle={toggle}
        isAdNetwork={false}
        renderRows={renderRows}
        action={toggleAllButton}
        companyHref={companyHref}
      />
      <Section
        title='애드네트워크'
        hint='자동 운영 · 참고용'
        groups={adNetworks}
        openSet={openSet}
        onToggle={toggle}
        isAdNetwork
        renderRows={renderRows}
        companyHref={companyHref}
      />

      <DeleteConfirmationDialog
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await onDeleteCampaign?.(toDelete.id);
          setToDelete(null);
        }}
        title='정말 삭제하시겠습니까?'
        description={`이 작업은 되돌릴 수 없습니다. ${toDelete?.name ?? ''} 캠페인이 영구적으로 삭제됩니다.`}
        confirmLabel='삭제'
        cancelLabel='닫기'
      />
    </div>
  );
}
