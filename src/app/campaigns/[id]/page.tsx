'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  RefreshCw,
  ExternalLink,
  ExternalLinkIcon,
  MoreHorizontalIcon,
  EditIcon,
  TrashIcon,
  StickyNote,
} from 'lucide-react';
import { AccessControl } from '@/components/access-control';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenuContent,
  ContextMenuItem,
} from '@/components/ui/context-menu';
import { canManageResource } from '@/lib/utils/permissions';
import { useUserContext } from '@/lib/user-context';
import {
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  type Campaign,
} from '@/hooks/use-campaign-management';
import { parseSheetDate } from '@/lib/utils/sheet-formatters';
import { EditCampaignForm } from '@/components/campaigns/edit-campaign-form';
import { CampaignSwitcher } from '@/components/campaigns/campaign-detail/campaign-switcher';
import { AddNoteModal } from '@/components/campaigns/campaign-detail/add-note-modal';
import { CampaignInfoTable } from '@/components/campaigns/campaign-detail/campaign-info-table';
import { CampaignPerformance } from '@/components/campaigns/campaign-detail/campaign-performance';
import { DeleteConfirmationDialog } from '@/components/common/delete-confirmation-dialog';
import { getAllGames } from '@/hooks/use-game-management';
import { accountUrl } from '@/lib/utils/account-url';

interface SheetData {
  [key: string]: any;
}

