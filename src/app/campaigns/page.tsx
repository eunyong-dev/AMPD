'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClipboardListIcon,
  UsersIcon,
  ChevronDownIcon,
  ColumnsIcon,
  SearchIcon,
} from 'lucide-react';
import { AccessControl } from '@/components/access-control';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  getAllCampaigns,
  deleteCampaign,
  updateCampaign,
  type Campaign,
} from '@/hooks/use-campaign-management';
import { getAllGames } from '@/hooks/use-game-management';
import { useUserContext } from '@/lib/user-context';
import { useUserManagement } from '@/hooks/use-user-management';
import { useAuth } from '@/hooks/use-auth';
import { CampaignsTable } from '@/components/campaigns/campaigns-table';
import { EditCampaignForm } from '@/components/campaigns/edit-campaign-form';
import { canManageResource } from '@/lib/utils/permissions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const REGION_FLAGS = { KR: '🇰🇷', JP: '🇯🇵', TW: '🇹🇼', US: '🇺🇸' } as const;

export default function AllCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [showEditCampaignForm, setShowEditCampaignForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [allGames, setAllGames] = useState<any[]>([]);
  // 기본 탭: 진행중 (공개 캠페인 현황과 동일)
  const [statusFilter, setStatusFilter] = useState<string>('ongoing');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({
    campaignTitle: true,
    // 광고주는 표 안 묶음 줄로, 게임은 캠페인 칸에 함께 보여준다 (컬럼 설정에서 다시 켤 수 있음)
    account: false,
    gameName: false,
    assignedUser: true,
    region: true,
    mmp: true,
    type: true,
    dateRange: true,
    status: true,
    jiraUrl: false,
    dailyReportUrl: false,
  });
  const { profile: currentUserProfile } = useUserContext();
  const { users: activeUsers } = useUserManagement();
  const { user: currentUser } = useAuth();

  // 캠페인 목록 로드
  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllCampaigns();
      setCampaigns(data);
    } catch (err) {
      console.error('캠페인 로드 오류:', err);
      toast.error(
        `캠페인 불러오기 실패: ${
          err instanceof Error ? err.message : '알 수 없는 오류'
        }`
      );
    } finally {
      setLoading(false);
    }
  }, []);

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
  // 필터 조건 — 카드 숫자는 자기 차원만 빼고 세야 해서 조건을 따로 둔다
  const matchers = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim();
    type C = (typeof campaigns)[number];
    return {
      status: (c: C) => statusFilter === 'all' || c.status === statusFilter,
      user: (c: C) =>
        selectedUserIds.length === 0 ||
        selectedUserIds.includes('all') ||
        (!!c.assigned_user_id && selectedUserIds.includes(c.assigned_user_id)),
      region: (c: C) =>
        selectedRegions.length === 0 ||
        selectedRegions.includes('all') ||
        (!!c.region && selectedRegions.includes(c.region)),
      search: (c: C) =>
        !searchLower ||
        (c.name?.toLowerCase() || '').includes(searchLower) ||
        (c.game_name?.toLowerCase() || '').includes(searchLower) ||
        (c.assigned_user_name?.toLowerCase() || '').includes(searchLower),
    };
  }, [campaigns, statusFilter, selectedUserIds, selectedRegions, searchTerm]);

  // 상태별 캠페인 — 상태만 빼고 나머지 필터(지역·담당자·검색) 반영
  const stats = useMemo(() => {
    const base = campaigns.filter(
      (c) => matchers.user(c) && matchers.region(c) && matchers.search(c)
    );
    return {
      total: base.length,
      planning: base.filter((c) => c.status === 'planning').length,
      ongoing: base.filter((c) => c.status === 'ongoing').length,
      holding: base.filter((c) => c.status === 'holding').length,
      end: base.filter((c) => c.status === 'end').length,
    };
  }, [campaigns, matchers]);

  // 지역별 캠페인 — 지역만 빼고 나머지 필터 반영
  const campaignStatsByRegion = useMemo(() => {
    const base = campaigns.filter(
      (c) => matchers.status(c) && matchers.user(c) && matchers.search(c)
    );
    return {
      KR: base.filter((c) => c.region === 'KR').length,
      JP: base.filter((c) => c.region === 'JP').length,
      TW: base.filter((c) => c.region === 'TW').length,
      US: base.filter((c) => c.region === 'US').length,
    };
  }, [campaigns, matchers]);

  // 담당자 선택 토글
  const toggleUserSelection = useCallback((userId: string) => {
    setSelectedUserIds((prev) => {
      if (userId === 'all') {
        return prev.includes('all') ? [] : ['all'];
      }
      if (prev.includes('all')) {
        return [userId];
      }
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }
      return [...prev, userId];
    });
  }, []);

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

  // 상태별, 담당자별, 지역별, 검색어 필터링된 캠페인
  const filteredCampaigns = useMemo(
    () =>
      campaigns.filter(
        (c) =>
          matchers.status(c) &&
          matchers.user(c) &&
          matchers.region(c) &&
          matchers.search(c)
      ),
    [campaigns, matchers]
  );

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
      <div className='flex flex-col gap-4 lg:h-[calc(100dvh-6rem)] lg:min-h-0'>
        {/* 상단: 제목 + 검색 */}
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div className='min-w-0'>
            <h1 className='text-2xl font-semibold tracking-tight'>캠페인</h1>
            <p className='mt-1 text-sm text-muted-foreground'>
              진행중{' '}
              <span className='font-medium text-foreground tabular-nums'>
                {campaigns.filter((c) => c.status === 'ongoing').length}
              </span>
              개 · 전체{' '}
              <span className='tabular-nums'>{campaigns.length}</span>개
            </p>
          </div>
        </div>

        {/* 툴바(상태 탭 + 검색·필터)와 표를 한 카드로 묶는다 */}
        <div className='flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card lg:flex-1'>
        <div className='flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b px-2'>
            <div className='-mb-px flex items-end gap-1 overflow-x-auto [scrollbar-width:none]'>
              {(
                [
                  ['all', '전체', null, stats.total],
                  ['planning', '계획', 'bg-yellow-500', stats.planning],
                  ['ongoing', '진행중', 'bg-green-500', stats.ongoing],
                  ['holding', '홀딩', 'bg-red-500', stats.holding],
                  ['end', '종료', 'bg-slate-400', stats.end],
                ] as const
              ).map(([key, label, dot, count]) => {
                const on = statusFilter === key;
                return (
                  <button
                    key={key}
                    type='button'
                    onClick={() => setStatusFilter(key)}
                    aria-pressed={on}
                    className={cn(
                      'inline-flex h-10 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors',
                      on
                        ? 'border-foreground text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {dot && (
                      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
                    )}
                    {label}
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-px text-[11px] tabular-nums',
                        on
                          ? 'bg-foreground text-background'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className='flex flex-wrap items-center gap-2 py-2'>
              <div className='relative w-full sm:w-60'>
                <SearchIcon className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  placeholder='캠페인·게임·담당자 검색'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='h-8 pl-9'
                  autoComplete='off'
                />
              </div>
              {/* 지역 — 드롭다운 (항목 옆에 개수), 여러 개 선택 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='outline' size='sm' className='h-9 gap-1.5'>
                    {selectedRegions.length === 0 ||
                    selectedRegions.includes('all')
                      ? '전체 지역'
                      : selectedRegions
                          .map((r) => `${REGION_FLAGS[r as keyof typeof REGION_FLAGS] ?? ''} ${r}`)
                          .join(', ')}
                    <ChevronDownIcon className='h-4 w-4 opacity-60' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='start' className='w-44'>
                  {(['KR', 'JP', 'TW', 'US'] as const).map((region) => (
                    <DropdownMenuItem
                      key={region}
                      onClick={() => toggleRegionSelection(region)}
                      onSelect={(e) => e.preventDefault()}
                      className='flex items-center gap-2'
                    >
                      <Checkbox
                        checked={selectedRegions.includes(region)}
                        onCheckedChange={() => {}}
                      />
                      <span>
                        {REGION_FLAGS[region]} {region}
                      </span>
                      <span className='ml-auto text-xs tabular-nums text-muted-foreground'>
                        {campaignStatsByRegion[region]}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  {selectedRegions.length > 0 &&
                    !selectedRegions.includes('all') && (
                      <DropdownMenuItem
                        onClick={() => setSelectedRegions([])}
                        className='text-muted-foreground'
                      >
                        선택 해제
                      </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Assigned User Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant='outline'
                    size='sm'
                    className='w-auto justify-between flex-shrink-0'
                  >
                    <UsersIcon className='h-4 w-4' />
                    <span className='hidden filter-break:inline'>
                      {selectedUserIds.length === 0
                        ? '전체 사용자'
                        : selectedUserIds.includes('all')
                        ? '전체 사용자'
                        : `${selectedUserIds.length}명 선택`}
                    </span>
                    <ChevronDownIcon className='hidden filter-break:block h-4 w-4' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className='w-[180px]'>
                  <DropdownMenuItem
                    onClick={() => toggleUserSelection('all')}
                    onSelect={(e) => e.preventDefault()}
                    className='flex items-center gap-2'
                  >
                    <Checkbox
                      checked={selectedUserIds.includes('all')}
                      onCheckedChange={() => {}}
                      className='data-[state=checked]:bg-black data-[state=checked]:border-black'
                    />
                    <span>전체 사용자</span>
                  </DropdownMenuItem>
                  {activeUsers.map((user) => (
                    <DropdownMenuItem
                      key={user.id}
                      onClick={() => toggleUserSelection(user.id)}
                      onSelect={(e) => e.preventDefault()}
                      className='flex items-center gap-2'
                    >
                      <Checkbox
                        checked={selectedUserIds.includes(user.id)}
                        onCheckedChange={() => {}}
                        className='data-[state=checked]:bg-black data-[state=checked]:border-black'
                      />
                      <Avatar className='h-5 w-5'>
                        {user.avatar_url ? (
                          <AvatarImage
                            src={user.avatar_url}
                            alt={user.display_name}
                          />
                        ) : null}
                        <AvatarFallback className='text-xs'>
                          {user.display_name?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span className='text-xs truncate'>
                        {user.display_name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Customize Columns */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='outline' size='sm' className='flex-shrink-0'>
                    <ColumnsIcon className='h-4 w-4' />
                    <span className='hidden filter-break:inline'>컬럼 설정</span>
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

        {/* Campaigns Table */}
        {filteredCampaigns.length > 0 ? (
          <CampaignsTable
            campaigns={filteredCampaigns}
            // 표가 남은 높이를 채우고 안에서만 스크롤 → 필터·표 헤더가 늘 보인다
            fillHeight
            className='rounded-none border-0 lg:flex-1'
            // 홀딩·종료 탭은 이미 끝난 캠페인이라 기간 정렬을 종료일 기준으로
            dateSortField={
              statusFilter === 'holding' || statusFilter === 'end'
                ? 'end'
                : 'start'
            }
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
              <ClipboardListIcon className='h-12 w-12 text-muted-foreground' />
            </div>
            <h3 className='text-lg font-semibold mb-2'>캠페인이 없습니다</h3>
            <p className='text-muted-foreground'>
              조건에 맞는 캠페인이 없어요. 필터를 줄여 보세요.
            </p>
          </div>
        )}
        </div>

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
            games={allGames.filter((game) => game.account_id === editingCampaign.account_id)}
          />
        )}
      </div>
      <Toaster position='top-center' />
    </AccessControl>
  );
}
