'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { GameThumbnailTooltip } from '@/components/common/game-thumbnail-tooltip';
import { MmpLogo } from '@/components/common/mmp-icon';
import { ServiceFavicon } from '@/components/common/service-favicon';
import {
  GameIcon,
  STATUS_STYLE,
  StoreFavicon,
  dayCount,
  shortDate,
} from '@/components/campaigns/campaign-accordion-list';
import { convertStoreUrlByRegion } from '@/lib/store-url-utils';
import { cn } from '@/lib/utils';

/** 상단 정보에 필요한 캠페인 필드 — 내부/공개 공통 형태 */
export interface CampaignInfo {
  name: string;
  company: string | null;
  gameName: string | null;
  /** 지역별 게임명 (있으면 우선 표시) */
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
  status?: string | null;
}

interface CampaignInfoTableProps {
  campaign: CampaignInfo;
  /** 캠페인명 칸 (CampaignSwitcher 등). 기본: 캠페인명 텍스트 */
  nameCell?: React.ReactNode;
  /** 광고주 링크 (내부: 광고주 상세). 없으면 텍스트 */
  accountHref?: string | null;
  /** 담당자 — 내부 전용 (넘기면 표시) */
  assignee?: { name: string | null; avatarUrl: string | null };
  /** Jira / 리포트 시트 링크 — 넘기면 표시 (내부·공개 공통) */
  links?: { jiraUrl: string | null; reportUrl: string | null };
  /** 오른쪽 끝 "..." 메뉴 (수정/삭제) — 내부 전용 */
  actions?: React.ReactNode;
  /** 우클릭 메뉴 (ContextMenuContent) — 내부 전용 */
  contextMenu?: React.ReactNode;
}

const LINK_CLS =
  'inline-flex items-center gap-1 rounded-md border border-transparent px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground';

/**
 * 캠페인 상단 정보 — 캠페인 현황 목록의 캠페인 줄과 같은 모양
 * (캠페인·게임 / 광고주 / 리전 / MMP / 상태 / 기간 / 시트·JIRA).
 * 내부 캠페인 상세와 공개 성과 뷰어가 공유 — 담당자·메뉴는 넘길 때만 표시.
 */
