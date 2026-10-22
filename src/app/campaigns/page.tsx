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
const FILTER_STORAGE_KEY = 'campaigns:filters';
const STATUS_VALUES = ['all', 'planning', 'ongoing', 'holding', 'end'];

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
  // URL 에서 필터를 읽어온 뒤에만 URL 을 다시 쓴다 (첫 렌더의 기본값으로 덮어쓰지 않게)
  const [filtersReady, setFiltersReady] = useState(false);

  // 필터는 주소(?status=holding&region=JP,TW&user=…&q=…)에 담는다 → 뒤로 가기·새로고침·링크 공유에도 유지
  useEffect(() => {
    let query = window.location.search;
    // 주소에 필터가 없으면(사이드바·breadcrumb 로 들어옴) 이 탭에서 마지막으로 본 필터 복원
    if (!query) {
      try {
        query = sessionStorage.getItem(FILTER_STORAGE_KEY) ?? '';
      } catch {
        query = '';
      }
    }
    const params = new URLSearchParams(query);
    const list = (key: string) =>
      (params.get(key) ?? '').split(',').filter(Boolean);
    const status = params.get('status');
    if (status && STATUS_VALUES.includes(status)) setStatusFilter(status);
    setSelectedRegions(list('region'));
    setSelectedUserIds(list('user'));
    setSearchTerm(params.get('q') ?? '');
    setFiltersReady(true);
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    const params = new URLSearchParams();
    if (statusFilter !== 'ongoing') params.set('status', statusFilter);
    const regions = selectedRegions.filter((r) => r !== 'all');
    if (regions.length) params.set('region', regions.join(','));
    const users = selectedUserIds.filter((u) => u !== 'all');
    if (users.length) params.set('user', users.join(','));
    if (searchTerm.trim()) params.set('q', searchTerm.trim());
    const query = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}`
    );
    try {
      sessionStorage.setItem(FILTER_STORAGE_KEY, query ? `?${query}` : '');
    } catch {
      // 저장소를 못 쓰는 환경 — URL 만으로 동작
    }
  }, [filtersReady, statusFilter, selectedRegions, selectedUserIds, searchTerm]);

  const resetFilters = useCallback(() => {
    setStatusFilter('all');
    setSelectedRegions([]);
    setSelectedUserIds([]);
    setSearchTerm('');
  }, []);
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({
    campaignTitle: true,
    // 광고주는 표 안 묶음 줄로, 게임은 캠페인 칸에 함께 — 담당자는 필터로 (컬럼 설정에서 다시 켤 수 있음)
    account: false,
    gameName: false,
    assignedUser: false,
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

  // 상태·지역 버튼 안 개수 — 자기 차원만 빼고 나머지 필터를 반영 (누르면 나오는 개수)
  const { stats, campaignStatsByRegion } = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    const byStatus = (c: Campaign) =>
      statusFilter === 'all' || c.status === statusFilter;
    const byUser = (c: Campaign) =>
      selectedUserIds.length === 0 ||
      selectedUserIds.includes('all') ||
      (!!c.assigned_user_id && selectedUserIds.includes(c.assigned_user_id));
    const byRegion = (c: Campaign) =>
      selectedRegions.length === 0 ||
      selectedRegions.includes('all') ||
      (!!c.region && selectedRegions.includes(c.region));
    const bySearch = (c: Campaign) =>
      !q ||
      [
        c.name,
        c.game_name,
        c.assigned_user_name,
        c.account_company,
        c.regional_game_name,
        c.game_package_identifier,
      ].some((v) => (v ?? '').toLowerCase().includes(q));

    const forStatus = campaigns.filter(
      (c) => byUser(c) && byRegion(c) && bySearch(c)
    );
    const forRegion = campaigns.filter(
      (c) => byStatus(c) && byUser(c) && bySearch(c)
    );
    const countStatus = (k: string) =>
      forStatus.filter((c) => c.status === k).length;
    const countRegion = (k: string) =>
      forRegion.filter((c) => c.region === k).length;
    return {
      stats: {
        total: forStatus.length,
        planning: countStatus('planning'),
        ongoing: countStatus('ongoing'),
        holding: countStatus('holding'),
        end: countStatus('end'),
      },
      campaignStatsByRegion: {
        KR: countRegion('KR'),
        JP: countRegion('JP'),
        TW: countRegion('TW'),
        US: countRegion('US'),
      },
    };
  }, [campaigns, statusFilter, selectedUserIds, selectedRegions, searchTerm]);

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


  // 상태별, 담당자별, 지역별, 검색어 필터링된 캠페인
  const filteredCampaigns = useMemo(() => {
    let filtered = campaigns;

    // 상태 필터링
    if (statusFilter !== 'all') {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    // 담당자 필터링
    if (selectedUserIds.length > 0 && !selectedUserIds.includes('all')) {
      filtered = filtered.filter(
        (c) =>
          c.assigned_user_id && selectedUserIds.includes(c.assigned_user_id)
      );
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
          assignedUserName.includes(searchLower) ||
          (c.account_company?.toLowerCase() || '').includes(searchLower) ||
          (c.regional_game_name?.toLowerCase() || '').includes(searchLower) ||
          (c.game_package_identifier?.toLowerCase() || '').includes(searchLower)
        );
      });
    }

    return filtered;
  }, [campaigns, statusFilter, selectedUserIds, selectedRegions, searchTerm]);

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
        {/* 제목 + 요약 */}
        <div>
          <h1 className='text-xl font-semibold tracking-tight'>캠페인</h1>
          <p className='mt-1 text-sm text-muted-foreground'>
            전체{' '}
            <span className='font-medium text-foreground tabular-nums'>
              {campaigns.length}
            </span>
            개 · 진행중{' '}
            <span className='font-medium text-foreground tabular-nums'>
              {campaigns.filter((c) => c.status === 'ongoing').length}
            </span>
            개 · 지금 보는 목록{' '}
            <span className='font-medium text-foreground tabular-nums'>
              {filteredCampaigns.length}
            </span>
            개
          </p>
        </div>

        {/* 툴바 — 상태·지역 버튼 안에 개수. 좁으면 검색 줄이 아래로 내려간다 */}
        <div className='rounded-xl border bg-card p-2'>
          <div className='flex flex-wrap items-center gap-2'>
            <div className='flex flex-wrap items-center gap-2'>
              <div className='flex rounded-lg bg-muted p-0.5'>
                {(
                  [
                    ['all', '전체', null, stats.total],
                    ['planning', '계획', 'bg-yellow-500', stats.planning],
                    ['ongoing', '진행중', 'bg-green-500', stats.ongoing],
                    ['holding', '홀딩', 'bg-red-500', stats.holding],
                    ['end', '종료', 'bg-slate-400', stats.end],
                  ] as const
                ).map(([key, label, dot, count]) => (
                  <button
                    key={key}
                    type='button'
                    onClick={() => setStatusFilter(key)}
                    aria-pressed={statusFilter === key}
                    className={cn(
                      'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
                      statusFilter === key &&
                        'bg-background text-foreground shadow-sm'
                    )}
                  >
                    {dot && (
                      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
                    )}
                    {label}
                    <span className='font-mono text-xs tabular-nums text-muted-foreground'>
                      {count}
                    </span>
                  </button>
                ))}
              </div>

              <span className='hidden h-5 w-px bg-border xl:block' />

              {/* 지역 칩 — 넓은 화면에서만. 좁으면 아래 줄의 지역 드롭다운 */}
              <div className='hidden gap-1 xl:flex'>
                {(['KR', 'JP', 'TW', 'US'] as const).map((region) => {
                  const on = selectedRegions.includes(region);
                  return (
                    <button
                      key={region}
                      type='button'
                      onClick={() => toggleRegionSelection(region)}
                      aria-pressed={on}
                      className={cn(
                        'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-sm transition-colors hover:bg-muted',
                        on &&
                          'border-primary/60 bg-primary/10 hover:bg-primary/15'
                      )}
                    >
                      <span>{REGION_FLAGS[region]}</span>
                      {region}
                      <span className='font-mono text-xs tabular-nums text-muted-foreground'>
                        {campaignStatsByRegion[region]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className='flex min-w-full flex-1 items-center gap-2 sm:min-w-[480px]'>
              <div className='relative min-w-0 flex-1'>
                <SearchIcon className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  placeholder='캠페인·게임·광고주·패키지명 검색'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='h-8 pl-9'
                  autoComplete='off'
                />
              </div>

              {/* 좁은 화면용 지역 선택 (칩과 같은 개수) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='outline' size='sm' className='xl:hidden'>
                    {selectedRegions.filter((r) => r !== 'all').length === 0
                      ? '전체 지역'
                      : selectedRegions.filter((r) => r !== 'all').join(', ')}
                    <ChevronDownIcon className='h-4 w-4 opacity-60' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' className='w-44'>
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
                      <span className='ml-auto font-mono text-xs tabular-nums text-muted-foreground'>
                        {campaignStatsByRegion[region]}
                      </span>
                    </DropdownMenuItem>
                  ))}
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
        </div>

        {/* Campaigns Table */}
        {filteredCampaigns.length > 0 ? (
          <CampaignsTable
            campaigns={filteredCampaigns}
            // 표가 남은 높이를 채우고 안에서만 스크롤 → 표 헤더 고정
            fillHeight
            className='lg:flex-1'
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
            {campaigns.length > 0 ? (
              <>
                <h3 className='text-lg font-semibold mb-2'>
                  조건에 맞는 캠페인이 없어요
                </h3>
                <p className='text-muted-foreground mb-4'>
                  탭·지역·담당자·검색어 조건을 줄여 보세요.
                </p>
                <Button variant='outline' size='sm' onClick={resetFilters}>
                  필터 초기화
                </Button>
              </>
            ) : (
              <>
                <h3 className='text-lg font-semibold mb-2'>캠페인이 없습니다</h3>
                <p className='text-muted-foreground'>
                  아직 등록된 캠페인이 없습니다.
                </p>
              </>
            )}
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
            games={allGames.filter((game) => game.account_id === editingCampaign.account_id)}
          />
        )}
      </div>
      <Toaster position='top-center' />
    </AccessControl>
  );
}