// Google Sheets URL에서 sheetId와 gid 추출
function extractSheetParams(
  url: string
): { sheetId: string; gid: string } | null {
  try {
    // Google Sheets URL 형식: https://docs.google.com/spreadsheets/d/{sheetId}/edit?gid={gid}#gid={gid}
    const sheetIdMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const gidMatch = url.match(/[#&]gid=(\d+)/);

    if (sheetIdMatch && gidMatch) {
      return {
        sheetId: sheetIdMatch[1],
        gid: gidMatch[1],
      };
    }

    return null;
  } catch (error) {
    console.error('URL 파싱 오류:', error);
    return null;
  }
}

// 날짜 컬럼 이름 찾기
const findDateHeader = (row: SheetData | undefined): string | null => {
  if (!row) return null;
  return (
    Object.keys(row).find(
      (h) => h === '날짜' || h === 'date' || h.toLowerCase() === 'date'
    ) ?? null
  );
};

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState<SheetData[] | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [showEditCampaignForm, setShowEditCampaignForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [allGames, setAllGames] = useState<any[]>([]);

  const { profile: userProfile } = useUserContext();

  // 권한 확인
  const assignedUserId =
    campaign?.assigned_user_id !== undefined ? campaign.assigned_user_id : '';
  const isManageAllowed = canManageResource(userProfile, assignedUserId);

  // 게임 목록 로드
  useEffect(() => {
    const loadGames = async () => {
      try {
        const games = await getAllGames();
        setAllGames(games);
      } catch (err) {
        console.error('게임 로드 오류:', err);
      }
    };
    loadGames();
  }, []);

  // 캠페인 수정
  const handleUpdateCampaign = useCallback(
    async (
      campaignId: string,
      campaignData: Partial<Campaign>
    ): Promise<void> => {
      try {
        const updatedCampaign = await updateCampaign(campaignId, campaignData);
        setCampaign(updatedCampaign);
        toast.success('캠페인이 업데이트되었습니다.');
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : '캠페인을 업데이트하는 중 오류가 발생했습니다.';
        toast.error(`캠페인 업데이트 실패: ${errorMessage}`);
        throw err;
      }
    },
    []
  );

  // 편집 핸들러
  const handleEditCampaign = useCallback(() => {
    if (!campaign) return;
    setShowEditCampaignForm(true);
  }, [campaign]);

  // 삭제 클릭 핸들러
  const handleDeleteClick = useCallback(() => {
    if (!campaign) return;

    if (!isManageAllowed) {
      toast.error(
        '본인에게 할당된 광고주의 캠페인만 삭제할 수 있습니다.'
      );
      return;
    }
    setShowDeleteDialog(true);
  }, [campaign, isManageAllowed]);

  // 삭제 확인 핸들러
  const handleDeleteCampaign = useCallback(async () => {
    if (!campaign) return;

    try {
      await deleteCampaign(campaign.id);
      toast.success('캠페인이 삭제되었습니다');
      router.push('/campaigns');
    } catch (err) {
      toast.error(
        `캠페인 삭제 실패: ${
          err instanceof Error ? err.message : '알 수 없는 오류'
        }`
      );
    }
  }, [campaign, router]);

  // 캠페인 정보 로드
  useEffect(() => {
    const loadCampaign = async () => {
      try {
        setLoading(true);
        const campaignData = await getCampaignById(campaignId);
        if (campaignData) {
          setCampaign(campaignData);
          // Report URL이 있으면 자동으로 데이터 가져오기 (초기 로드: 마지막 날짜 기준 30일)
          if (campaignData.daily_report_url) {
            fetchSheetData(campaignData.daily_report_url);
          }
        } else {
          toast.error('캠페인을 찾을 수 없습니다.');
          router.push('/campaigns');
        }
      } catch (err) {
        console.error('캠페인 로드 오류:', err);
        toast.error('캠페인을 불러올 수 없습니다.');
        router.push('/campaigns');
      } finally {
        setLoading(false);
      }
    };

    if (campaignId) {
      loadCampaign();
    }
  }, [campaignId, router]);

  // Google Sheets 데이터 가져오기 (전체를 한 번에 로드, 기간 필터·집계는 CampaignPerformance 에서)
  // forceRefresh=true면 서버 캐시 무시하고 최신 데이터 fetch
  const fetchSheetData = async (
    reportUrl: string,
    forceRefresh = false
  ) => {
    setDataLoading(true);
    setDataError(null);

    try {
      const params = extractSheetParams(reportUrl);
      if (!params) {
        throw new Error('Invalid Google Sheets URL.');
      }

      const urlParams = new URLSearchParams({
        gid: params.gid,
        sheetId: params.sheetId,
      });
      if (forceRefresh) urlParams.set('noCache', '1');

      const response = await fetch(
        `/api/google-sheets?${urlParams.toString()}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || `API 호출 실패: ${response.status}`);
      }

      let fetchedData: SheetData[] = [];
      if (Array.isArray(result.data)) {
        fetchedData = result.data;
      } else if (result.data && typeof result.data === 'object') {
        fetchedData = [result.data];
      }

      // 오래된 날짜부터 정렬 (변경 기록 모달 등에서 그대로 사용)
      const dateHeader = findDateHeader(fetchedData[0]);
      if (dateHeader) {
        fetchedData = fetchedData.sort((a, b) => {
          const dateA = parseSheetDate(a[dateHeader]);
          const dateB = parseSheetDate(b[dateHeader]);
          if (!dateA || !dateB) return 0;
          return dateA.getTime() - dateB.getTime();
        });
      }

      setAllData(fetchedData);
      toast.success('데이터를 불러왔습니다.');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setDataError(errorMessage);
      toast.error(`데이터 불러오기 실패: ${errorMessage}`);
      console.error('Google Sheets 데이터 가져오기 오류:', err);
    } finally {
      setDataLoading(false);
    }
  };

  if (loading) {
    return (
      <AccessControl>
        <div className='space-y-4'>
          {/* Header Skeleton */}
          <div className='flex items-center justify-between'>
            <div className='space-y-2'>
              <Skeleton className='h-8 w-64' />
              <Skeleton className='h-4 w-96' />
            </div>
          </div>

          {/* Campaign Info Card Skeleton */}
          <Card>
            <CardContent className='p-6'>
              <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
                {[...Array(4)].map((_, i) => (
                  <div key={i} className='space-y-2'>
                    <Skeleton className='h-4 w-20' />
                    <Skeleton className='h-6 w-32' />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Data Table Skeleton */}
          <Card>
            <CardContent className='p-6'>
              <Skeleton className='h-96 w-full' />
            </CardContent>
          </Card>
        </div>
      </AccessControl>
    );
  }

  if (!campaign) {
    return (
      <AccessControl>
        <div className='space-y-4'>
          <Card>
            <CardContent className='pt-6'>
              <p className='text-center text-muted-foreground'>
                캠페인을 찾을 수 없습니다.
              </p>
            </CardContent>
          </Card>
        </div>
      </AccessControl>
    );
  }

  return (
    <AccessControl>
      <div
        className='flex flex-col gap-4 w-full overflow-x-hidden'
        style={{ height: 'calc(100vh - 96px)' }}
      >
        {/* Campaign Information — 상단 고정 (스크롤 안 됨). 공개 뷰어와 같은 컴포넌트 */}
        <div className='flex-shrink-0 space-y-4'>
          <CampaignInfoTable
            campaign={{
              name: campaign.name,
              company: campaign.account_company ?? null,
              gameName: campaign.game_name ?? null,
              regionalGameName: campaign.regional_game_name ?? null,
              gameLogoUrl: campaign.game_logo_url ?? null,
              gamePackageId: campaign.game_package_identifier ?? null,
              gameStoreUrl: campaign.game_store_url ?? null,
              region: campaign.region ?? null,
              mmp: campaign.mmp ?? null,
              campaignType: campaign.campaign_type ?? null,
              startDate: campaign.start_date ?? null,
              endDate: campaign.end_date ?? null,
            }}
            // Campaign Name — Switcher 로 다른 캠페인 빠른 전환
            nameCell={
              <CampaignSwitcher
                currentCampaign={{
                  id: campaign.id,
                  name: campaign.name,
                  account_company: campaign.account_company ?? null,
                  region: campaign.region ?? null,
                }}
              />
            }
            accountHref={
              campaign.account_id && campaign.account_company
                ? accountUrl(campaign.account_company)
                : null
            }
            assignee={{
              name: campaign.assigned_user_name ?? null,
              avatarUrl: campaign.assigned_user_avatar_url ?? null,
            }}
            links={{
              jiraUrl: campaign.jira_url ?? null,
              reportUrl: campaign.daily_report_url ?? null,
            }}
            actions={
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
                <DropdownMenuContent
                  align='end'
                  className='w-auto min-w-[120px]'
                >
                  <DropdownMenuItem
                    onClick={handleEditCampaign}
                    className='flex items-center gap-0'
                    disabled={!isManageAllowed}
                  >
                    <EditIcon className='mr-1 h-4 w-4' />
                    캠페인 수정
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDeleteClick}
                    className='text-red-600 focus:text-red-600 flex items-center gap-0'
                    disabled={!isManageAllowed}
                  >
                    <TrashIcon className='mr-1 h-4 w-4' />
                    캠페인 삭제
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
            contextMenu={
              <ContextMenuContent className='w-auto min-w-[180px]'>
                <ContextMenuItem
                  onClick={handleEditCampaign}
                  disabled={!isManageAllowed}
                >
                  <EditIcon className='mr-2 h-4 w-4' />
                  캠페인 수정
                </ContextMenuItem>
                {campaign.jira_url && (
                  <ContextMenuItem
                    onClick={() =>
                      window.open(
                        campaign.jira_url!,
                        '_blank',
                        'noopener,noreferrer'
                      )
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
                  onClick={handleDeleteClick}
                  disabled={!isManageAllowed}
                  className='text-red-600 focus:text-red-600'
                >
                  <TrashIcon className='mr-2 h-4 w-4' />
                  캠페인 삭제
                </ContextMenuItem>
              </ContextMenuContent>
            }
          />
        </div>

        {/* 일간 / 월간 / 차트 — 공개 뷰어와 같은 컴포넌트 (비교·변경 기록·시트·새로고침은 내부 전용) */}
        {campaign.daily_report_url ? (
          <CampaignPerformance
            allData={allData}
            loading={dataLoading}
            error={dataError}
            onRetry={() => fetchSheetData(campaign.daily_report_url!, true)}
            enableCompare
            toolbarActions={
              <>
                <Button
                  variant='outline'
                  size='sm'
                  className='flex-shrink-0'
                  onClick={() => setShowAddNoteModal(true)}
                  title='비고 기록 / CPI 단가 변경'
                >
                  <StickyNote className='h-4 w-4' />
                  <span className='max-[1100px]:hidden'>변경 기록</span>
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  className='flex-shrink-0'
                  onClick={() => {
                    const url = campaign.daily_report_url!;
                    window.open(url, '_blank');
                  }}
                >
                  <ExternalLink className='h-4 w-4' />
                  <span className='max-[1100px]:hidden'>시트 보기</span>
                </Button>
                <Button
                  variant='default'
                  size='sm'
                  className='bg-black text-white hover:bg-black/90 flex-shrink-0'
                  onClick={() =>
                    fetchSheetData(campaign.daily_report_url!, true)
                  }
                  disabled={dataLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${dataLoading ? 'animate-spin' : ''}`}
                  />
                  <span className='max-[1100px]:hidden'>새로고침</span>
                </Button>
              </>
            }
          />
        ) : (
          <Card>
            <CardContent className='pt-6'>
              <p className='text-center text-muted-foreground'>
                Report URL이 설정되지 않았습니다.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Edit Campaign Form */}
        {campaign && (
          <EditCampaignForm
            isOpen={showEditCampaignForm}
            onClose={() => {
              setShowEditCampaignForm(false);
            }}
            onUpdateCampaign={async (campaignId, campaignData) => {
              await handleUpdateCampaign(campaignId, campaignData);
            }}
            campaign={campaign}
            accountId={campaign.account_id}
            games={allGames.filter(
              (game) => game.account_id === campaign.account_id
            )}
          />
        )}

        {/* Add Note Modal — 시트 비고 컬럼에 메모 기록 */}
        {campaign && (
          <AddNoteModal
            isOpen={showAddNoteModal}
            onClose={() => setShowAddNoteModal(false)}
            campaignId={campaign.id}
            campaignName={campaign.name}
            timezone={campaign.timezone}
            rows={allData ?? undefined}
            onSaved={() => {
              // 시트 데이터 새로고침해서 변경 사항 반영
              if (campaign.daily_report_url) {
                fetchSheetData(campaign.daily_report_url, true);
              }
            }}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          isOpen={showDeleteDialog}
          onClose={() => {
            setShowDeleteDialog(false);
          }}
          onConfirm={handleDeleteCampaign}
          title={isManageAllowed ? '정말 삭제하시겠습니까?' : '캠페인을 삭제할 수 없습니다'}
          description={
            isManageAllowed
              ? `이 작업은 되돌릴 수 없습니다. ${campaign?.name} 캠페인이 영구적으로 삭제됩니다.`
              : `본인에게 할당된 광고주의 캠페인만 삭제할 수 있습니다. ${campaign?.name} 캠페인은 다른 사용자에게 할당된 광고주의 캠페인입니다.`
          }
          confirmLabel='삭제'
          cancelLabel='닫기'
          isAllowed={isManageAllowed}
        />
      </div>
    </AccessControl>
  );
}