export function CampaignInfoTable({
  campaign,
  nameCell,
  accountHref,
  assignee,
  links,
  actions,
  contextMenu,
}: CampaignInfoTableProps) {
  const { gameStoreUrl, region } = campaign;
  const regionalUrl = useMemo(
    () =>
      gameStoreUrl && region
        ? convertStoreUrlByRegion(gameStoreUrl, region)
        : gameStoreUrl,
    [gameStoreUrl, region]
  );
  const gameName = campaign.regionalGameName || campaign.gameName || '-';
  const status = campaign.status ? STATUS_STYLE[campaign.status] : undefined;
  const ended = campaign.status === 'holding' || campaign.status === 'end';
  const days =
    campaign.status === 'ongoing' ? dayCount(campaign.startDate) : null;

  const columns = cn(
    'grid items-center gap-x-4',
    assignee
      ? 'grid-cols-[minmax(260px,2.4fr)_minmax(110px,1fr)_52px_minmax(100px,0.9fr)_72px_minmax(150px,1.1fr)_minmax(90px,0.8fr)_170px]'
      : 'grid-cols-[minmax(260px,2.4fr)_minmax(110px,1fr)_52px_minmax(100px,0.9fr)_72px_minmax(150px,1.1fr)_170px]'
  );

  const row = (
    <div className={cn(columns, 'px-3 py-2')}>
      {/* 캠페인 · 게임 */}
      <div className='flex min-w-0 items-center gap-2.5'>
        {regionalUrl ? (
          <a
            href={regionalUrl}
            target='_blank'
            rel='noopener noreferrer'
            title='스토어에서 보기'
          >
            <GameIcon logo={campaign.gameLogoUrl} name={gameName} size='md' />
          </a>
        ) : (
          <GameIcon logo={campaign.gameLogoUrl} name={gameName} size='md' />
        )}
        <div className='min-w-0'>
          <div className='min-w-0 text-[13px] font-semibold'>
            {nameCell ?? <span className='block truncate'>{campaign.name}</span>}
          </div>
          <div className='flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground'>
            <GameThumbnailTooltip
              imageUrl={campaign.gameLogoUrl}
              gameName={gameName}
              packageIdentifier={campaign.gamePackageId}
              storeUrl={regionalUrl ?? null}
              enableCopy
            >
              {regionalUrl ? (
                <a
                  href={regionalUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='flex min-w-0 items-center gap-1 hover:text-foreground'
                >
                  <StoreFavicon url={gameStoreUrl} />
                  <span className='truncate'>{gameName}</span>
                </a>
              ) : (
                <span className='truncate'>{gameName}</span>
              )}
            </GameThumbnailTooltip>
            {campaign.campaignType && (
              <span className='flex-shrink-0'>· {campaign.campaignType}</span>
            )}
          </div>
        </div>
      </div>

      {/* 광고주 */}
      <div className='min-w-0 text-xs'>
        {campaign.company ? (
          accountHref ? (
            <Link
              href={accountHref}
              className='block truncate font-medium hover:text-primary hover:underline'
            >
              {campaign.company}
            </Link>
          ) : (
            <span className='block truncate font-medium'>{campaign.company}</span>
          )
        ) : (
          <span className='text-muted-foreground'>-</span>
        )}
      </div>

      {/* 리전 */}
      <div>
        {region && (
          <span className='rounded border px-1 py-px text-[10px] font-medium text-muted-foreground'>
            {region}
          </span>
        )}
      </div>

      {/* MMP */}
      <div className='flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground'>
        <MmpLogo mmp={campaign.mmp} small />
        <span className='truncate'>{campaign.mmp ?? '-'}</span>
      </div>

      {/* 상태 */}
      <div className={cn('flex items-center gap-1.5 text-xs', status?.text ?? 'text-muted-foreground')}>
        {status && <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />}
        {status?.label ?? campaign.status ?? '-'}
      </div>

      {/* 기간 */}
      <div className='flex items-center gap-2 whitespace-nowrap text-xs tabular-nums'>
        <span className={cn(ended && 'text-muted-foreground')}>
          {shortDate(campaign.startDate)} →{' '}
          {ended || campaign.endDate ? shortDate(campaign.endDate) : ''}
        </span>
        {days !== null && <span className='font-semibold'>{days}일째</span>}
      </div>

      {/* 담당자 (내부 전용) */}
      {assignee && (
        <div className='flex min-w-0 items-center gap-1.5 text-xs'>
          {assignee.name ? (
            <>
              <Avatar className='h-4 w-4'>
                {assignee.avatarUrl ? (
                  <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                ) : null}
                <AvatarFallback className='text-[9px]'>
                  {assignee.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className='truncate'>{assignee.name}</span>
            </>
          ) : (
            <span className='text-muted-foreground'>미지정</span>
          )}
        </div>
      )}

      {/* 시트 · JIRA · 메뉴 */}
      <div className='flex items-center justify-end gap-1'>
        {links?.reportUrl && (
          <a href={links.reportUrl} target='_blank' rel='noopener noreferrer' className={LINK_CLS}>
            <ServiceFavicon service='sheet' className='h-3.5 w-3.5' />
            시트
          </a>
        )}
        {links?.jiraUrl && (
          <a href={links.jiraUrl} target='_blank' rel='noopener noreferrer' className={LINK_CLS}>
            <ServiceFavicon service='jira' className='h-3.5 w-3.5' />
            JIRA
          </a>
        )}
        {actions}
      </div>
    </div>
  );

  return (
    <div className='overflow-hidden rounded-xl border bg-card'>
      <div className='overflow-x-auto'>
        <div className={assignee ? 'min-w-[920px]' : 'min-w-[820px]'}>
          <div
            className={cn(
              columns,
              'border-b bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground'
            )}
          >
            <span>캠페인 · 게임</span>
            <span>광고주</span>
            <span>리전</span>
            <span>MMP</span>
            <span>상태</span>
            <span>기간</span>
            {assignee && <span>담당자</span>}
            <span />
          </div>
          {contextMenu ? (
            <ContextMenu>
              <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
              {contextMenu}
            </ContextMenu>
          ) : (
            row
          )}
        </div>
      </div>
    </div>
  );
}
