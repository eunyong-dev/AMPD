'use client';

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  TrashIcon,
  EditIcon,
  MoreHorizontalIcon,
  ExternalLinkIcon,
  Copy,
  Check,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import type { Campaign } from '@/hooks/use-campaign-management';
import type { UserProfile } from '@/lib/permissions';
import {
  CAMPAIGN_STATUS_OPTIONS,
  CAMPAIGN_TYPE_OPTIONS,
  MMP_OPTIONS,
  REGION_OPTIONS,
} from '@/hooks/use-campaign-management';
import { convertStoreUrlByRegion } from '@/lib/store-url-utils';
import { formatDateYYYYMMDD } from '@/lib/utils/date';
import { canManageResource } from '@/lib/utils/permissions';
import {
  compareByNameAndRegion,
  REGION_PRIORITY,
} from '@/lib/utils/campaign-sort';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TableWrapper, TABLE_STYLES } from '@/components/common/table-wrapper';
import { DeleteConfirmationDialog } from '@/components/common/delete-confirmation-dialog';
import { GameThumbnailTooltip } from '@/components/common/game-thumbnail-tooltip';
import { MmpIcon } from '@/components/common/mmp-icon';
import { ReportSheetBadge } from '@/components/common/report-sheet-badge';
import { accountUrl } from '@/lib/utils/account-url';
import { cn } from '@/lib/utils';
import { periodSummary } from '@/lib/utils/period-summary';
import Link from 'next/link';

// 상수 정의
const COLUMN_WIDTHS = {
  campaignTitle: '200px',
  campaignWithGame: '340px',
  account: '150px',
  gameName: '250px',
  assignedUser: '130px',
  region: '120px',
  mmp: '80px',
  type: '120px',
  dateRange: '200px',
  status: '100px',
  jiraUrl: '100px',
  dailyReportUrl: '100px',
  actions: '60px',
} as const;

const COPY_RESET_DELAY = 2000;

// 타입 정의
type StatusDisplay = {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  color: string;
};

// 유틸리티 함수들
function getStatusDisplay(status: string | null): StatusDisplay {
  const statusOption = CAMPAIGN_STATUS_OPTIONS.find(
    (option) => option.value === status
  );
  if (!statusOption) {
    return { label: '알 수 없음', variant: 'outline', color: '' };
  }

  const variantMap: Record<string, 'outline'> = {
    planning: 'outline',
    ongoing: 'outline',
    holding: 'outline',
    end: 'outline',
  };

  const colorMap: Record<string, string> = {
    planning:
      'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
    ongoing:
      'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
    holding: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
    end: 'bg-slate-100 text-slate-500 dark:bg-slate-500/10 dark:text-slate-400',
  };

  const koLabel: Record<string, string> = {
    planning: '계획',
    ongoing: '진행중',
    holding: '홀딩',
    end: '종료',
  };

  return {
    label: koLabel[status || ''] ?? statusOption.label,
    variant: variantMap[status || ''] || 'outline',
    color: colorMap[status || ''] || '',
  };
}

function getTypeDisplay(type: string | null): string {
  const typeOption = CAMPAIGN_TYPE_OPTIONS.find(
    (option) => option.value === type
  );
  return typeOption?.label || type || '알 수 없음';
}

function getRegionDisplay(region: string | null): string {
  if (!region) return '알 수 없음';

  const regionEmojiMap: Record<string, string> = {
    KR: '🇰🇷',
    JP: '🇯🇵',
    TW: '🇹🇼',
    US: '🇺🇸',
  };

  const emoji = regionEmojiMap[region] || '';
  return emoji ? `${emoji} ${region}` : region;
}

function getMMPDisplay(mmp: string | null): string {
  const mmpOption = MMP_OPTIONS.find((option) => option.value === mmp);
  return mmpOption?.label || mmp || '알 수 없음';
}

// 컴포넌트: Game Image Cell
interface GameImageCellProps {
  imageUrl: string | null;
  imageLoading: boolean;
  alt: string;
}

const GameImageCell = React.memo(
  ({ imageUrl, imageLoading, alt }: GameImageCellProps) => {
    if (imageLoading) {
      return (
        <div className='w-6 h-6 rounded-lg border border-border bg-muted flex items-center justify-center animate-pulse flex-shrink-0'>
          <span className='text-[8px] text-muted-foreground'>...</span>
        </div>
      );
    }

    if (imageUrl) {
      return (
        <div className='w-6 h-6 rounded-lg border border-border overflow-hidden flex items-center justify-center bg-muted flex-shrink-0'>
          <Image
            src={imageUrl}
            alt={alt}
            width={24}
            height={24}
            className='max-w-full max-h-full w-auto h-auto object-contain'
            unoptimized
          />
        </div>
      );
    }

    return (
      <div className='w-6 h-6 rounded-lg border border-border bg-muted flex items-center justify-center flex-shrink-0'>
        <span className='text-[8px] text-muted-foreground'>-</span>
      </div>
    );
  }
);
GameImageCell.displayName = 'GameImageCell';

