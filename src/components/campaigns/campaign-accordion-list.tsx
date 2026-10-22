'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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
import { ReportSheetBadge } from '@/components/common/report-sheet-badge';
import { REGION_PRIORITY } from '@/lib/utils/campaign-sort';
import { accountUrl } from '@/lib/utils/account-url';
import { canManageResource } from '@/lib/utils/permissions';
import { cn } from '@/lib/utils';
import type { Campaign } from '@/hooks/use-campaign-management';
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

const STATUS_STYLE: Record<string, { label: string; dot: string; text: string }> = {
  planning: { label: '계획', dot: 'bg-yellow-500', text: 'text-yellow-700 dark:text-yellow-400' },
  ongoing: { label: '진행중', dot: 'bg-green-500', text: 'text-green-700 dark:text-green-400' },
  holding: { label: '홀딩', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
  end: { label: '종료', dot: 'bg-slate-400', text: 'text-muted-foreground' },
};

const MAX_ICONS = 4;
const DAY_MS = 86_400_000;

const shortDate = (d: string | null) =>
  d && !d.startsWith('1900') ? `${d.slice(2, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}` : '';

// 진행중: 시작일부터 며칠째 (시작일 = 1일째)
function dayCount(start: string | null) {
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

function GameIcon({ logo, name, size }: { logo: string | null; name: string; size: 'sm' | 'md' }) {
  const [failed, setFailed] = useState(false);
  const box = size === 'md' ? 'h-8 w-8 rounded-lg' : 'h-7 w-7 rounded-lg';
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

function GroupHeader({
  group,
  open,
  isAdNetwork,
  onToggle,
}: {
  group: Group;
  open: boolean;
  isAdNetwork: boolean;
  onToggle: () => void;
}) {
  const shown = group.games.slice(0, MAX_ICONS);
  const rest = group.games.length - shown.length;
  const badge = group.country ? MARKET_BADGE[group.country] : undefined;
  return (
    <button
      type='button'
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40',
        open && 'bg-primary/5'
      )}
    >
      <div className='flex flex-shrink-0 items-center -space-x-2'>
        {shown.map((g) => (
          <GameIcon key={g.key} logo={g.logo} name={g.name} size='sm' />
        ))}
        {rest > 0 && (
          <span className='relative flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-card'>
            +{rest}
          </span>
        )}
      </div>
      <div className='min-w-0'>
        <div className='flex items-center gap-2'>
          <span className='truncate text-sm font-semibold'>
            {group.company || '광고주 없음'}
          </span>
          {badge && (
            <span className={cn('flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', badge.cls)}>
              {badge.label}
            </span>
          )}
          {isAdNetwork && (
            <span className='flex-shrink-0 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground'>
              애드네트워크
            </span>
          )}
        </div>
        <div className='text-xs text-muted-foreground'>
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
    </button>
  );
}

function CampaignRow({
  campaign,
  canManage,
  onEdit,
  onDelete,
}: {
  campaign: Campaign;
  canManage: boolean;
  onEdit?: (c: Campaign) => void;
  onDelete: (c: Campaign) => void;
}) {
  const status = STATUS_STYLE[campaign.status] ?? {
    label: campaign.status,
    dot: 'bg-muted-foreground',
    text: 'text-muted-foreground',
  };
  const gameName = campaign.regional_game_name || campaign.game_name || '-';
  const days = campaign.status === 'ongoing' ? dayCount(campaign.start_date) : null;
  const ended = campaign.status === 'holding' || campaign.status === 'end';

  return (
    <div className='grid grid-cols-[minmax(240px,2.4fr)_64px_minmax(110px,1fr)_84px_minmax(170px,1.2fr)_168px] items-center gap-x-4 px-4 py-2.5 hover:bg-muted/30'>
      {/* 캠페인 · 게임 */}
      <div className='flex min-w-0 items-center gap-3'>
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
              href={`/campaigns/${campaign.id}`}
              className='flex min-w-0 items-center gap-1.5 text-sm font-medium hover:text-primary hover:underline'
            >
              <ReportSheetBadge connected />
              <span className='truncate'>{campaign.name}</span>
            </Link>
          ) : (
            <span
              className='flex min-w-0 items-center gap-1.5 text-sm font-medium text-muted-foreground'
              title='리포트 미연동'
            >
              <ReportSheetBadge connected={false} />
              <span className='truncate'>{campaign.name}</span>
            </span>
          )}
          <div className='truncate text-xs text-muted-foreground'>
            {gameName} · {campaign.campaign_type}
          </div>
        </div>
      </div>

      {/* 리전 */}
      <div>
        <span className='rounded-md border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground'>
          {campaign.region}
        </span>
      </div>

      {/* MMP */}
      <div className='flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground'>
        <MmpLogo mmp={campaign.mmp} />
        <span className='truncate'>{campaign.mmp}</span>
      </div>

      {/* 상태 */}
      <div className={cn('flex items-center gap-1.5 text-sm', status.text)}>
        <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
        {status.label}
      </div>

      {/* 기간 */}
      <div className='flex items-center gap-2 whitespace-nowrap text-sm tabular-nums'>
        <span className={cn(ended ? 'text-muted-foreground' : '')}>
          {shortDate(campaign.start_date)} → {ended ? shortDate(campaign.end_date) : ''}
        </span>
        {days !== null && <span className='font-semibold'>{days}일째</span>}
      </div>

      {/* 시트 · JIRA · 메뉴 */}
      <div className='flex items-center justify-end gap-3 text-xs'>
        {campaign.daily_report_url && (
          <a
            href={campaign.daily_report_url}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center gap-1 text-muted-foreground hover:text-foreground'
          >
            <ReportSheetBadge connected />
            시트
          </a>
        )}
        {campaign.jira_url && (
          <a
            href={campaign.jira_url}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center gap-1 text-muted-foreground hover:text-foreground'
          >
            <svg viewBox='0 0 24 24' className='h-3.5 w-3.5 text-blue-600' fill='currentColor' aria-hidden>
              <path d='M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 0 0-.84-.84H11.53ZM6.77 6.8a4.36 4.36 0 0 0 4.34 4.34h1.8v1.72a4.36 4.36 0 0 0 4.34 4.34V7.63a.84.84 0 0 0-.83-.83H6.77ZM2 11.6c0 2.4 1.95 4.34 4.35 4.34h1.78v1.72c.01 2.39 1.95 4.33 4.34 4.34v-9.57a.84.84 0 0 0-.84-.84H2Z' />
            </svg>
            JIRA
          </a>
        )}
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
}: {
  title: string;
  hint: string;
  groups: Group[];
  openSet: Set<string>;
  onToggle: (company: string) => void;
  isAdNetwork: boolean;
  renderRows: (g: Group) => React.ReactNode;
  action?: React.ReactNode;
}) {
  if (groups.length === 0) return null;
  return (
    <section className='space-y-2'>
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
            <GroupHeader group={g} open={open} isAdNetwork={isAdNetwork} onToggle={() => onToggle(g.company)} />
            {open && renderRows(g)}
          </div>
        );
      })}
    </section>
  );
}

