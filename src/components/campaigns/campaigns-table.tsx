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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TableWrapper, TABLE_STYLES } from '@/components/common/table-wrapper';
import { DeleteConfirmationDialog } from '@/components/common/delete-confirmation-dialog';
import { GameThumbnailTooltip } from '@/components/common/game-thumbnail-tooltip';
import { accountUrl } from '@/lib/utils/account-url';
import Link from 'next/link';

// 상수 정의
const COLUMN_WIDTHS = {
  campaignTitle: '200px',
  account: '150px',
  gameName: '250px',
  assignedUser: '160px',
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
    planning: 'text-yellow-600 dark:text-yellow-500',
    ongoing: 'text-green-600 dark:text-green-500',
    holding: 'text-red-600 dark:text-red-500',
    end: 'text-gray-500 dark:text-gray-400',
  };

  return {
    label: statusOption.label,
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

// 컴포넌트: MMP Icon
interface MMPIconProps {
  mmp: string | null;
}

const MMPIcon = React.memo(({ mmp }: MMPIconProps) => {
  if (mmp === 'Adjust') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className='flex items-center justify-center w-5 h-5 flex-shrink-0 mx-auto'>
            <Image
              src='/Adjust Logo.svg'
              alt='Adjust'
              width={20}
              height={20}
              className='object-contain'
              unoptimized
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Adjust</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (mmp === 'AppsFlyer') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className='flex items-center justify-center w-5 h-5 flex-shrink-0 mx-auto'>
            <Image
              src='/AppsFlyer Logo.svg'
              alt='AppsFlyer'
              width={20}
              height={20}
              className='object-contain w-auto h-auto'
              unoptimized
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>AppsFlyer</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return null;
});
MMPIcon.displayName = 'MMPIcon';

// 컴포넌트: Status Badge
interface StatusBadgeProps {
  statusDisplay: StatusDisplay;
}

const StatusBadge = React.memo(({ statusDisplay }: StatusBadgeProps) => (
  <Badge
    variant={statusDisplay.variant}
    className={`inline-flex items-center justify-center min-w-[70px] ${
      statusDisplay.color || ''
    }`}
  >
    {statusDisplay.label}
  </Badge>
));
StatusBadge.displayName = 'StatusBadge';

// 컴포넌트: Date Range Cell
interface DateRangeCellProps {
  startDate: string | null;
  endDate: string | null;
}

const DateRangeCell = React.memo(
  ({ startDate, endDate }: DateRangeCellProps) => (
    <div className='text-sm text-muted-foreground'>
      {formatDateYYYYMMDD(startDate)} ~ {formatDateYYYYMMDD(endDate)}
    </div>
  )
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
    <TableRow>
      {columnVisibility.campaignTitle && (
        <TableCell style={{ width: COLUMN_WIDTHS.campaignTitle }}>
          <Link
            href={`/campaigns/${campaign.id}`}
            className='font-medium truncate text-sm text-primary hover:underline block'
          >
            {campaign.name}
          </Link>
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
          <MMPIcon mmp={campaign.mmp} />
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
  );
}

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
    jiraUrl: true,
    dailyReportUrl: true,
  },
}: CampaignsTableProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const [deleteIsAllowed, setDeleteIsAllowed] = useState(false);
  // 정렬 상태 — 한 번에 한 컬럼만 활성. 기본값: name asc (KR>JP>TW>US tiebreak)
  type SortColumn = 'name' | 'region';
  const [sortColumn, setSortColumn] = useState<SortColumn | null>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const cycleSort = useCallback((col: SortColumn) => {
    setSortColumn((prev) => {
      if (prev !== col) {
        setSortDir('asc');
        return col;
      }
      // 같은 컬럼 재클릭: asc → desc → null 사이클
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return prev === col && sortDir === 'desc' ? null : col;
    });
  }, [sortDir]);

  const sortedCampaigns = useMemo(() => {
    if (!sortColumn && !groupByAccount) return campaigns;
    const copy = [...campaigns];

    const innerCompare = (a: Campaign, b: Campaign): number => {
      if (!sortColumn) return 0;
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
      // 1차: 광고주 그룹핑 (요청 시) — 그룹 자체 정렬 방향은 항상 asc
      if (groupByAccount) {
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
  }, [campaigns, sortColumn, sortDir, groupByAccount]);

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
      <TableWrapper>
        <div className='overflow-x-auto'>
          <Table style={{ tableLayout: 'fixed', width: '100%' }}>
            <TableHeader className={TABLE_STYLES.header}>
              <TableRow>
                {columnVisibility.campaignTitle && (
                  <TableHead style={{ width: COLUMN_WIDTHS.campaignTitle }}>
                    <button
                      type='button'
                      onClick={() => cycleSort('name')}
                      className='inline-flex items-center gap-1.5 -mx-1 px-1 py-0.5 rounded hover:bg-muted transition-colors text-left font-medium'
                    >
                      캠페인 제목
                      {renderSortIcon('name')}
                    </button>
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
                    기간
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
              {sortedCampaigns.map((campaign) => {
                const statusDisplay = getStatusDisplay(campaign.status);
                return (
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
                );
              })}
            </TableBody>
          </Table>
        </div>
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
