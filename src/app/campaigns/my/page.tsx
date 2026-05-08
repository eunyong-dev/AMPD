'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  UserIcon,
  MapPinIcon,
  ColumnsIcon,
  ChevronDownIcon,
  GlobeIcon,
  SearchIcon,
  TargetIcon,
} from 'lucide-react';
import { AccessControl } from '@/components/access-control';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatBreakdownCard } from '@/components/common/stat-breakdown-card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  getMyCampaigns,
  deleteCampaign,
  updateCampaign,
  type Campaign,
} from '@/hooks/use-campaign-management';
import { getAllGames } from '@/hooks/use-game-management';
import { useUserContext } from '@/lib/user-context';
import { useAuth } from '@/hooks/use-auth';
import { CampaignsTable } from '@/components/campaigns/campaigns-table';
import { EditCampaignForm } from '@/components/campaigns/edit-campaign-form';

export default function MyCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [showEditCampaignForm, setShowEditCampaignForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [allGames, setAllGames] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({
    campaignTitle: true,
    account: true,
    gameName: true,
    assignedUser: false,
    region: true,
    mmp: true,
    type: true,
    dateRange: true,
    status: true,
    jiraUrl: true,
    dailyReportUrl: true,
  });
  const { profile: currentUserProfile } = useUserContext();
  const { user: currentUser } = useAuth();

  // 캠페인 목록 로드 — assigned_user_id 는 user_profiles.id 기반이므로 profile.id 사용
  const loadCampaigns = useCallback(async () => {
    if (!currentUserProfile?.id) return;

    try {
      setLoading(true);
      const data = await getMyCampaigns(currentUserProfile.id);
      setCampaigns(data);
    } catch (err) {
      console.error('내 캠페인 로드 오류:', err);
      toast.error(
        `캠페인 불러오기 실패: ${
          err instanceof Error ? err.message : '알 수 없는 오류'
        }`
      );
    } finally {
      setLoading(false);
    }
  }, [currentUserProfile?.id]);

  // 게임 목록 로드
  const loadGames = useCallback(async () => {
    try {
      const games = await getAllGames();
      setAllGames(games);
    } catch (err) {
      console.error('게임 로드 오류:', err);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
    loadGames();
  }, [loadCampaigns, loadGames]);

  // 캠페인 삭제
  const handleDeleteCampaign = useCallback(async (campaignId: string) => {
    try {
      await deleteCampaign(campaignId);
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
    } catch (err) {
      throw err;
    }
  }, []);

  // 캠페인 수정
  const handleUpdateCampaign = useCallback(
    async (
      campaignId: string,
      campaignData: Partial<Campaign>
    ): Promise<void> => {
      try {
        const updatedCampaign = await updateCampaign(campaignId, campaignData);
        // 로컬 state만 업데이트 (전체 재로드 없이)
        setCampaigns((prevCampaigns) =>
          prevCampaigns.map((campaign) =>
            campaign.id === campaignId ? updatedCampaign : campaign
          )
        );
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

  // 캠페인 편집 핸들러
  const handleEditCampaign = useCallback((campaign: Campaign) => {
    setEditingCampaign(campaign);
    setShowEditCampaignForm(true);
  }, []);

  // 통계 계산
  const stats = useMemo(() => {
    return {
      total: campaigns.length,
      planning: campaigns.filter((c) => c.status === 'planning').length,
      ongoing: campaigns.filter((c) => c.status === 'ongoing').length,
      holding: campaigns.filter((c) => c.status === 'holding').length,
      end: campaigns.filter((c) => c.status === 'end').length,
    };
  }, [campaigns]);

  // 지역별 캠페인 통계
  const campaignStatsByRegion = useMemo(() => {
    return {
      KR: campaigns.filter((c) => c.region === 'KR').length,
      JP: campaigns.filter((c) => c.region === 'JP').length,
      TW: campaigns.filter((c) => c.region === 'TW').length,
      US: campaigns.filter((c) => c.region === 'US').length,
    };
  }, [campaigns]);

  // 지역 선택 토글
  const toggleRegionSelection = useCallback((region: string) => {
    setSelectedRegions((prev) => {
      if (region === 'all') {
        return prev.includes('all') ? [] : ['all'];
      }
      if (prev.includes('all')) {
        return [region];
      }
      if (prev.includes(region)) {
        return prev.filter((r) => r !== region);
      }
      return [...prev, region];
    });
  }, []);

  // 지역 옵션
  const regionOptions = [
    { value: 'KR', label: '🇰🇷 Korea', code: 'KR' },
    { value: 'JP', label: '🇯🇵 Japan', code: 'JP' },
    { value: 'TW', label: '🇹🇼 Taiwan', code: 'TW' },
    { value: 'US', label: '🇺🇸 United States', code: 'US' },
  ];

  // 상태별, 지역별, 검색어 필터링된 캠페인
  const filteredCampaigns = useMemo(() => {
    let filtered = campaigns;

    // 상태 필터링
    if (statusFilter !== 'all') {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    // 지역 필터링
    if (selectedRegions.length > 0 && !selectedRegions.includes('all')) {
      filtered = filtered.filter(
        (c) => c.region && selectedRegions.includes(c.region)
      );
    }

    // 검색어 필터링
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((c) => {
        const campaignName = c.name?.toLowerCase() || '';
        const gameName = c.game_name?.toLowerCase() || '';
        const assignedUserName = c.assigned_user_name?.toLowerCase() || '';
        return (
          campaignName.includes(searchLower) ||
          gameName.includes(searchLower) ||
          assignedUserName.includes(searchLower)
        );
      });
    }

    return filtered;
  }, [campaigns, statusFilter, selectedRegions, searchTerm]);

  // 로딩 중일 때 스켈레톤 표시
  if (loading) {
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

          {/* Stats Cards Skeleton */}
          <div className='grid grid-cols-1 gap-4 xl:grid-cols-4'>
            {[...Array(4)].map((_, i) => (
              <div key={i} className='rounded-xl border p-4 space-y-3'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-8 w-20' />
              </div>
            ))}
          </div>

          {/* Table Skeleton */}
          <div className='rounded-xl border'>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className='flex items-center gap-4 px-4 py-3 border-b last:border-b-0'
              >
                <Skeleton className='h-4 w-40' />
                <Skeleton className='h-4 w-32' />
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-4 w-20' />
              </div>
            ))}
          </div>
        </div>
      </AccessControl>
    );
  }

  return (
    <AccessControl>
      <div className='space-y-4'>
        {/* Campaign Statistics */}
        <div className='grid grid-cols-1 min-[1950px]:grid-cols-2 gap-4'>
          <StatBreakdownCard
            icon={<TargetIcon className='h-4 w-4 text-muted-foreground' />}
            title='상태별 캠페인'
            items={[
              { key: 'planning', label: '계획', value: stats.planning, color: '#eab308' },
              { key: 'ongoing', label: '진행중', value: stats.ongoing, color: '#22c55e' },
              { key: 'holding', label: '홀딩', value: stats.holding, color: '#ef4444' },
              { key: 'end', label: '종료', value: stats.end, color: '#94a3b8' },
            ]}
          />
          <StatBreakdownCard
            icon={<MapPinIcon className='h-4 w-4 text-muted-foreground' />}
            title='지역별 캠페인'
            items={[
              { key: 'KR', label: '🇰🇷 KR', value: campaignStatsByRegion.KR, color: '#3b82f6' },
              { key: 'JP', label: '🇯🇵 JP', value: campaignStatsByRegion.JP, color: '#a855f7' },
              { key: 'TW', label: '🇹🇼 TW', value: campaignStatsByRegion.TW, color: '#14b8a6' },
              { key: 'US', label: '🇺🇸 US', value: campaignStatsByRegion.US, color: '#f97316' },
            ]}
          />
        </div>

        {/* Search - 1450px 이하일 때 위쪽에 표시 */}
        <div className='search-break:hidden'>
          <div className='relative w-full'>
            <SearchIcon className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='캠페인 검색...'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className='pl-10 h-9 w-full'
              autoComplete='off'
            />
          </div>
        </div>

        {/* Status Tabs and Filters */}
        <div className='overflow-x-auto py-1'>
          <div className='flex items-center justify-between gap-4 min-w-max'>
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList className='rounded-xl h-9'>
                <TabsTrigger
                  value='all'
                  className='rounded-lg text-sm px-3 py-1'
                >
                  전체
                </TabsTrigger>
                <TabsTrigger
                  value='planning'
                  className='rounded-lg text-sm px-3 py-1'
                >
                  계획
                </TabsTrigger>
                <TabsTrigger
                  value='ongoing'
                  className='rounded-lg text-sm px-3 py-1'
                >
                  진행중
                </TabsTrigger>
                <TabsTrigger
                  value='holding'
                  className='rounded-lg text-sm px-3 py-1'
                >
                  홀딩
                </TabsTrigger>
                <TabsTrigger
                  value='end'
                  className='rounded-lg text-sm px-3 py-1'
                >
                  종료
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Search and Filters */}
            <div className='flex items-center gap-2 flex-shrink-0'>
              {/* Search - 1450px 이상일 때 필터와 함께 표시 */}
              <div className='hidden search-break:block relative flex-1 max-w-md min-w-0'>
                <SearchIcon className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  placeholder='캠페인 검색...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='pl-10 h-9'
                  autoComplete='off'
                />
              </div>
              {/* Region Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant='outline'
                    size='sm'
                    className='w-auto justify-between flex-shrink-0'
                  >
                    <GlobeIcon className='h-4 w-4' />
                    <span className='hidden filter-break:inline ml-2'>
                      {selectedRegions.length === 0
                        ? '전체 지역'
                        : selectedRegions.includes('all')
                        ? '전체 지역'
                        : `${selectedRegions.length}개 선택`}
                    </span>
                    <ChevronDownIcon className='hidden filter-break:block ml-2 h-4 w-4' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className='w-[180px]'>
                  <DropdownMenuItem
                    onClick={() => toggleRegionSelection('all')}
                    onSelect={(e) => e.preventDefault()}
                    className='flex items-center gap-2'
                  >
                    <Checkbox
                      checked={selectedRegions.includes('all')}
                      onCheckedChange={() => {}}
                      className='data-[state=checked]:bg-black data-[state=checked]:border-black'
                    />
                    <span>전체 지역</span>
                  </DropdownMenuItem>
                  {regionOptions.map((region) => (
                    <DropdownMenuItem
                      key={region.value}
                      onClick={() => toggleRegionSelection(region.value)}
                      onSelect={(e) => e.preventDefault()}
                      className='flex items-center gap-2'
                    >
                      <Checkbox
                        checked={selectedRegions.includes(region.value)}
                        onCheckedChange={() => {}}
                        className='data-[state=checked]:bg-black data-[state=checked]:border-black'
                      />
                      <span className='text-xs'>{region.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Customize Columns */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='outline' size='sm' className='flex-shrink-0'>
                    <ColumnsIcon className='h-4 w-4' />
                    <span className='hidden filter-break:inline ml-2'>
                      컬럼 설정
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' className='w-56'>
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.campaignTitle}
                    onCheckedChange={(checked) =>
                      setColumnVisibility((prev) => ({
                        ...prev,
                        campaignTitle: checked,
                      }))
                    }
                  >
                    캠페인 제목
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.gameName}
                    onCheckedChange={(checked) =>
                      setColumnVisibility((prev) => ({
                        ...prev,
                        gameName: checked,
                      }))
                    }
                  >
                    게임명
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.assignedUser}
                    onCheckedChange={(checked) =>
                      setColumnVisibility((prev) => ({
                        ...prev,
                        assignedUser: checked,
                      }))
                    }
                  >
                    담당자
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.region}
                    onCheckedChange={(checked) =>
                      setColumnVisibility((prev) => ({
                        ...prev,
                        region: checked,
                      }))
                    }
                  >
                    지역
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.mmp}
                    onCheckedChange={(checked) =>
                      setColumnVisibility((prev) => ({
                        ...prev,
                        mmp: checked,
                      }))
                    }
                  >
                    MMP
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.type}
                    onCheckedChange={(checked) =>
                      setColumnVisibility((prev) => ({
                        ...prev,
                        type: checked,
                      }))
                    }
                  >
                    타입
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.dateRange}
                    onCheckedChange={(checked) =>
                      setColumnVisibility((prev) => ({
                        ...prev,
                        dateRange: checked,
                      }))
                    }
                  >
                    기간
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.status}
                    onCheckedChange={(checked) =>
                      setColumnVisibility((prev) => ({
                        ...prev,
                        status: checked,
                      }))
                    }
                  >
                    상태
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.jiraUrl}
                    onCheckedChange={(checked) =>
                      setColumnVisibility((prev) => ({
                        ...prev,
                        jiraUrl: checked,
                      }))
                    }
                  >
                    Jira URL
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.dailyReportUrl}
                    onCheckedChange={(checked) =>
                      setColumnVisibility((prev) => ({
                        ...prev,
                        dailyReportUrl: checked,
                      }))
                    }
                  >
                    Report URL
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Campaigns Table */}
        {filteredCampaigns.length > 0 ? (
          <CampaignsTable
            campaigns={filteredCampaigns}
            selectedCampaigns={selectedCampaigns}
            onSelectAll={(checked) => {
              if (checked) {
                setSelectedCampaigns(filteredCampaigns.map((c) => c.id));
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
            onDeleteCampaign={handleDeleteCampaign}
            onEditCampaign={handleEditCampaign}
            currentUserProfile={currentUserProfile}
            accountAssignedUserId={undefined}
            columnVisibility={columnVisibility}
            groupByAccount
          />
        ) : (
          <div className='text-center py-12'>
            <div className='mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4'>
              <UserIcon className='h-12 w-12 text-muted-foreground' />
            </div>
            <h3 className='text-lg font-semibold mb-2'>캠페인이 없습니다</h3>
            <p className='text-muted-foreground'>
              아직 생성한 캠페인이 없습니다.
            </p>
          </div>
        )}

        {/* Edit Campaign Form */}
        {editingCampaign && (
          <EditCampaignForm
            isOpen={showEditCampaignForm}
            onClose={() => {
              setShowEditCampaignForm(false);
              setEditingCampaign(null);
            }}
            onUpdateCampaign={async (campaignId, campaignData) => {
              await handleUpdateCampaign(campaignId, campaignData);
            }}
            campaign={editingCampaign}
            accountId={editingCampaign.account_id}
            games={allGames.filter(
              (game) => game.account_id === editingCampaign.account_id
            )}
          />
        )}
      </div>
      <Toaster position='top-center' />
    </AccessControl>
  );
}