interface CampaignAccordionListProps {
  campaigns: Campaign[];
  currentUserProfile?: UserProfile | null;
  onEditCampaign?: (campaign: Campaign) => void;
  onDeleteCampaign: (campaignId: string) => Promise<void>;
  className?: string;
}

export function CampaignAccordionList({
  campaigns,
  currentUserProfile,
  onEditCampaign,
  onDeleteCampaign,
  className,
}: CampaignAccordionListProps) {
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
        <div className='min-w-[860px]'>
          <div className='grid grid-cols-[minmax(240px,2.4fr)_64px_minmax(110px,1fr)_84px_minmax(170px,1.2fr)_168px] gap-x-4 border-b bg-muted/30 px-4 py-1.5 text-[11px] font-medium text-muted-foreground'>
            <span>캠페인 · 게임</span>
            <span>리전</span>
            <span>MMP</span>
            <span>상태</span>
            <span>기간</span>
            <span />
          </div>
          <div className='divide-y'>
            {g.campaigns.map((c) => (
              <CampaignRow
                key={c.id}
                campaign={c}
                canManage={canManageResource(currentUserProfile, c.assigned_user_id || '')}
                onEdit={onEditCampaign}
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
      {g.company && (
        <div className='border-t px-4 py-2 text-right'>
          <Link href={accountUrl(g.company)} className='text-xs text-muted-foreground hover:text-foreground hover:underline'>
            {g.company} 광고주 페이지 →
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <div className={cn('space-y-5', className)}>
      <Section
        title='광고주'
        hint='직거래 · 최적화 관리'
        groups={advertisers}
        openSet={openSet}
        onToggle={toggle}
        isAdNetwork={false}
        renderRows={renderRows}
        action={toggleAllButton}
      />
      <Section
        title='애드네트워크'
        hint='자동 운영 · 참고용'
        groups={adNetworks}
        openSet={openSet}
        onToggle={toggle}
        isAdNetwork
        renderRows={renderRows}
      />

      <DeleteConfirmationDialog
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await onDeleteCampaign(toDelete.id);
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
