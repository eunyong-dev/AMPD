'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PlusIcon,
  SearchIcon,
  ChevronDownIcon,
  UsersIcon,
  BuildingIcon,
} from 'lucide-react';
import { AccessControl } from '@/components/access-control';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Toaster, toast } from '@/components/ui/sonner';
import { useAccountManagement } from '@/hooks/use-account-management';
import { useUserManagement } from '@/hooks/use-user-management';
import { useAuth } from '@/hooks/use-auth';
import { useUserContext } from '@/lib/user-context';
import type { AccountProfile } from '@/lib/account-management';
import { CreateAccountForm } from '@/components/accounts/create-account-form';
import { EditAccountForm } from '@/components/accounts/edit-account-form';
import { AccountStats } from '@/components/accounts/account-stats';
import { AccountsTable } from '@/components/accounts/accounts-table';
import { EmptyState } from '@/components/accounts/empty-state';
import { PageLoading } from '@/components/common';
import { Skeleton } from '@/components/ui/skeleton';

export default function AccountManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<
    AccountProfile | null
  >(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const { accounts, loading, createAccount, updateAccount, removeAccount } =
    useAccountManagement();
  const { users: activeUsers } = useUserManagement();
  const { user: currentUser } = useAuth();
  const { profile: currentUserProfile } = useUserContext();

  // 초기 필터 설정
  useEffect(() => {
    if (
      currentUser &&
      currentUserProfile &&
      activeUsers.length > 0 &&
      selectedUserIds.length === 0
    ) {
      const currentUserProfileData = activeUsers.find(
        (user) => user.user_id === currentUser.id
      );

      if (currentUserProfileData) {
        if (currentUserProfile.role === 'admin') {
          setSelectedUserIds(['all']);
        } else if (currentUserProfile.role === 'am') {
          setSelectedUserIds([currentUserProfileData.id]);
        }
      }
    }
  }, [currentUser, currentUserProfile, activeUsers, selectedUserIds.length]);

  // 필터링된 계정들
  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const matchesSearch =
        account.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.assigned_user_name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesUser =
        selectedUserIds.length === 0 ||
        selectedUserIds.includes('all') ||
        selectedUserIds.includes(account.assigned_user_id);

      return matchesSearch && matchesUser;
    });
  }, [accounts, searchTerm, selectedUserIds]);


  // 통계 계산
  const stats = useMemo(() => {
    return {
      totalAccounts: filteredAccounts.length,
      totalGames: filteredAccounts.reduce(
        (sum, account) => sum + (account.active_games || 0),
        0
      ),
      totalCampaigns: filteredAccounts.reduce(
        (sum, account) => sum + (account.active_campaigns || 0),
        0
      ),
    };
  }, [filteredAccounts]);

  // 사용자 선택 토글
  const toggleUserSelection = useCallback(
    (userId: string) => {
      if (userId === 'all') {
        setSelectedUserIds(selectedUserIds.includes('all') ? [] : ['all']);
      } else {
        setSelectedUserIds((prev) => {
          if (prev.includes(userId)) {
            return prev.filter((id) => id !== userId);
          } else {
            return [...prev.filter((id) => id !== 'all'), userId];
          }
        });
      }
    },
    [selectedUserIds]
  );

  // 계정 선택 핸들러들

  // 계정 생성 핸들러
  const handleCreateAccount = useCallback(
    async (accountData: {
      company: string;
      country: string;
      assigned_user_id: string;
    }) => {
      try {
        await createAccount(accountData);
        // CreateAccountForm에서 이미 toast를 표시하므로 여기서는 표시하지 않음
        setShowCreateForm(false);
      } catch (error) {
        // CreateAccountForm에서 에러 toast를 표시하므로 여기서는 표시하지 않음
      }
    },
    [createAccount]
  );

  // 계정 편집 핸들러
  const handleEditAccount = useCallback(
    (account: AccountProfile) => {
      setEditingAccount(account);
    },
    []
  );

  // 계정 업데이트 핸들러
  const handleUpdateAccount = useCallback(
    async (
      accountId: string,
      accountData: {
        company: string;
        country: string;
        assigned_user_id: string;
      }
    ) => {
      try {
        await updateAccount(accountId, accountData);
        setEditingAccount(null);
      } catch (error) {
        console.error('계정 업데이트 실패:', error);
      }
    },
    [updateAccount]
  );

  // 계정 삭제 핸들러
  const handleDeleteAccount = useCallback(
    async (accountId: string) => {
      try {
        await removeAccount(accountId);
        // AccountsTable에서 이미 toast를 표시하므로 여기서는 표시하지 않음
      } catch (error) {
        toast.error(
          `광고주 삭제 실패: ${
            error instanceof Error ? error.message : '알 수 없는 오류'
          }`
        );
      }
    },
    [removeAccount]
  );

  const isLoading = loading || selectedUserIds.length === 0;

  // Notify global transition manager to avoid double loading
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const evt = new Event(isLoading ? 'page-loading-start' : 'page-loading-end');
    window.dispatchEvent(evt);
  }, [isLoading]);

  return (
    <AccessControl>
      <div className='space-y-4'>
        {/* Loading State - Skeletons */}
        {isLoading && (
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div className='space-y-2'>
                <Skeleton className='h-7 w-56' />
                <Skeleton className='h-4 w-80' />
              </div>
              <Skeleton className='h-9 w-36 rounded-lg' />
            </div>

            <div className='grid grid-cols-1 gap-4 xl:grid-cols-3'>
              <div className='rounded-xl border p-4 space-y-3'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-8 w-20' />
              </div>
              <div className='rounded-xl border p-4 space-y-3'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-8 w-20' />
              </div>
              <div className='rounded-xl border p-4 space-y-3'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-8 w-20' />
              </div>
            </div>

            <div className='flex items-center gap-4'>
              <Skeleton className='h-10 w-[320px] rounded-lg' />
              <Skeleton className='h-10 w-[180px] rounded-lg' />
            </div>

            <div className='rounded-lg border'>
              {[...Array(6)].map((_, i) => (
                <div key={i} className='flex items-center gap-4 px-4 py-3 border-b last:border-b-0'>
                  <Skeleton className='h-7 w-7 rounded-full' />
                  <div className='flex-1 space-y-2'>
                    <Skeleton className='h-4 w-44' />
                    <Skeleton className='h-3 w-64' />
                  </div>
                  <Skeleton className='h-8 w-28' />
                  <Skeleton className='h-8 w-24' />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        {!isLoading && (
          <AccountStats
            totalAccounts={stats.totalAccounts}
            totalGames={stats.totalGames}
            totalCampaigns={stats.totalCampaigns}
          />
        )}

        {/* Search - 1450px 이하일 때 위쪽에 표시 */}
        {!isLoading && (
          <div className='search-break:hidden'>
            <div className='relative w-full'>
              <SearchIcon className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                placeholder='Search accounts...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='pl-10 h-9 w-full'
                autoComplete='off'
              />
            </div>
          </div>
        )}

        {/* Filters */}
        {!isLoading && (
          <div className='flex items-center gap-4'>
            {/* Search - 1450px 이상일 때 필터와 함께 표시 */}
            <div className='hidden search-break:block relative flex-1 max-w-sm'>
              <SearchIcon className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                placeholder='Search accounts...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='pl-10 h-9'
                autoComplete='off'
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='outline'
                  size='sm'
                  className='w-auto justify-between flex-shrink-0'
                >
                  <UsersIcon className='h-4 w-4' />
                  <span className='hidden filter-break:inline ml-2'>
                    {selectedUserIds.length === 0
                      ? 'All Users'
                      : selectedUserIds.includes('all')
                      ? 'All Users'
                      : `${selectedUserIds.length} selected`}
                  </span>
                  <ChevronDownIcon className='hidden filter-break:block ml-2 h-4 w-4' />
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
                  <span>All Users</span>
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
                    <Avatar className='h-6 w-6'>
                      <AvatarImage src={user.avatar_url || ''} />
                      <AvatarFallback>
                        {user.display_name?.charAt(0) ||
                          user.email?.charAt(0) ||
                          'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className='truncate'>
                      {user.display_name ||
                        user.email?.split('@')[0] ||
                        'Unknown'}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className='ml-auto'>
              <Button
                onClick={() => setShowCreateForm(true)}
                size='sm'
              >
                <PlusIcon className='mr-2 h-4 w-4' />
                Create Account
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        {!isLoading && (
          <>
            {filteredAccounts.length === 0 ? (
              <EmptyState
                accountsLength={accounts.length}
                onCreateAccount={() => setShowCreateForm(true)}
                hasFilter={searchTerm.length > 0 || selectedUserIds.length > 0}
              />
            ) : (
              <AccountsTable
                accounts={filteredAccounts}
                selectedAccounts={[]}
                onSelectAll={() => {}}
                onSelectAccount={() => {}}
                onDeleteAccount={handleDeleteAccount}
                onEditAccount={handleEditAccount}
                currentUserProfile={currentUserProfile}
              />
            )}
          </>
        )}

        {/* Create Form */}
        <CreateAccountForm
          isOpen={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          onCreateAccount={handleCreateAccount}
        />

        {/* Edit Form */}
        <EditAccountForm
          account={editingAccount}
          isOpen={!!editingAccount}
          onClose={() => setEditingAccount(null)}
          onUpdateAccount={handleUpdateAccount}
        />

        <Toaster position='top-center' />
      </div>
    </AccessControl>
  );
}