// 컴포넌트: 캠페인 칸의 게임 아이콘 (32px)
const GameLogo = React.memo(
  ({ imageUrl, alt }: { imageUrl: string | null; alt: string }) => {
    // 스토어 이미지가 막히면(429 등) 깨진 이미지 대신 게임명 첫 글자
    const [failed, setFailed] = useState(false);
    return (
      <div className='flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted'>
        {imageUrl && !failed ? (
          <Image
            src={imageUrl}
            alt={alt}
            width={32}
            height={32}
            className='h-full w-full object-cover'
            unoptimized
            onError={() => setFailed(true)}
          />
        ) : (
          <span className='text-xs font-semibold text-muted-foreground'>
            {alt.trim().charAt(0).toUpperCase() || '-'}
          </span>
        )}
      </div>
    );
  }
);
GameLogo.displayName = 'GameLogo';

// 광고주 국가 → 시장 배지 (accounts.country)
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

function MarketBadge({ country }: { country?: string | null }) {
  const badge = country ? MARKET_BADGE[country] : undefined;
  if (!badge) return null;
  return (
    <span
      className={cn(
        'flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
        badge.cls
      )}
    >
      {badge.label}
    </span>
  );
}

// 광고주 묶음 줄 — 그 광고주가 가진 게임 아이콘을 겹쳐서 (최대 6개, 넘치면 +N)
const MAX_GROUP_ICONS = 4;
function GroupGameIcons({
  games,
}: {
  games: { key: string; logo: string | null; name: string }[];
}) {
  if (games.length === 0) return null;
  const shown = games.slice(0, MAX_GROUP_ICONS);
  const rest = games.length - shown.length;
  return (
    <div className='flex w-[108px] flex-shrink-0 items-center -space-x-2'>
      {shown.map((g) => (
        <GroupGameIcon key={g.key} logo={g.logo} name={g.name} />
      ))}
      {rest > 0 && (
        <span className='relative flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background'>
          +{rest}
        </span>
      )}
    </div>
  );
}

function GroupGameIcon({ logo, name }: { logo: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!logo || failed) {
    return (
      <span
        title={name}
        className='relative flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background'
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
      className='relative h-7 w-7 rounded-lg object-cover ring-2 ring-background'
    />
  );
}

// 컴포넌트: Game Name Cell
interface GameNameCellProps {
  campaign: Campaign;
  regionalUrl: string | null;
  regionalGameName: string | null;
  gameNameLoading: boolean;
}

const GameNameCell = React.memo(
  ({
    campaign,
    regionalUrl,
    regionalGameName,
    gameNameLoading,
  }: GameNameCellProps) => {
    const gameName = gameNameLoading
      ? '...'
      : regionalGameName || campaign.game_name || '-';

    return (
      <span className='text-sm truncate w-[180px] max-w-[180px] hover:text-primary'>
        {gameName}
      </span>
    );
  }
);
GameNameCell.displayName = 'GameNameCell';

// 컴포넌트: Status Badge
interface StatusBadgeProps {
  statusDisplay: StatusDisplay;
}

const StatusBadge = React.memo(({ statusDisplay }: StatusBadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
      statusDisplay.color || 'bg-muted text-muted-foreground'
    )}
  >
    <span className='h-1.5 w-1.5 rounded-full bg-current' />
    {statusDisplay.label}
  </span>
));
StatusBadge.displayName = 'StatusBadge';

// 컴포넌트: Date Range Cell
interface DateRangeCellProps {
  startDate: string | null;
  endDate: string | null;
  status: string | null;
}

const DateRangeCell = React.memo(
  ({ startDate, endDate, status }: DateRangeCellProps) => {
    const summary = periodSummary(startDate, endDate, status);
    return (
      <div className='min-w-0'>
        <div className='text-sm tabular-nums whitespace-nowrap'>
          {formatDateYYYYMMDD(startDate)} ~{' '}
          {endDate ? formatDateYYYYMMDD(endDate) : '—'}
        </div>
        {summary?.progress != null && (
          <div className='mt-1 h-1 w-full max-w-[160px] overflow-hidden rounded-full bg-muted'>
            <div
              className='h-full rounded-full bg-green-500'
              style={{ width: `${summary.progress}%` }}
            />
          </div>
        )}
        {summary && (
          <div className='mt-0.5 text-xs text-muted-foreground'>
            {summary.text}
          </div>
        )}
      </div>
    );
  }
);
DateRangeCell.displayName = 'DateRangeCell';

// 컴포넌트: Jira URL Cell
interface JiraUrlCellProps {
  jiraUrl: string | null;
}

const JiraUrlCell = React.memo(({ jiraUrl }: JiraUrlCellProps) => {
  if (jiraUrl) {
    return (
      <a
        href={jiraUrl}
        target='_blank'
        rel='noopener noreferrer'
        className='inline-flex items-center justify-center text-primary hover:underline'
      >
        <ExternalLinkIcon className='h-4 w-4' />
      </a>
    );
  }
  return <span className='text-sm text-muted-foreground'>-</span>;
});
JiraUrlCell.displayName = 'JiraUrlCell';

