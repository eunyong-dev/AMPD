'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  TrashIcon,
  CheckCircle2Icon,
  MoreHorizontalIcon,
  PencilIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { accountUrl } from '@/lib/utils/account-url';
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
import { useUserManagement } from '@/hooks/use-user-management';
import type { AccountProfile } from '@/lib/account-management';
import type { UserProfile } from '@/lib/permissions';
import { canManageResource } from '@/lib/utils/permissions';
import { COUNTRY_OPTIONS, getCountryDisplay } from '@/constants/countries';
import Link from 'next/link';
import { TableWrapper, TABLE_STYLES } from '@/components/common/table-wrapper';
import { DeleteConfirmationDialog } from '@/components/common/delete-confirmation-dialog';

function UserAvatar({
  userId,
  userName,
  activeUsers,
}: {
  userId: string;
  userName?: string;
  activeUsers: any[];
}) {
  const user = activeUsers.find((u) => u.id === userId);

  return (
    <Avatar className='h-5 w-5'>
      {user?.avatar_url ? (
        <AvatarImage src={user.avatar_url} alt={user.display_name} />
      ) : null}
      <AvatarFallback className='text-sm'>
        {userName?.charAt(0).toUpperCase() || 'U'}
      </AvatarFallback>
    </Avatar>
  );
}

interface AccountsTableProps {
  accounts: AccountProfile[];
  selectedAccounts?: string[];
  onSelectAll?: (checked: boolean) => void;
  onSelectAccount?: (accountId: string, checked: boolean) => void;
  onAccountDeleted?: (accountId: string) => void;
  onDeleteAccount: (accountId: string) => Promise<void>;
  onEditAccount?: (account: AccountProfile) => void;
  currentUserProfile?: UserProfile | null;
}

