'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  CampaignInfoTable,
  type CampaignInfo,
} from '@/components/campaigns/campaign-detail/campaign-info-table';
import { CampaignPerformance } from '@/components/campaigns/campaign-detail/campaign-performance';
import {
  useShareListHref,
  type PublicCampaign,
} from '@/components/share/share-campaign-ui';

type Row = Record<string, unknown>;

interface ShareReportResponse {
  campaign: PublicCampaign;
  rows: Row[];
  hasReport: boolean;
  reportError: string | null;
}

// 표 영역 높이: 표가 h-full(내부 스크롤 + sticky 헤더)이라 확정 높이가 필요.
// lg+ 는 남은 화면을 채우고, 그 이하는 고정 높이(최소 320px) + 페이지 스크롤.
const TAB_PANEL_CLS =
  'h-[70dvh] min-h-[320px] min-w-0 lg:h-auto lg:min-h-0 lg:flex-1';

// 공개 API 응답 → 내부 캠페인 상세와 같은 정보 표 형태
const toCampaignInfo = (c: PublicCampaign): CampaignInfo => ({
  name: c.name,
  company: c.account?.company ?? null,
  gameName: c.game?.game_name ?? null,
  regionalGameName: c.regional_game_name ?? null,
  gameLogoUrl: c.game?.logo_url ?? null,
  gamePackageId: c.game?.package_identifier ?? null,
  gameStoreUrl: c.game?.store_url ?? null,
  region: c.region,
  mmp: c.mmp,
  campaignType: c.campaign_type,
  startDate: c.start_date,
  endDate: c.end_date,
});

/**
 * 공개(비로그인) 캠페인 성과 뷰어.
 * 내부 캠페인 상세와 같은 컴포넌트(CampaignInfoTable / CampaignPerformance)를 쓰고,
 * 내부 전용 요소(담당자·Jira·시트 링크·수정/삭제·비교·변경 기록·새로고침)만 뺀다.
 */
export default function SharedCampaignViewerPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const listHref = useShareListHref(); // 마지막으로 본 목록 필터로 돌아가기

  const [campaign, setCampaign] = useState<PublicCampaign | null>(null);
  const [allRows, setAllRows] = useState<Row[] | null>(null);
  const [hasReport, setHasReport] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFatal(null);
      try {
        const res = await fetch(
          `/api/share/campaigns/${encodeURIComponent(id)}`
        );
        const json = (await res.json().catch(() => ({}))) as Partial<
          ShareReportResponse & { error: string }
        >;
        if (!res.ok || !json.campaign) {
          throw new Error(json.error || '캠페인을 불러오지 못했습니다.');
        }
        if (cancelled) return;
        setCampaign(json.campaign);
        setHasReport(json.hasReport ?? false);
        setReportError(json.reportError ?? null);
        setAllRows(json.rows ?? []);
      } catch (e) {
        if (!cancelled) {
          setFatal(
            e instanceof Error ? e.message : '캠페인을 불러오지 못했습니다.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  if (fatal) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center'>
        <p className='text-sm text-muted-foreground'>{fatal}</p>
        <div className='flex gap-2'>
          <Button variant='outline' asChild>
            <Link href={listHref}>
              <ArrowLeft className='h-4 w-4' />
              캠페인 현황
            </Link>
          </Button>
          <Button onClick={() => setReloadKey((k) => k + 1)}>
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  return (
    // 데스크톱(lg+): 화면 높이에 고정 → 표 내부 스크롤 + sticky 헤더 (내부 상세와 동일)
    // 모바일/짧은 화면: 페이지 자체가 스크롤 (헤더가 커도 표가 0px 로 접히지 않게)
    <div className='flex min-h-[100dvh] flex-col bg-background lg:h-[100dvh]'>
      <div className='mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 px-4 py-6 sm:px-6 lg:min-h-0'>
        {/* 상단: 목록으로 + 캠페인 정보 표 */}
        <div className='flex-shrink-0 space-y-3'>
          <Link
            href={listHref}
            className='inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground'
          >
            <ArrowLeft className='h-4 w-4' />
            캠페인 현황
          </Link>
          {loading && !campaign ? (
            <Skeleton className='h-[90px] w-full rounded-xl' />
          ) : campaign ? (
            <CampaignInfoTable campaign={toCampaignInfo(campaign)} />
          ) : null}
        </div>

        {/* 일간 / 월간 / 차트 */}
        {!loading && campaign && !hasReport ? (
          <div className='rounded-xl border py-16 text-center text-sm text-muted-foreground'>
            성과 리포트가 연결되지 않은 캠페인입니다.
          </div>
        ) : (
          <CampaignPerformance
            allData={allRows}
            loading={loading}
            error={reportError}
            onRetry={() => setReloadKey((k) => k + 1)}
            className='flex min-w-0 flex-col gap-4 lg:min-h-0 lg:flex-1'
            panelClassName={TAB_PANEL_CLS}
          />
        )}
      </div>
    </div>
  );
}