// 컴포넌트: Daily Report URL Cell
interface DailyReportUrlCellProps {
  dailyReportUrl: string | null;
}

const DailyReportUrlCell = React.memo(
  ({ dailyReportUrl }: DailyReportUrlCellProps) => {
    if (dailyReportUrl) {
      return (
        <a
          href={dailyReportUrl}
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center justify-center text-primary hover:underline'
        >
          <ExternalLinkIcon className='h-4 w-4' />
        </a>
      );
    }
    return <span className='text-sm text-muted-foreground'>-</span>;
  }
);
DailyReportUrlCell.displayName = 'DailyReportUrlCell';

// Campaign Table Row
interface CampaignTableRowProps {
  campaign: Campaign;
  statusDisplay: StatusDisplay;
  handleEditCampaign: (campaign: Campaign) => void;
  handleDeleteClick: (campaignId: string, isAllowed: boolean) => void;
  currentUserProfile?: UserProfile | null;
  accountAssignedUserId?: string;
  columnVisibility: Record<string, boolean>;
}

function CampaignTableRow({
  campaign,
  statusDisplay,
  handleEditCampaign,
  handleDeleteClick,
  currentUserProfile,
  accountAssignedUserId,
  columnVisibility,
}: CampaignTableRowProps) {
  // accountAssignedUserId가 제공된 경우 사용하고, 그렇지 않으면 캠페인의 assigned_user_id 사용
  const assignedUserId =
    accountAssignedUserId !== undefined
      ? accountAssignedUserId
      : campaign.assigned_user_id || '';
  const isManageAllowed = canManageResource(currentUserProfile, assignedUserId);
  const [copiedGameName, setCopiedGameName] = useState(false);

  // 지역별 store URL — 링크용 (예: KR 캠페인 → KR App Store로 연결)
  const regionalUrl = useMemo(() => {
    if (campaign.game_store_url && campaign.region) {
      return convertStoreUrlByRegion(campaign.game_store_url, campaign.region);
    }
    return null;
  }, [campaign.game_store_url, campaign.region]);

  // 지역별 게임 이름: DB값만 사용. NULL이면 canonical game_name으로 fallback.
  // 레거시 캠페인은 Settings → "Refresh missing regional names"로 일괄 채움.
  const regionalGameName = campaign.regional_game_name || null;
  const gameNameLoading = false;

  // 게임 이미지: DB의 game_logo_url만 사용. NULL이면 placeholder.
  // 레거시 게임은 Settings → "Refresh missing logos"로 일괄 채움.
  const imageUrl = campaign.game_logo_url || null;
  const imageLoading = false;

  // 스토어 favicon URL 생성
  const storeFaviconUrl = useMemo(() => {
    const url = campaign.game_store_url || regionalUrl;
    if (!url) return null;

    if (/apps\.apple\.com|itunes\.apple\.com/i.test(url)) {
      return 'https://www.google.com/s2/favicons?domain=apps.apple.com&sz=32';
    }
    if (/play\.google\.com/i.test(url)) {
      return 'https://www.google.com/s2/favicons?domain=play.google.com&sz=32';
    }
    return null;
  }, [campaign.game_store_url, regionalUrl]);

  const handleCopyGameName = useCallback(async () => {
    const gameNameToCopy = gameNameLoading
      ? ''
      : regionalGameName || campaign.game_name || '';

    if (!gameNameToCopy) return;

    try {
      await navigator.clipboard.writeText(gameNameToCopy);
      setCopiedGameName(true);
      toast.success('게임 이름을 클립보드에 복사했습니다');
      setTimeout(() => {
        setCopiedGameName(false);
      }, COPY_RESET_DELAY);
    } catch (error) {
      toast.error('게임 이름 복사에 실패했습니다');
    }
  }, [gameNameLoading, regionalGameName, campaign.game_name]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
    <TableRow>
      {columnVisibility.campaignTitle && !columnVisibility.gameName && (
        <TableCell style={{ width: COLUMN_WIDTHS.campaignWithGame }}>
          <div className='flex items-center gap-3 min-w-0'>
            {regionalUrl ? (
              <GameThumbnailTooltip
                imageUrl={imageUrl}
                gameName={regionalGameName || campaign.game_name || null}
                packageIdentifier={campaign.game_package_identifier || null}
                storeUrl={regionalUrl}
                storeFaviconUrl={storeFaviconUrl || null}
                enableCopy={true}
              >
                <a
                  href={regionalUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='flex-shrink-0'
                >
                  <GameLogo imageUrl={imageUrl} alt={campaign.game_name || 'Game'} />
                </a>
              </GameThumbnailTooltip>
            ) : (
              <GameLogo imageUrl={imageUrl} alt={campaign.game_name || 'Game'} />
            )}
            <div className='min-w-0'>
              {/* 시트 아이콘 + 캠페인명 = 리포트(성과) 화면으로 이동. 미연동이면 비활성 */}
              {campaign.daily_report_url ? (
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className='flex items-center gap-1.5 min-w-0 text-sm font-semibold hover:text-primary hover:underline'
                >
                  <ReportSheetBadge connected />
                  <span className='truncate'>{campaign.name}</span>
                </Link>
              ) : (
                <span
                  className='flex items-center gap-1.5 min-w-0 text-sm font-semibold text-muted-foreground'
                  title='리포트 미연동'
                >
                  <ReportSheetBadge connected={false} />
                  <span className='truncate'>{campaign.name}</span>
                </span>
              )}
              <div className='truncate text-xs text-muted-foreground'>
                {regionalGameName || campaign.game_name || '-'}
              </div>
            </div>
          </div>
        </TableCell>
      )}
      {columnVisibility.campaignTitle && columnVisibility.gameName && (
        <TableCell style={{ width: COLUMN_WIDTHS.campaignTitle }}>
          {campaign.daily_report_url ? (
            <Link
              href={`/campaigns/${campaign.id}`}
              className='flex items-center gap-1.5 min-w-0 font-medium text-sm text-primary hover:underline'
            >
              {/* 리포트 시트 연동 표시 (연동: 초록 / 미연동: 회색) */}
              <ReportSheetBadge connected />
              <span className='truncate'>{campaign.name}</span>
            </Link>
          ) : (
            // 리포트 미연동 — 상세 성과가 비어 있으므로 이동 없이 비활성 표시 (수정은 ⋯ / 우클릭 메뉴)
            <span
              className='flex items-center gap-1.5 min-w-0 font-medium text-sm text-muted-foreground'
              title='리포트 미연동'
            >
              <ReportSheetBadge connected={false} />
              <span className='truncate'>{campaign.name}</span>
            </span>
          )}
        </TableCell>
      )}
      {columnVisibility.account && (
        <TableCell style={{ width: COLUMN_WIDTHS.account }}>
          {campaign.account_id && campaign.account_company ? (
            <Link
              href={accountUrl(campaign.account_company)}
              className='text-sm font-medium text-primary hover:underline truncate block'
            >
              {campaign.account_company}
            </Link>
          ) : (
            <span className='text-sm text-muted-foreground'>알 수 없음</span>
          )}
        </TableCell>
      )}
      {columnVisibility.gameName && (
        <TableCell style={{ width: COLUMN_WIDTHS.gameName }}>
          <div className='flex items-center gap-2'>
            {regionalUrl ? (
              <GameThumbnailTooltip
                imageUrl={imageUrl}
                gameName={
                  gameNameLoading
                    ? null
                    : regionalGameName || campaign.game_name || null
                }
                packageIdentifier={campaign.game_package_identifier || null}
                storeUrl={regionalUrl}
                storeFaviconUrl={storeFaviconUrl || null}
                enableCopy={true}
              >
                <a
                  href={regionalUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='flex items-center gap-2 flex-1 min-w-0'
                >
                  <GameImageCell
                    imageUrl={imageUrl}
                    imageLoading={imageLoading}
                    alt={campaign.game_name || 'Game'}
                  />
                  <GameNameCell
                    campaign={campaign}
                    regionalUrl={regionalUrl}
                    regionalGameName={regionalGameName}
                    gameNameLoading={gameNameLoading}
                  />
                </a>
              </GameThumbnailTooltip>
            ) : (
              <div className='flex items-center gap-2 flex-1 min-w-0'>
                <GameImageCell
                  imageUrl={imageUrl}
                  imageLoading={imageLoading}
                  alt={campaign.game_name || 'Game'}
                />
                <GameNameCell
                  campaign={campaign}
                  regionalUrl={regionalUrl}
                  regionalGameName={regionalGameName}
                  gameNameLoading={gameNameLoading}
                />
                {!gameNameLoading &&
                  !!(regionalGameName || campaign.game_name) && (
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='h-5 w-5 p-0 flex-shrink-0'
                      onClick={handleCopyGameName}
                    >
                      {copiedGameName ? (
                        <Check className='h-3 w-3 text-green-600' />
                      ) : (
                        <Copy className='h-3 w-3 text-muted-foreground' />
                      )}
                    </Button>
                  )}
              </div>
            )}
          </div>
        </TableCell>
      )}
      {columnVisibility.assignedUser && (
        <TableCell style={{ width: COLUMN_WIDTHS.assignedUser }}>
          <div className='flex items-center gap-2'>
            {campaign.assigned_user_name ? (
              <>
                <Avatar className='h-5 w-5'>
                  {campaign.assigned_user_avatar_url ? (
                    <AvatarImage
                      src={campaign.assigned_user_avatar_url}
                      alt={campaign.assigned_user_name}
                    />
                  ) : null}
                  <AvatarFallback className='text-xs'>
                    {campaign.assigned_user_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className='text-xs font-medium truncate'>
                  {campaign.assigned_user_name}
                </div>
              </>
            ) : (
              <div className='text-xs text-muted-foreground'>미지정</div>
            )}
          </div>
        </TableCell>
      )}
      {columnVisibility.region && (
        <TableCell
          style={{ width: COLUMN_WIDTHS.region }}
          className='text-center'
        >
          <div className='text-sm text-muted-foreground'>
            {getRegionDisplay(campaign.region)}
          </div>
        </TableCell>
      )}
      {columnVisibility.mmp && (
        <TableCell style={{ width: COLUMN_WIDTHS.mmp }} className='text-center'>
          <MmpIcon mmp={campaign.mmp} />
        </TableCell>
      )}
      {columnVisibility.type && (
        <TableCell style={{ width: COLUMN_WIDTHS.type }}>
          <div className='text-sm text-muted-foreground'>
            {getTypeDisplay(campaign.campaign_type)}
          </div>
        </TableCell>
      )}
      {columnVisibility.dateRange && (
        <TableCell style={{ width: COLUMN_WIDTHS.dateRange }}>
          <DateRangeCell
            startDate={campaign.start_date}
            endDate={campaign.end_date}
            status={campaign.status}
          />
        </TableCell>
      )}
      {columnVisibility.status && (
        <TableCell
          style={{ width: COLUMN_WIDTHS.status }}
          className='text-center'
        >
          <StatusBadge statusDisplay={statusDisplay} />
        </TableCell>
      )}
      {columnVisibility.jiraUrl && (
        <TableCell
          style={{ width: COLUMN_WIDTHS.jiraUrl }}
          className='text-center'
        >
          <JiraUrlCell jiraUrl={campaign.jira_url} />
        </TableCell>
      )}
      {columnVisibility.dailyReportUrl && (
        <TableCell
          style={{ width: COLUMN_WIDTHS.dailyReportUrl }}
          className='text-center'
        >
          <DailyReportUrlCell dailyReportUrl={campaign.daily_report_url} />
        </TableCell>
      )}
      <TableCell
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              className='flex size-8 hover:bg-muted/50'
              size='icon'
            >
              <MoreHorizontalIcon className='h-4 w-4' />
              <span className='sr-only'>메뉴 열기</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-auto min-w-[120px]'>
            <DropdownMenuItem
              onClick={() => handleEditCampaign(campaign)}
              className='flex items-center gap-0'
              disabled={!isManageAllowed}
            >
              <EditIcon className='mr-1 h-4 w-4' />
              캠페인 수정
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDeleteClick(campaign.id, isManageAllowed)}
              className='text-red-600 focus:text-red-600 flex items-center gap-0'
              disabled={!isManageAllowed}
            >
              <TrashIcon className='mr-1 h-4 w-4' />
              캠페인 삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent className='w-auto min-w-[180px]'>
        <ContextMenuItem
          onClick={() => handleEditCampaign(campaign)}
          disabled={!isManageAllowed}
        >
          <EditIcon className='mr-2 h-4 w-4' />
          캠페인 수정
        </ContextMenuItem>
        {campaign.jira_url && (
          <ContextMenuItem
            onClick={() =>
              window.open(campaign.jira_url!, '_blank', 'noopener,noreferrer')
            }
          >
            <ExternalLinkIcon className='mr-2 h-4 w-4' />
            Jira 티켓 보러가기
          </ContextMenuItem>
        )}
        {campaign.daily_report_url && (
          <ContextMenuItem
            onClick={() =>
              window.open(
                campaign.daily_report_url!,
                '_blank',
                'noopener,noreferrer'
              )
            }
          >
            <ExternalLinkIcon className='mr-2 h-4 w-4' />
            리포트 시트 보러가기
          </ContextMenuItem>
        )}
        <ContextMenuItem
          onClick={() => handleDeleteClick(campaign.id, isManageAllowed)}
          disabled={!isManageAllowed}
          className='text-red-600 focus:text-red-600'
        >
          <TrashIcon className='mr-2 h-4 w-4' />
          캠페인 삭제
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// 헤더 클릭 정렬 컬럼 + 첫 클릭 방향 (기간은 최신순부터)
type SortColumn = 'name' | 'region' | 'date';
const SORT_FIRST_DIR: Record<SortColumn, 'asc' | 'desc'> = {
  name: 'asc',
  region: 'asc',
  date: 'desc',
};

// Campaigns Table
interface CampaignsTableProps {
  campaigns: Campaign[];
  selectedCampaigns: string[];
  onSelectAll: (checked: boolean) => void;
  onSelectCampaign: (campaignId: string, checked: boolean) => void;
  onCampaignDeleted?: (campaignId: string) => void;
  onDeleteCampaign: (campaignId: string) => Promise<void>;
  onEditCampaign?: (campaign: Campaign) => void;
  currentUserProfile?: UserProfile | null;
  accountAssignedUserId?: string;
  columnVisibility?: Record<string, boolean>;
  /** true면 광고주(account_company)로 1차 그룹핑 후 내부 정렬 */
  groupByAccount?: boolean;
  /** 기간 정렬 기준 — 홀딩·종료처럼 이미 끝난 캠페인을 볼 때는 'end'(종료일) */
  dateSortField?: 'start' | 'end';
  /** true 면 부모 높이를 채우고 표 안에서만 스크롤 — 헤더가 위에 고정된다 */
  fillHeight?: boolean;
  className?: string;
}

export function CampaignsTable({
  campaigns,
  selectedCampaigns,
  onSelectAll,
  onSelectCampaign,
  onCampaignDeleted,
  onDeleteCampaign,
  onEditCampaign,
  currentUserProfile,
  accountAssignedUserId,
  groupByAccount = false,
  dateSortField = 'start',
  fillHeight = false,
  className,
  columnVisibility = {
    campaignTitle: true,
    account: true,
    gameName: true,
    assignedUser: true,
    region: true,
    mmp: true,
    type: true,
    dateRange: true,
    status: true,
    jiraUrl: false,
    dailyReportUrl: false,
  },
}: CampaignsTableProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const [deleteIsAllowed, setDeleteIsAllowed] = useState(false);
  // 정렬 상태 — 한 번에 한 컬럼만 활성. 기본값: name asc (KR>JP>TW>US tiebreak)
  const [sortColumn, setSortColumn] = useState<SortColumn | null>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // 같은 컬럼 재클릭: 첫 방향 → 반대 방향 → 정렬 해제 (기간은 최신순부터)
  const cycleSort = useCallback(
    (col: SortColumn) => {
      const first = SORT_FIRST_DIR[col];
      if (sortColumn !== col) {
        setSortColumn(col);
        setSortDir(first);
      } else if (sortDir === first) {
        setSortDir(first === 'asc' ? 'desc' : 'asc');
      } else {
        setSortColumn(null);
        setSortDir(first);
      }
    },
    [sortColumn, sortDir]
  );

  const sortedCampaigns = useMemo(() => {
    // 기간(최신순/오래된순) 정렬은 광고주 그룹 없이 전체 기준 — 그룹을 유지하면 그룹 안에서만 정렬돼 최신순이 안 보임
    const useGroup = groupByAccount && sortColumn !== 'date';
    if (!sortColumn && !useGroup) return campaigns;
    const copy = [...campaigns];

    const innerCompare = (a: Campaign, b: Campaign): number => {
      if (!sortColumn) return 0;
      if (sortColumn === 'date') {
        // 시작일(홀딩·종료 탭은 종료일) 기준. 날짜 없는 캠페인은 방향과 무관하게 항상 뒤로, 같은 날짜는 이름순
        const x = dateSortField === 'end' ? a.end_date : a.start_date;
        const y = dateSortField === 'end' ? b.end_date : b.start_date;
        if (x !== y) {
          if (!x) return 1;
          if (!y) return -1;
          const c = x.localeCompare(y);
          return sortDir === 'asc' ? c : -c;
        }
        return compareByNameAndRegion(a, b);
      }
      let cmp = 0;
      if (sortColumn === 'name') {
        cmp = compareByNameAndRegion(a, b);
      } else if (sortColumn === 'region') {
        cmp =
          (REGION_PRIORITY[a.region] ?? 99) -
          (REGION_PRIORITY[b.region] ?? 99);
        if (cmp === 0) cmp = compareByNameAndRegion(a, b);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    };

    copy.sort((a, b) => {
      // 1차: 광고주 그룹핑 (요청 시, 기간 정렬 제외) — 그룹 자체 정렬 방향은 항상 asc
      if (useGroup) {
        const aCompany = a.account_company ?? '';
        const bCompany = b.account_company ?? '';
        const groupCmp = aCompany.localeCompare(bCompany, 'ko-KR', {
          numeric: true,
          sensitivity: 'base',
        });
        if (groupCmp !== 0) return groupCmp;
      }
      // 2차: 기존 정렬 (이름/지역)
      return innerCompare(a, b);
    });
    return copy;
  }, [campaigns, sortColumn, sortDir, groupByAccount, dateSortField]);

  // 광고주 묶음 줄 — 광고주 칸을 숨기고 광고주 순으로 묶여 있을 때만
  const showGroupRows =
    groupByAccount && sortColumn !== 'date' && !columnVisibility.account;
  // 접힌 광고주 묶음 (광고주명)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set()
  );
  const toggleGroup = useCallback((company: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(company)) next.delete(company);
      else next.add(company);
      return next;
    });
  }, []);
  // 광고주별 게임 아이콘 (중복 게임 제외, 묶음 줄에 겹쳐 보여줌)
  const groupGames = useMemo(() => {
    const m = new Map<string, { key: string; logo: string | null; name: string }[]>();
    for (const c of campaigns) {
      const company = c.account_company ?? '';
      const key = c.game_id ?? c.game_name ?? c.id;
      const list = m.get(company) ?? [];
      if (!list.some((g) => g.key === key)) {
        list.push({
          key,
          logo: c.game_logo_url ?? null,
          name: c.game_name ?? '',
        });
      }
      m.set(company, list);
    }
    return m;
  }, [campaigns]);
  // 광고주별 진행 지역 (KR·JP·TW·US 순) + 광고주 국가
  const { groupRegions, groupCountry } = useMemo(() => {
    const regions = new Map<string, Set<string>>();
    const country = new Map<string, string | null>();
    for (const c of campaigns) {
      const k = c.account_company ?? '';
      if (c.region) {
        const set = regions.get(k) ?? new Set<string>();
        set.add(c.region);
        regions.set(k, set);
      }
      if (!country.has(k)) country.set(k, c.account_country ?? null);
    }
    const order = (r: string) => REGION_PRIORITY[r] ?? 99;
    return {
      groupRegions: new Map(
        [...regions].map(([k, set]) => [
          k,
          [...set].sort((a, b) => order(a) - order(b) || a.localeCompare(b)),
        ])
      ),
      groupCountry: country,
    };
  }, [campaigns]);
  const groupSizes = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of campaigns) {
      const k = c.account_company ?? '';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [campaigns]);
  // 묶음 줄이 표 전체 폭을 차지하도록 보이는 컬럼 수 (+ 메뉴 칸)
  const visibleColumnCount =
    Object.values(columnVisibility).filter(Boolean).length + 1;

  const renderSortIcon = (col: SortColumn) => {
    if (sortColumn !== col) {
      return <ArrowUpDown className='h-3.5 w-3.5 opacity-40' />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className='h-3.5 w-3.5' />
    ) : (
      <ArrowDown className='h-3.5 w-3.5' />
    );
  };

  const handleDeleteClick = useCallback(
    (campaignId: string, isAllowed: boolean) => {
      if (!isAllowed) {
        toast.error(
          '본인에게 할당된 광고주의 캠페인만 삭제할 수 있습니다.'
        );
        return;
      }
      setCampaignToDelete(campaignId);
      setDeleteIsAllowed(isAllowed);
      setShowDeleteDialog(true);
    },
    []
  );

  const handleDeleteCampaign = useCallback(async () => {
    if (!campaignToDelete) return;

    try {
      await onDeleteCampaign(campaignToDelete);
      toast.success('캠페인이 삭제되었습니다');
      onCampaignDeleted?.(campaignToDelete);
      setShowDeleteDialog(false);
      setCampaignToDelete(null);
      setDeleteIsAllowed(false);
    } catch (err) {
      toast.error(
        `캠페인 삭제 실패: ${
          err instanceof Error ? err.message : '알 수 없는 오류'
        }`
      );
    }
  }, [campaignToDelete, onDeleteCampaign, onCampaignDeleted]);

  const handleEditCampaign = useCallback(
    (campaign: Campaign) => {
      onEditCampaign?.(campaign);
    },
    [onEditCampaign]
  );

  const campaignToDeleteData = useMemo(
    () => campaigns.find((c) => c.id === campaignToDelete),
    [campaigns, campaignToDelete]
  );

  const handleCloseDialog = useCallback(() => {
    setShowDeleteDialog(false);
    setCampaignToDelete(null);
    setDeleteIsAllowed(false);
  }, []);

  return (
    <TooltipProvider delayDuration={0}>
      <TableWrapper
        fillHeight={fillHeight}
        className={cn(fillHeight && 'max-h-full', className)}
      >
        <Table style={{ tableLayout: 'fixed', width: '100%' }}>
          <TableHeader className={TABLE_STYLES.header}>
            <TableRow>
              {columnVisibility.campaignTitle && (
                <TableHead
                  style={{
                    width: columnVisibility.gameName
                      ? COLUMN_WIDTHS.campaignTitle
                      : COLUMN_WIDTHS.campaignWithGame,
                  }}
                >
                  <button
                    type='button'
                    onClick={() => cycleSort('name')}
                    className='inline-flex items-center gap-1.5 -mx-1 px-1 py-0.5 rounded hover:bg-muted transition-colors text-left font-medium'
                  >
                    {columnVisibility.gameName ? '캠페인 제목' : '캠페인 · 게임'}
                    {renderSortIcon('name')}
                  </button>
                  {showGroupRows && groupSizes.size > 1 && (
                    <button
                      type='button'
                      onClick={() =>
                        setCollapsedGroups((prev) =>
                          prev.size > 0 ? new Set() : new Set(groupSizes.keys())
                        )
                      }
                      className='ml-2 rounded px-1.5 py-0.5 text-xs font-normal text-muted-foreground hover:bg-muted hover:text-foreground'
                    >
                      {collapsedGroups.size > 0 ? '모두 펼치기' : '모두 접기'}
                    </button>
                  )}
                </TableHead>
              )}
              {columnVisibility.account && (
                <TableHead style={{ width: COLUMN_WIDTHS.account }}>
                  광고주
                </TableHead>
              )}
              {columnVisibility.gameName && (
                <TableHead style={{ width: COLUMN_WIDTHS.gameName }}>
                  게임명
                </TableHead>
              )}
              {columnVisibility.assignedUser && (
                <TableHead style={{ width: COLUMN_WIDTHS.assignedUser }}>
                  담당자
                </TableHead>
              )}
              {columnVisibility.region && (
                <TableHead
                  style={{ width: COLUMN_WIDTHS.region }}
                  className='text-center'
                >
                  <button
                    type='button'
                    onClick={() => cycleSort('region')}
                    className='inline-flex items-center gap-1.5 -mx-1 px-1 py-0.5 rounded hover:bg-muted transition-colors font-medium mx-auto'
                  >
                    지역
                    {renderSortIcon('region')}
                  </button>
                </TableHead>
              )}
              {columnVisibility.mmp && (
                <TableHead
                  style={{ width: COLUMN_WIDTHS.mmp }}
                  className='text-center'
                >
                  MMP
                </TableHead>
              )}
              {columnVisibility.type && (
                <TableHead style={{ width: COLUMN_WIDTHS.type }}>
                  타입
                </TableHead>
              )}
              {columnVisibility.dateRange && (
                <TableHead style={{ width: COLUMN_WIDTHS.dateRange }}>
                  <button
                    type='button'
                    onClick={() => cycleSort('date')}
                    title={`${
                      dateSortField === 'end' ? '종료일' : '시작일'
                    } 기준 정렬 (최신순 → 오래된순 → 해제)`}
                    className='inline-flex items-center gap-1.5 -mx-1 px-1 py-0.5 rounded hover:bg-muted transition-colors text-left font-medium'
                  >
                    기간
                    {sortColumn === 'date' && dateSortField === 'end' && (
                      <span className='text-[10px] font-normal text-muted-foreground'>
                        종료일
                      </span>
                    )}
                    {renderSortIcon('date')}
                  </button>
                </TableHead>
              )}
              {columnVisibility.status && (
                <TableHead
                  style={{ width: COLUMN_WIDTHS.status }}
                  className='text-center'
                >
                  상태
                </TableHead>
              )}
              {columnVisibility.jiraUrl && (
                <TableHead
                  style={{ width: COLUMN_WIDTHS.jiraUrl }}
                  className='text-center'
                >
                  Jira URL
                </TableHead>
              )}
              {columnVisibility.dailyReportUrl && (
                <TableHead
                  style={{ width: COLUMN_WIDTHS.dailyReportUrl }}
                  className='text-center'
                >
                  Report URL
                </TableHead>
              )}
              <TableHead style={{ width: COLUMN_WIDTHS.actions }}></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className={TABLE_STYLES.body}>
            {sortedCampaigns.map((campaign, i) => {
              const statusDisplay = getStatusDisplay(campaign.status);
              const company = campaign.account_company ?? '';
              // 광고주로 묶어 보여줄 때 — 광고주가 바뀌는 첫 줄 위에 묶음 줄
              const groupHeader =
                showGroupRows &&
                (i === 0 ||
                  (sortedCampaigns[i - 1].account_company ?? '') !== company);
              return (
                <React.Fragment key={campaign.id}>
                  {groupHeader && (
                    <TableRow
                      className='cursor-pointer bg-muted/30 hover:bg-muted/50'
                      onClick={() => toggleGroup(company)}
                    >
                      <TableCell colSpan={visibleColumnCount} className='py-2'>
                        <div className='flex items-center gap-3'>
                          <ChevronRight
                            className={cn(
                              'h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform',
                              !collapsedGroups.has(company) && 'rotate-90'
                            )}
                          />
                          <GroupGameIcons games={groupGames.get(company) ?? []} />
                          <div className='min-w-0'>
                            <div className='flex items-center gap-2'>
                              {company ? (
                                <Link
                                  href={accountUrl(company)}
                                  onClick={(e) => e.stopPropagation()}
                                  className='truncate text-sm font-semibold hover:underline'
                                >
                                  {company}
                                </Link>
                              ) : (
                                <span className='text-sm font-semibold text-muted-foreground'>
                                  광고주 없음
                                </span>
                              )}
                              <MarketBadge country={groupCountry.get(company)} />
                            </div>
                            <div className='text-xs text-muted-foreground'>
                              {groupSizes.get(company) ?? 0}개 캠페인
                              {(groupRegions.get(company) ?? []).map((r) => (
                                <span key={r}> · {r}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                {!(showGroupRows && collapsedGroups.has(company)) && (
                <CampaignTableRow
                  key={campaign.id}
                  campaign={campaign}
                  statusDisplay={statusDisplay}
                  handleEditCampaign={handleEditCampaign}
                  handleDeleteClick={handleDeleteClick}
                  currentUserProfile={currentUserProfile}
                  accountAssignedUserId={accountAssignedUserId}
                  columnVisibility={columnVisibility}
                />
                )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableWrapper>
      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={handleCloseDialog}
        onConfirm={handleDeleteCampaign}
        title={deleteIsAllowed ? '정말 삭제하시겠습니까?' : '캠페인을 삭제할 수 없습니다'}
        description={
          deleteIsAllowed
            ? `이 작업은 되돌릴 수 없습니다. ${campaignToDeleteData?.name} 캠페인이 영구적으로 삭제됩니다.`
            : `본인에게 할당된 광고주의 캠페인만 삭제할 수 있습니다. ${campaignToDeleteData?.name} 캠페인은 다른 사용자에게 할당된 광고주의 캠페인입니다.`
        }
        confirmLabel='삭제'
        cancelLabel='닫기'
        isAllowed={deleteIsAllowed}
      />
    </TooltipProvider>
  );
}