export function AccountsTable({
  accounts,
  selectedAccounts,
  onSelectAll,
  onSelectAccount,
  onAccountDeleted,
  onDeleteAccount,
  onEditAccount,
  currentUserProfile,
}: AccountsTableProps) {
  const { users: activeUsers } = useUserManagement();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<{
    id: string;
    company: string;
    assignedUserId: string;
  } | null>(null);

  const handleDeleteClick = (
    accountId: string,
    company: string,
    assignedUserId: string
  ) => {
    setAccountToDelete({ id: accountId, company, assignedUserId });
    setDeleteDialogOpen(true);
  };

  // 계정 관리 권한 확인 (편집/삭제 공통)
  const isDeleteAllowed = accountToDelete
    ? canManageResource(currentUserProfile, accountToDelete.assignedUserId)
    : false;

  const handleDeleteAccount = async () => {
    if (!accountToDelete) return;

    // 권한 재확인 (안전을 위해)
    if (!isDeleteAllowed) {
      toast.error(
        '본인에게 할당된 광고주만 삭제할 수 있습니다.'
      );
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
      return;
    }

    try {
      await onDeleteAccount(accountToDelete.id);
      toast.success('광고주가 삭제되었습니다');
      onAccountDeleted?.(accountToDelete.id);
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
    } catch (err) {
      toast.error(
        `광고주 삭제 실패: ${
          err instanceof Error ? err.message : '알 수 없는 오류'
        }`
      );
    }
  };

  return (
    <>
      <TableWrapper>
        <div className='overflow-x-auto'>
          <Table style={{ tableLayout: 'fixed', width: '100%' }}>
            <TableHeader className={TABLE_STYLES.header}>
              <TableRow>
                <TableHead style={{ width: '200px' }}>광고주</TableHead>
                <TableHead style={{ width: '120px' }}>국가</TableHead>
                <TableHead style={{ width: '160px' }}>담당자</TableHead>
                <TableHead style={{ width: '140px' }}>게임</TableHead>
                <TableHead style={{ width: '110px' }}>캠페인</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className={TABLE_STYLES.body}>
          {accounts.map((account) => {
            return (
              <TableRow key={account.id}>
                <TableCell style={{ width: '200px' }} className='p-0'>
                  <Link
                    href={accountUrl(account.company)}
                    className='block w-full px-2 py-2 font-medium truncate text-sm hover:text-primary hover:underline'
                  >
                    {account.company}
                  </Link>
                </TableCell>
                <TableCell style={{ width: '120px' }}>
                  <div className='text-sm text-muted-foreground'>
                    {getCountryDisplay(account.country)}
                  </div>
                </TableCell>
                <TableCell style={{ width: '160px' }}>
                  <div className='flex items-center gap-1'>
                    <UserAvatar
                      userId={account.assigned_user_id}
                      userName={account.assigned_user_name}
                      activeUsers={activeUsers}
                    />
                    <div className='text-xs font-medium truncate'>
                      {account.assigned_user_name}
                    </div>
                  </div>
                </TableCell>
                <TableCell style={{ width: '140px' }}>
                  <Link
                    href={`${accountUrl(account.company)}?tab=games`}
                    className='inline-flex items-center hover:opacity-80 cursor-pointer'
                  >
                    <div className='flex -space-x-2'>
                      {account.game_logos?.slice(0, 3).map((g) => (
                        <Avatar
                          key={g.id}
                          className='h-6 w-6 ring-2 ring-background'
                        >
                          {g.logo_url ? (
                            <AvatarImage
                              src={g.logo_url}
                              alt={g.game_name ?? ''}
                            />
                          ) : null}
                          <AvatarFallback className='text-[10px]'>
                            {g.game_name?.charAt(0).toUpperCase() ?? 'G'}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      <div className='relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-300 dark:bg-zinc-700 ring-2 ring-background text-[10px] font-semibold text-foreground'>
                        {account.active_games || 0}
                      </div>
                    </div>
                  </Link>
                </TableCell>
                <TableCell style={{ width: '100px' }}>
                  <Link href={`${accountUrl(account.company)}?tab=campaigns`}>
                    <Badge
                      variant='outline'
                      className='inline-flex gap-1 px-1.5 py-0.5 text-xs text-muted-foreground [&_svg]:size-3 text-green-600 w-fit hover:text-green-700 cursor-pointer'
                    >
                      <CheckCircle2Icon className='text-green-500' />
                      활성 {account.active_campaigns}
                    </Badge>
                  </Link>
                </TableCell>
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
                    <DropdownMenuContent
                      align='end'
                      className='w-auto min-w-[120px]'
                    >
                      {onEditAccount && (
                        <DropdownMenuItem
                          onClick={() => onEditAccount(account)}
                          className='flex items-center gap-0'
                          disabled={!canManageResource(currentUserProfile, account.assigned_user_id)}
                        >
                          <PencilIcon className='mr-1 h-4 w-4' />
                          광고주 수정
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() =>
                          handleDeleteClick(
                            account.id,
                            account.company,
                            account.assigned_user_id
                          )
                        }
                        className='text-red-600 focus:text-red-600 flex items-center gap-0'
                      >
                        <TrashIcon className='mr-1 h-4 w-4' />
                        광고주 삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
            })}
          </TableBody>
        </Table>
        </div>
      </TableWrapper>
      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setAccountToDelete(null);
        }}
        onConfirm={handleDeleteAccount}
        title={
          isDeleteAllowed ? '정말 삭제하시겠습니까?' : '광고주를 삭제할 수 없습니다'
        }
        description={
          isDeleteAllowed
            ? `이 작업은 되돌릴 수 없습니다. ${accountToDelete?.company} 광고주와 연관된 모든 게임 및 캠페인이 영구적으로 삭제됩니다.`
            : `본인에게 할당된 광고주만 삭제할 수 있습니다. ${accountToDelete?.company} 광고주는 다른 사용자에게 할당되어 있습니다.`
        }
        confirmLabel='삭제'
        cancelLabel='닫기'
        isAllowed={isDeleteAllowed}
      />
    </>
  );
}
