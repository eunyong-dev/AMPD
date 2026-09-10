'use client';

import { useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ExternalLinkIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableWrapper, TABLE_STYLES } from '@/components/common/table-wrapper';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { GameThumbnailTooltip } from '@/components/common/game-thumbnail-tooltip';
import { MmpIcon } from '@/components/common/mmp-icon';
import { CAMPAIGN_TYPE_OPTIONS } from '@/constants/campaigns';
import { convertStoreUrlByRegion } from '@/lib/store-url-utils';
import { formatDateYYYYMMDD } from '@/lib/utils/date';

/** 상단 정보 표에 필요한 캠페인 필드 — 내부/공개 공통 형태 */
export interface CampaignInfo {
  name: string;
  company: string | null;
  gameName: string | null;
  /** 지역별 게임명 (있으면 스토어 링크에 우선 표시) */
  regionalGameName: string | null;
  gameLogoUrl: string | null;
  gamePackageId: string | null;
  /** 원본 스토어 URL — 지역별 URL 로 변환해 링크 */
  gameStoreUrl: string | null;
  region: string | null;
  mmp: string | null;
  campaignType: string | null;
  startDate: string | null;
  endDate: string | null;
}

/** 내부 전용 칸 — 공개 뷰어는 넘기지 않음 (담당자·Jira·시트 링크·수정/삭제 메뉴 비노출) */
export interface CampaignInfoInternal {
  assigneeName: string | null;
  assigneeAvatarUrl: string | null;
  jiraUrl: string | null;
  reportUrl: string | null;
  /** 행 끝 "..." 메뉴 */
  actions: React.ReactNode;
}

interface CampaignInfoTableProps {
  campaign: CampaignInfo;
  /** 캠페인명 칸 (내부: CampaignSwitcher). 기본: 캠페인명 텍스트 */
  nameCell?: React.ReactNode;
  /** 광고주 링크 (내부: 광고주 상세). 없으면 텍스트 */
  accountHref?: string | null;
  internal?: CampaignInfoInternal;
  /** 행 우클릭 메뉴 (ContextMenuContent) — 내부 전용 */
  contextMenu?: React.ReactNode;
}

const REGION_EMOJI: Record<string, string> = {
  KR: '🇰🇷',
  JP: '🇯🇵',
  TW: '🇹🇼',
  US: '🇺🇸',
  CN: '🇨🇳',
};

const getRegionDisplay = (region: string | null): string => {
  if (!region) return 'Unknown';
  const emoji = REGION_EMOJI[region] || '';
  return emoji ? `${emoji} ${region}` : region;
};

const getTypeDisplay = (type: string | null): string =>
  CAMPAIGN_TYPE_OPTIONS.find((option) => option.value === type)?.label ||
  type ||
  'Unknown';

const getStoreFaviconUrl = (url: string | null): string | null => {
  if (!url) return null;
  if (/apps\.apple\.com|itunes\.apple\.com/i.test(url)) {
    return 'https://www.google.com/s2/favicons?domain=apps.apple.com&sz=32';
  }
  if (/play\.google\.com/i.test(url)) {
    return 'https://www.google.com/s2/favicons?domain=play.google.com&sz=32';
  }
  return null;
};

function LinkIconCell({ url }: { url: string | null }) {
  return (
    <TableCell className='text-center'>
      {url ? (
        <a
          href={url}
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center justify-center text-primary hover:underline'
        >
          <ExternalLinkIcon className='h-4 w-4' />
        </a>
      ) : (
        <span className='text-sm text-muted-foreground'>-</span>
      )}
    </TableCell>
  );
}

/**
 * 캠페인 상단 정보 표 (캠페인명 · 광고주 · 게임 · 지역 · MMP · 타입 · 기간).
 * 내부 캠페인 상세와 공개 성과 뷰어가 공유 — 내부 전용 칸은 `internal` 로만 표시.
 */
