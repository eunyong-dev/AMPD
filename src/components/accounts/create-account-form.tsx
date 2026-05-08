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

interface CreateAccountFormProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountCreated?: () => void;
  onCreateAccount: (accountData: {
    company: string;
    country: string;
    assigned_user_id: string;
  }) => Promise<void>;
}

export function CreateAccountForm({
  isOpen,
  onClose,
  onAccountCreated,
  onCreateAccount,
}: CreateAccountFormProps) {
  const [newAccount, setNewAccount] = useState({
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

  // 폼이 열릴 때 현재 사용자를 기본값으로 설정
  useEffect(() => {
    if (isOpen && currentUser && availableUsers.length > 0) {
      const currentUserProfile = availableUsers.find(
        (user) => user.user_id === currentUser.id
      );
      if (currentUserProfile) {
        setNewAccount((prev) => ({
          ...prev,
          assigned_user_id: currentUserProfile.id,
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentUser?.id, availableUsers]);

  // 폼이 닫힐 때 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleCreateAccount = async () => {
    // 폼 검증
    const validationErrors = [];
    if (!newAccount.company.trim())
      validationErrors.push('회사명을 입력해주세요');
    if (!newAccount.country) validationErrors.push('국가를 선택해주세요');
    if (!newAccount.assigned_user_id)
      validationErrors.push('담당자를 선택해주세요');

    if (validationErrors.length > 0) {
      validationErrors.forEach((error) => toast.error(error));
      return;
    }

    try {
      await onCreateAccount({
        company: newAccount.company.trim(),
        country: newAccount.country,
        assigned_user_id: newAccount.assigned_user_id,
      });

      toast.success('광고주가 생성되었습니다');
      resetForm();
      onAccountCreated?.();
      onClose();
    } catch (err) {
      toast.error(
        `광고주 생성 실패: ${
          err instanceof Error ? err.message : '알 수 없는 오류'
        }`
      );
    }
  };

  const resetForm = useCallback(() => {
    setNewAccount({ company: '', country: '', assigned_user_id: '' });
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>새 광고주 생성</DialogTitle>
          <DialogDescription>
            새 광고주 계정을 생성하고 담당자를 지정합니다.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4 py-4'>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='company'>회사명</Label>
              <Input
                id='company'
                placeholder='회사명을 입력해주세요'
                value={newAccount.company}
                onChange={(e) =>
                  setNewAccount((prev) => ({
                    ...prev,
                    company: e.target.value,
                  }))
                }
                autoComplete='off'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='country'>국가</Label>
              <Select
                value={newAccount.country}
                onValueChange={(value) =>
                  setNewAccount((prev) => ({ ...prev, country: value }))
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
            <Label htmlFor='assigned_user'>담당자</Label>
            <Select
              value={newAccount.assigned_user_id}
              onValueChange={(value) =>
                setNewAccount((prev) => ({
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
          <Button onClick={handleCreateAccount}>광고주 생성</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
