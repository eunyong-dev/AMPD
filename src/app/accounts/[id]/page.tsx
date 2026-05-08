'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { PlusIcon, BuildingIcon, MapPinIcon, TargetIcon } from 'lucide-react';
import { AccessControl } from '@/components/access-control';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { useAccountManagement } from '@/hooks/use-account-management';
import { useGameManagement } from '@/hooks/use-game-management';
import { useCampaignManagement } from '@/hooks/use-campaign-management';
import { useUserManagement } from '@/hooks/use-user-management';
import { useUserContext } from '@/lib/user-context';
import { CreateGameForm } from '@/components/games/create-game-form';
import { AccountGamesTable } from '@/components/games/account-games-table';
import { CampaignsTable } from '@/components/campaigns/campaigns-table';
import { CreateCampaignForm } from '@/components/campaigns/create-campaign-form';
import { EditCampaignForm } from '@/components/campaigns/edit-campaign-form';
import { RefreshCampaignCacheButton } from '@/components/campaigns/refresh-campaign-cache-button';
import { CreateSettlementForm } from '@/components/settlements/create-settlement-form';
import { SettlementsTable } from '@/components/settlements/settlements-table';
import { useSettlementManagement } from '@/hooks/use-settlement-management';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function AccountDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  // URL slug = decodeURIComponent된 회사명 (UUID 노출 방지)
  const companyParam = decodeURIComponent(params.id as string);

  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [showCreateGameForm, setShowCreateGameForm] = useState(false);
  const [showCreateCampaignForm, setShowCreateCampaignForm] = useState(false);
  const [showEditCampaignForm, setShowEditCampaignForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);

  // Settlements
  const [showCreateSettlementForm, setShowCreateSettlementForm] = useState(false);
  
  // URL 파라미터에서 탭 정보 가져오기
  const tabFromUrl = searchParams.get('tab');
  const initialTab =
    tabFromUrl === 'games'
      ? 'games'
      : tabFromUrl === 'settlements'
      ? 'settlements'
      : 'campaigns';
  const [activeTab, setActiveTab] = useState(initialTab);

  // URL 파라미터가 변경되면 탭도 업데이트
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'campaigns' || tab === 'games' || tab === 'settlements') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const {
    accounts,
    loading: accountsLoading,
    createAccount,
    removeAccount,
  } = useAccountManagement();
  const {
    games,
    loading: gamesLoading,
    addGame,
    removeGame,
  } = useGameManagement();
  // 현재 계정 정보 — slug(=company)로 매칭
  const currentAccount = accounts.find(
    (account) => account.company === companyParam
  );
  const accountId = currentAccount?.id ?? '';

  const {
    campaigns,
    loading: campaignsLoading,
    addCampaign,
    updateCampaign,
    removeCampaign,
  } = useCampaignManagement(accountId);
  const {
    settlements,
    loading: settlementsLoading,
    creating: settlementCreating,
    createSettlement,
  } = useSettlementManagement(accountId);
  const { users: activeUsers } = useUserManagement();
  const { profile: currentUserProfile } = useUserContext();

  // 현재 계정의 게임들
  const accountGames = games.filter((game) => game.account_id === accountId);

  // Active 캠페인 수 (ongoing 상태)
  const activeCampaignsCount = campaigns.filter(
    (campaign) => campaign.status === 'ongoing'
  ).length;

  // 상태별 캠페인 통계
  const campaignStatsByStatus = useMemo(() => {
    return {
      planning: campaigns.filter((c) => c.status === 'planning').length,
      ongoing: campaigns.filter((c) => c.status === 'ongoing').length,
      holding: campaigns.filter((c) => c.status === 'holding').length,
      end: campaigns.filter((c) => c.status === 'end').length,
      total: campaigns.length,
    };
  }, [campaigns]);

  // 나라별 캠페인 통계
  const campaignStatsByRegion = useMemo(() => {
    return {
      KR: campaigns.filter((c) => c.region === 'KR').length,
      JP: campaigns.filter((c) => c.region === 'JP').length,
      TW: campaigns.filter((c) => c.region === 'TW').length,
      US: campaigns.filter((c) => c.region === 'US').length,
    };
  }, [campaigns]);

  // 권한 확인 (로딩 중이 아닐 때만)
  // Admin과 AM 모두 모든 계정 상세 페이지 접근 가능
  const hasAccess =
    !accountsLoading &&
    (currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'am');

  // 로딩 중일 때 스켈레톤 표시
  if (accountsLoading) {
    return (
      <AccessControl>
        <div className='space-y-4'>
          {/* Header Skeleton */}
          <div className='flex items-center justify-between'>
            <div className='space-y-2'>
              <Skeleton className='h-8 w-48' />
              <Skeleton className='h-4 w-64' />
            </div>
          </div>

          {/* Account Info Card Skeleton */}
          <Card>
            <CardContent className='p-6'>
              <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-5'>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className='space-y-2'>
                    <Skeleton className='h-4 w-20' />
                    <Skeleton className='h-6 w-32' />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tabs Skeleton */}
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <Skeleton className='h-9 w-48 rounded-xl' />
              <Skeleton className='h-9 w-32 rounded-lg' />
            </div>
            <div className='rounded-xl border'>
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className='flex items-center gap-4 px-4 py-3 border-b last:border-b-0'
                >
                  <Skeleton className='h-8 w-8 rounded-lg' />
                  <div className='flex-1 space-y-2'>
                    <Skeleton className='h-4 w-48' />
                    <Skeleton className='h-3 w-32' />
                  </div>
                  <Skeleton className='h-6 w-6 rounded' />
                  <Skeleton className='h-8 w-8 rounded' />
                </div>
              ))}
            </div>
          </div>
        </div>
      </AccessControl>
    );
  }

  // 로딩 완료 후 계정이 없는 경우
  if (!currentAccount) {
    return (
      <AccessControl>
        <div className='text-center py-12'>
          <h2 className='text-2xl font-semibold mb-4'>Account Not Found</h2>
          <p className='text-muted-foreground mb-6'>
            The account you&apos;re looking for doesn&apos;t exist or you don&apos;t have
            access to it.
          </p>
          <Button onClick={() => window.history.back()}>
            Back to Accounts
          </Button>
        </div>
      </AccessControl>
    );
  }

  // 권한이 없는 경우
  if (!hasAccess) {
    return (
      <AccessControl>
        <div className='text-center py-12'>
          <h2 className='text-2xl font-semibold mb-4'>Access Denied</h2>
          <p className='text-muted-foreground mb-6'>
            You don&apos;t have permission to view this account.
          </p>
          <Button onClick={() => window.history.back()}>
            Back to Accounts
          </Button>
        </div>
      </AccessControl>
    );
  }

  return (
    <AccessControl>
      <div className='space-y-4 w-full overflow-x-hidden'>
        {/* Header */}
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold tracking-tight flex items-center gap-3'>
              <BuildingIcon className='h-8 w-8 text-primary' />
              Account Detail
            </h1>
            <div className='flex items-center gap-3 mt-1'>
              <span className='text-base font-semibold'>
                {currentAccount.company}
              </span>
              <span className='text-sm text-muted-foreground'>•</span>
              <p className='text-sm text-muted-foreground'>
                {(() => {
                  const countryEmojiMap: Record<string, string> = {
                    KR: '🇰🇷',
                    JP: '🇯🇵',
                    TW: '🇹🇼',
                    US: '🇺🇸',
                    CN: '🇨🇳',
                  };
                  const emoji = countryEmojiMap[currentAccount.country] || '';
                  return emoji
                    ? `${emoji} ${currentAccount.country}`
                    : currentAccount.country;
                })()}
              </p>
              <span className='text-sm text-muted-foreground'>•</span>
              <div className='flex items-center gap-2'>
                <Avatar className='h-4 w-4'>
                  {(() => {
                    const assignedUser = activeUsers.find(
                      (u) => u.id === currentAccount.assigned_user_id
                    );
                    return assignedUser?.avatar_url ? (
                      <AvatarImage
                        src={assignedUser.avatar_url}
                        alt={currentAccount.assigned_user_name}
                      />
                    ) : null;
                  })()}
                  <AvatarFallback className='text-xs'>
                    {currentAccount.assigned_user_name
                      ? currentAccount.assigned_user_name.charAt(0).toUpperCase()
                      : 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className='text-sm text-muted-foreground'>
                  {currentAccount.assigned_user_name || 'Unassigned'}
                </span>
              </div>
            </div>
          </div>
          <div className='flex items-center gap-6'>
            <div className='text-right'>
              <p className='text-xs text-muted-foreground mb-1'>Games</p>
              <p className='text-2xl font-bold'>{accountGames.length}</p>
            </div>
            <div className='text-right'>
              <p className='text-xs text-muted-foreground mb-1'>Total Campaigns</p>
              <p className='text-2xl font-bold'>
                {campaignStatsByStatus.total}
              </p>
            </div>
          </div>
        </div>

        {/* Campaign Statistics */}
        <div className='space-y-6'>
          {/* By Status */}
          <div>
            <div className='flex items-center gap-2 mb-3'>
              <TargetIcon className='h-4 w-4 text-muted-foreground' />
              <h3 className='text-sm font-semibold'>Campaigns by Status</h3>
            </div>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
              {(
                [
                  {
                    label: 'Planning',
                    value: campaignStatsByStatus.planning,
                    color: '#eab308',
                  },
                  {
                    label: 'Ongoing',
                    value: campaignStatsByStatus.ongoing,
                    color: '#22c55e',
                  },
                  {
                    label: 'Holding',
                    value: campaignStatsByStatus.holding,
                    color: '#ef4444',
                  },
                  {
                    label: 'End',
                    value: campaignStatsByStatus.end,
                    color: '#94a3b8',
                  },
                ] as const
              ).map((s) => (
                <Card key={s.label}>
                  <CardContent className='p-4'>
                    <div className='flex items-center gap-1.5 text-xs text-muted-foreground mb-1'>
                      <span
                        className='h-2 w-2 rounded-full'
                        style={{ backgroundColor: s.color }}
                      />
                      {s.label}
                    </div>
                    <div className='text-2xl font-semibold tabular-nums'>
                      {s.value}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* By Region */}
          <div>
            <div className='flex items-center gap-2 mb-3'>
              <MapPinIcon className='h-4 w-4 text-muted-foreground' />
              <h3 className='text-sm font-semibold'>Campaigns by Region</h3>
            </div>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
              {(
                [
                  { label: '🇰🇷 KR', value: campaignStatsByRegion.KR },
                  { label: '🇯🇵 JP', value: campaignStatsByRegion.JP },
                  { label: '🇹🇼 TW', value: campaignStatsByRegion.TW },
                  { label: '🇺🇸 US', value: campaignStatsByRegion.US },
                ] as const
              ).map((r) => (
                <Card key={r.label}>
                  <CardContent className='p-4'>
                    <div className='text-xs text-muted-foreground mb-1'>
                      {r.label}
                    </div>
                    <div className='text-2xl font-semibold tabular-nums'>
                      {r.value}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Create Game Form */}
        <CreateGameForm
          isOpen={showCreateGameForm}
          onClose={() => setShowCreateGameForm(false)}
          onCreateGame={addGame}
          accountId={accountId}
        />

        {/* Create Campaign Form */}
        <CreateCampaignForm
          isOpen={showCreateCampaignForm}
          onClose={() => setShowCreateCampaignForm(false)}
          onCreateCampaign={addCampaign}
          accountId={accountId}
          games={accountGames}
        />

        <EditCampaignForm
          isOpen={showEditCampaignForm}
          onClose={() => {
            setShowEditCampaignForm(false);
            setEditingCampaign(null);
          }}
          onUpdateCampaign={updateCampaign}
          campaign={editingCampaign}
          accountId={accountId}
          games={accountGames}
        />

        {/* Tabs */}
        <Tabs
          value={activeTab}
          defaultValue={initialTab}
          className='space-y-4 w-full overflow-hidden'
          onValueChange={setActiveTab}
        >
          <div className='flex items-center justify-between'>
            <TabsList className='rounded-xl h-9'>
              <TabsTrigger
                value='campaigns'
                className='rounded-lg text-sm px-3 py-1 flex items-center gap-2'
              >
                Campaigns
                <span className='bg-muted text-muted-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center'>
                  {campaignStatsByStatus.total}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value='games'
                className='rounded-lg text-sm px-3 py-1 flex items-center gap-2'
              >
                Games
                <span className='bg-muted text-muted-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center'>
                  {accountGames.length}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value='settlements'
                className='rounded-lg text-sm px-3 py-1'
              >
                Settlements
              </TabsTrigger>
            </TabsList>

            <div className='flex items-center gap-2'>
            {/* Refresh Cache (campaigns 탭에서만) */}
            {activeTab === 'campaigns' && accountId && (
              <RefreshCampaignCacheButton accountId={accountId} />
            )}

            {/* Add Button */}
            {activeTab === 'campaigns' && accountGames.length === 0 ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className='inline-block'>
                      <Button
                        onClick={() => {
                          if (accountGames.length === 0) {
                            toast.error(
                              'Please add a game first before creating a campaign.'
                            );
                            return;
                          }
                          setShowCreateCampaignForm(true);
                        }}
                        size='sm'
                        disabled
                      >
                        <PlusIcon className='h-4 w-4' />
                        Add Campaign
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Please add a game first before creating a campaign.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button
                onClick={() => {
                  if (activeTab === 'games') {
                    setShowCreateGameForm(true);
                  } else if (activeTab === 'campaigns') {
                    if (accountGames.length === 0) {
                      toast.error(
                        'Please add a game first before creating a campaign.'
                      );
                      return;
                    }
                    setShowCreateCampaignForm(true);
                  } else if (activeTab === 'settlements') {
                    setShowCreateSettlementForm(true);
                  }
                }}
                size='sm'
              >
                <PlusIcon className='h-4 w-4' />
                {activeTab === 'games'
                  ? 'Add Game'
                  : activeTab === 'campaigns'
                  ? 'Add Campaign'
                  : 'Add Settlement'}
              </Button>
            )}
            </div>
          </div>

          <TabsContent value='games' className='space-y-4 w-full max-w-full overflow-hidden'>
            {accountGames.length > 0 ? (
              <AccountGamesTable
                games={accountGames}
                onDeleteGame={removeGame}
                currentUserProfile={currentUserProfile}
                accountAssignedUserId={currentAccount?.assigned_user_id}
              />
            ) : (
              <div className='text-center py-12'>
                <div className='mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4'>
                  <PlusIcon className='h-12 w-12 text-muted-foreground' />
                </div>
                <h3 className='text-lg font-semibold mb-2'>No games found</h3>
                <p className='text-muted-foreground mb-4'>
                  This account doesn&apos;t have any games yet.
                </p>
                <Button onClick={() => setShowCreateGameForm(true)}>
                  <PlusIcon className='mr-1 h-4 w-4' />
                  Add First Game
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value='campaigns' className='space-y-4 w-full overflow-hidden'>
            {campaigns.length > 0 ? (
              <CampaignsTable
                campaigns={campaigns}
                selectedCampaigns={selectedCampaigns}
                onSelectAll={(checked) => {
                  if (checked) {
                    setSelectedCampaigns(
                      campaigns.map((campaign) => campaign.id)
                    );
                  } else {
                    setSelectedCampaigns([]);
                  }
                }}
                onSelectCampaign={(campaignId, checked) => {
                  if (checked) {
                    setSelectedCampaigns([...selectedCampaigns, campaignId]);
                  } else {
                    setSelectedCampaigns(
                      selectedCampaigns.filter((id) => id !== campaignId)
                    );
                  }
                }}
                onDeleteCampaign={removeCampaign}
                onEditCampaign={(campaign) => {
                  setEditingCampaign(campaign);
                  setShowEditCampaignForm(true);
                }}
                currentUserProfile={currentUserProfile}
                accountAssignedUserId={currentAccount?.assigned_user_id}
                columnVisibility={{
                  campaignTitle: true,
                  gameName: true,
                  assignedUser: false,
                  region: true,
                  mmp: true,
                  type: true,
                  dateRange: true,
                  status: true,
                  jiraUrl: true,
                  dailyReportUrl: true,
                }}
              />
            ) : (
              <div className='text-center py-12'>
                <div className='mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4'>
                  <PlusIcon className='h-12 w-12 text-muted-foreground' />
                </div>
                <h3 className='text-lg font-semibold mb-2'>
                  No campaigns found
                </h3>
                <p className='text-muted-foreground mb-4'>
                  This account doesn&apos;t have any campaigns yet.
                </p>
                {accountGames.length === 0 ? (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className='inline-block'>
                          <Button
                            onClick={() => {
                              toast.error(
                                'Please add a game first before creating a campaign.'
                              );
                            }}
                            disabled
                          >
                            <PlusIcon className='mr-1 h-4 w-4' />
                            Add First Campaign
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Please add a game first before creating a campaign.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <Button
                    onClick={() => {
                      setShowCreateCampaignForm(true);
                    }}
                  >
                    <PlusIcon className='mr-1 h-4 w-4' />
                    Add First Campaign
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent
            value='settlements'
            className='space-y-4 w-full overflow-hidden'
          >
            <SettlementsTable
              settlements={settlements}
              accountCompany={currentAccount?.company ?? ''}
              loading={settlementsLoading}
            />
          </TabsContent>
        </Tabs>

        <CreateSettlementForm
          isOpen={showCreateSettlementForm}
          onClose={() => setShowCreateSettlementForm(false)}
          submitting={settlementCreating}
          campaigns={campaigns.map((c) => ({
            id: c.id,
            name: c.name,
            game_store_url: c.game_store_url,
            game_logo_url: c.game_logo_url,
            region: c.region,
            campaign_type: c.campaign_type,
            daily_report_url: c.daily_report_url,
            game_package_identifier: c.game_package_identifier,
          }))}
          onCreate={async (data) => {
            const selected = campaigns.filter((c) =>
              data.campaign_ids.includes(c.id)
            );
            try {
              const created = await createSettlement({
                account_id: accountId,
                title: data.title,
                period_from: data.period_from,
                period_to: data.period_to,
                campaigns: selected.map((c) => ({
                  id: c.id,
                  name: c.name,
                  region: c.region ?? null,
                  campaign_type: c.campaign_type ?? null,
                  daily_report_url: c.daily_report_url ?? null,
                  game_package_identifier:
                    c.game_package_identifier ?? null,
                })),
              });
              toast.success(
                `Settlement created with ${created.lines.length} line${
                  created.lines.length !== 1 ? 's' : ''
                }.`
              );
            } catch (err) {
              const msg =
                err instanceof Error ? err.message : 'Unknown error';
              toast.error(`Failed to create settlement: ${msg}`);
              throw err;
            }
          }}
        />
      </div>
      <Toaster position='top-center' />
    </AccessControl>
  );
}