export function CampaignInfoTable({
  campaign,
  nameCell,
  accountHref,
  internal,
  contextMenu,
}: CampaignInfoTableProps) {
  const imageUrl = campaign.gameLogoUrl;
  const { gameStoreUrl, region } = campaign;

  // 이미지 프리로드 (성능 개선)
  useEffect(() => {
    if (!imageUrl) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = imageUrl;
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, [imageUrl]);

  // 지역별 store URL — 링크용
  const regionalUrl = useMemo(
    () =>
      gameStoreUrl && region
        ? convertStoreUrlByRegion(gameStoreUrl, region)
        : null,
    [gameStoreUrl, region]
  );

  const logo = imageUrl ? (
    <div className='w-6 h-6 rounded-lg border border-border overflow-hidden flex items-center justify-center bg-muted flex-shrink-0'>
      <Image
        src={imageUrl}
        alt={campaign.gameName || 'Game'}
        width={24}
        height={24}
        className='max-w-full max-h-full w-auto h-auto object-contain'
        unoptimized
      />
    </div>
  ) : (
    <div className='w-6 h-6 rounded-lg border border-border bg-muted flex items-center justify-center flex-shrink-0'>
      <span className='text-[8px] text-muted-foreground'>-</span>
    </div>
  );

  const row = (
    <TableRow>
      {/* Campaign Name */}
      <TableCell>
        {nameCell ?? (
          <span className='block truncate text-sm font-medium'>
            {campaign.name}
          </span>
        )}
      </TableCell>

      {/* Account */}
      <TableCell>
        {campaign.company ? (
          accountHref ? (
            <Link
              href={accountHref}
              className='text-sm font-medium text-primary hover:underline truncate block'
            >
              {campaign.company}
            </Link>
          ) : (
            <span className='text-sm font-medium truncate block'>
              {campaign.company}
            </span>
          )
        ) : (
          <span className='text-sm text-muted-foreground'>알 수 없음</span>
        )}
      </TableCell>

      {/* Game Name */}
      <TableCell>
        {regionalUrl ? (
          <GameThumbnailTooltip
            imageUrl={imageUrl}
            gameName={campaign.regionalGameName || campaign.gameName || null}
            packageIdentifier={campaign.gamePackageId || null}
            storeUrl={regionalUrl}
            storeFaviconUrl={getStoreFaviconUrl(gameStoreUrl)}
            enableCopy={true}
          >
            <a
              href={regionalUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='flex items-center gap-2 flex-1 min-w-0'
            >
              {logo}
              <span className='text-sm truncate w-[180px] max-w-[180px] hover:text-primary'>
                {campaign.regionalGameName || campaign.gameName || '-'}
              </span>
            </a>
          </GameThumbnailTooltip>
        ) : (
          <div className='flex items-center gap-2 flex-1 min-w-0'>
            {logo}
            <span className='text-sm truncate w-[180px] max-w-[180px]'>
              {campaign.gameName || '-'}
            </span>
          </div>
        )}
      </TableCell>

      {/* Assigned User (내부 전용) */}
      {internal && (
        <TableCell>
          <div className='flex items-center gap-2'>
            {internal.assigneeName ? (
              <>
                <Avatar className='h-5 w-5'>
                  {internal.assigneeAvatarUrl ? (
                    <AvatarImage
                      src={internal.assigneeAvatarUrl}
                      alt={internal.assigneeName}
                    />
                  ) : null}
                  <AvatarFallback className='text-xs'>
                    {internal.assigneeName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className='text-xs font-medium truncate'>
                  {internal.assigneeName}
                </div>
              </>
            ) : (
              <div className='text-xs text-muted-foreground'>미지정</div>
            )}
          </div>
        </TableCell>
      )}

      {/* Region */}
      <TableCell className='text-center'>
        <div className='text-sm text-muted-foreground'>
          {getRegionDisplay(region)}
        </div>
      </TableCell>

      {/* MMP */}
      <TableCell className='text-center'>
        <MmpIcon mmp={campaign.mmp} />
      </TableCell>

      {/* Type */}
      <TableCell>
        <div className='text-sm text-muted-foreground'>
          {getTypeDisplay(campaign.campaignType)}
        </div>
      </TableCell>

      {/* Date Range */}
      <TableCell>
        <div className='text-sm text-muted-foreground'>
          {formatDateYYYYMMDD(campaign.startDate)} ~{' '}
          {formatDateYYYYMMDD(campaign.endDate)}
        </div>
      </TableCell>

      {/* Jira / Report URL / Actions (내부 전용) */}
      {internal && (
        <>
          <LinkIconCell url={internal.jiraUrl} />
          <LinkIconCell url={internal.reportUrl} />
          <TableCell style={{ display: 'flex', justifyContent: 'flex-end' }}>
            {internal.actions}
          </TableCell>
        </>
      )}
    </TableRow>
  );

  return (
    <TableWrapper>
      <div className='overflow-x-auto'>
        <Table style={{ tableLayout: 'fixed', width: '100%' }}>
          <TableHeader className={TABLE_STYLES.header}>
            <TableRow>
              <TableHead style={{ width: '200px' }}>캠페인명</TableHead>
              <TableHead style={{ width: '150px' }}>광고주</TableHead>
              <TableHead style={{ width: '250px' }}>게임명</TableHead>
              {internal && (
                <TableHead style={{ width: '160px' }}>담당자</TableHead>
              )}
              <TableHead style={{ width: '120px' }} className='text-center'>
                지역
              </TableHead>
              <TableHead style={{ width: '80px' }} className='text-center'>
                MMP
              </TableHead>
              <TableHead style={{ width: '120px' }}>타입</TableHead>
              <TableHead style={{ width: '200px' }}>기간</TableHead>
              {internal && (
                <>
                  <TableHead style={{ width: '100px' }} className='text-center'>
                    Jira URL
                  </TableHead>
                  <TableHead style={{ width: '100px' }} className='text-center'>
                    Report URL
                  </TableHead>
                  <TableHead style={{ width: '60px' }}></TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody className={TABLE_STYLES.body}>
            {contextMenu ? (
              <ContextMenu>
                <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
                {contextMenu}
              </ContextMenu>
            ) : (
              row
            )}
          </TableBody>
        </Table>
      </div>
    </TableWrapper>
  );
}
