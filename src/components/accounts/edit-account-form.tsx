'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUserManagement } from '@/hooks/use-user-management';
import { useAuth } from '@/hooks/use-auth';
import { useUserContext } from '@/lib/user-context';
import type { AccountProfile } from '@/lib/account-management';
import { COUNTRY_OPTIONS } from '@/constants/countries';

interface EditAccountFormProps {
  account: AccountProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onAccountUpdated?: () => void;
  onUpdateAccount: (
    accountId: string,
    accountData: {
      company: string;
      country: string;
      assigned_user_id: string;
    }
  ) => Promise<void>;
}

export function EditAccountForm({
  account,
  isOpen,
  onClose,
  onAccountUpdated,
  onUpdateAccount,
}: EditAccountFormProps) {
  const [editedAccount, setEditedAccount] = useState({
    company: '',
    country: '',
    assigned_user_id: '',
  });

  const { users: activeUsers } = useUserManagement();
  const { user: currentUser } = useAuth();
  const { profile: currentUserProfile } = useUserContext();

  // 권한에 따라 선택 가능한 사용자 목록 필터링
  const availableUsers = useMemo(() => {
    return activeUsers.filter((user) => {
      // 관리자는 모든 사용자 선택 가능
      if (currentUserProfile?.role === 'admin') {
        return true;
      }
      // AM은 자신만 선택 가능
      if (currentUserProfile?.role === 'am') {
        return user.user_id === currentUser?.id;
      }
      return false;
    });
  }, [activeUsers, currentUserProfile?.role, currentUser?.id]);

  // 폼이 열릴 때 계정 데이터로 초기화
  useEffect(() => {
    if (isOpen && account) {
      setEditedAccount({
        company: account.company || '',
        country: account.country || '',
        assigned_user_id: account.assigned_user_id || '',
      });
    }
  }, [isOpen, account]);

  // 폼이 닫힐 때 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleUpdateAccount = async () => {
    if (!account) return;

    // 폼 검증
    const validationErrors = [];
    if (!editedAccount.company.trim())
      validationErrors.push('회사명을 입력해주세요');
    if (!editedAccount.country) validationErrors.push('국가를 선택해주세요');
    if (!editedAccount.assigned_user_id)
      validationErrors.push('담당자를 선택해주세요');

    if (validationErrors.length > 0) {
      validationErrors.forEach((error) => toast.error(error));
      return;
    }

    try {
      await onUpdateAccount(account.id, {
        company: editedAccount.company.trim(),
        country: editedAccount.country,
        assigned_user_id: editedAccount.assigned_user_id,
      });

      toast.success('광고주 정보가 업데이트되었습니다');
      resetForm();
      onAccountUpdated?.();
      onClose();
    } catch (err) {
      toast.error('광고주 업데이트에 실패했습니다');
    }
  };

  const resetForm = useCallback(() => {
    setEditedAccount({ company: '', country: '', assigned_user_id: '' });
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>광고주 수정</DialogTitle>
          <DialogDescription>
            광고주 정보와 담당자를 업데이트합니다.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4 py-4'>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='edit-company'>회사명</Label>
              <Input
                id='edit-company'
                placeholder='회사명을 입력해주세요'
                value={editedAccount.company}
                onChange={(e) =>
                  setEditedAccount((prev) => ({
                    ...prev,
                    company: e.target.value,
                  }))
                }
                autoComplete='off'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-country'>국가</Label>
              <Select
                value={editedAccount.country}
                onValueChange={(value) =>
                  setEditedAccount((prev) => ({ ...prev, country: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='국가를 선택해주세요' />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className='p-2'
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='edit-assigned_user'>담당자</Label>
            <Select
              value={editedAccount.assigned_user_id}
              onValueChange={(value) =>
                setEditedAccount((prev) => ({
                  ...prev,
                  assigned_user_id: value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder='담당자를 선택해주세요' />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id} className='p-2'>
                    <div className='flex items-center gap-2'>
                      <Avatar className='h-5 w-5'>
                        {user.avatar_url ? (
                          <AvatarImage
                            src={user.avatar_url}
                            alt={user.display_name}
                          />
                        ) : null}
                        <AvatarFallback className='text-xs'>
                          {user.display_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{user.display_name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleUpdateAccount}>광고주 업데이트</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

