'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight } from 'lucide-react';
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
import type {
  AccountInputData,
  AccountProfile,
} from '@/lib/account-management';
import { COUNTRY_OPTIONS } from '@/constants/countries';

interface EditAccountFormProps {
  account: AccountProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onAccountUpdated?: () => void;
  onUpdateAccount: (
    accountId: string,
    accountData: AccountInputData
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
    bill_to_name: '',
    bill_to_email: '',
    bill_to_address: '',
    bill_to_due_days: 30,
  });
  const [billToOpen, setBillToOpen] = useState(false);

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
      const hasAnyBillTo =
        !!account.bill_to_name ||
        !!account.bill_to_email ||
        !!account.bill_to_address;
      setEditedAccount({
        company: account.company || '',
        country: account.country || '',
        assigned_user_id: account.assigned_user_id || '',
        bill_to_name: account.bill_to_name ?? '',
        bill_to_email: account.bill_to_email ?? '',
        bill_to_address: account.bill_to_address ?? '',
        bill_to_due_days: account.bill_to_due_days ?? 30,
      });
      // 기존 BILL TO 정보가 있으면 펼친 상태로
      setBillToOpen(hasAnyBillTo);
    }
  }, [isOpen, account]);

  const resetForm = useCallback(() => {
    setEditedAccount({
      company: '',
      country: '',
      assigned_user_id: '',
      bill_to_name: '',
      bill_to_email: '',
      bill_to_address: '',
      bill_to_due_days: 30,
    });
    setBillToOpen(false);
  }, []);

  // 폼이 닫힐 때 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

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
        bill_to_name: editedAccount.bill_to_name.trim() || null,
        bill_to_email: editedAccount.bill_to_email.trim() || null,
        bill_to_address: editedAccount.bill_to_address.trim() || null,
        bill_to_due_days: editedAccount.bill_to_due_days,
      });

      toast.success('광고주 정보가 업데이트되었습니다');
      resetForm();
      onAccountUpdated?.();
      onClose();
    } catch {
      toast.error('광고주 업데이트에 실패했습니다');
    }
  };

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

          {/* 청구 정보 (BILL TO) — 접기/펼치기 */}
          <div className='border-t pt-4 mt-2'>
            <button
              type='button'
              onClick={() => setBillToOpen((v) => !v)}
              className='flex w-full items-center gap-2 text-sm font-semibold hover:text-primary transition-colors'
            >
              {billToOpen ? (
                <ChevronDown className='h-4 w-4' />
              ) : (
                <ChevronRight className='h-4 w-4' />
              )}
              <span>청구 정보 (BILL TO)</span>
              <span className='text-xs text-muted-foreground font-normal'>
                선택 입력 — 인보이스 발행 시 사용
              </span>
            </button>
            {billToOpen && (
              <div className='grid gap-4 md:grid-cols-2 mt-3'>
                <div className='space-y-2'>
                  <Label htmlFor='edit-bill_to_name'>청구처 이름</Label>
                  <Input
                    id='edit-bill_to_name'
                    placeholder='청구처 이름'
                    value={editedAccount.bill_to_name}
                    onChange={(e) =>
                      setEditedAccount((prev) => ({
                        ...prev,
                        bill_to_name: e.target.value,
                      }))
                    }
                    autoComplete='off'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='edit-bill_to_email'>청구처 이메일</Label>
                  <Input
                    id='edit-bill_to_email'
                    type='email'
                    placeholder='billing@example.com'
                    value={editedAccount.bill_to_email}
                    onChange={(e) =>
                      setEditedAccount((prev) => ({
                        ...prev,
                        bill_to_email: e.target.value,
                      }))
                    }
                    autoComplete='off'
                  />
                </div>
                <div className='space-y-2 md:col-span-2'>
                  <Label htmlFor='edit-bill_to_address'>청구처 주소</Label>
                  <Input
                    id='edit-bill_to_address'
                    placeholder='청구처 주소'
                    value={editedAccount.bill_to_address}
                    onChange={(e) =>
                      setEditedAccount((prev) => ({
                        ...prev,
                        bill_to_address: e.target.value,
                      }))
                    }
                    autoComplete='off'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='edit-bill_to_due_days'>
                    청구 기한 (일)
                  </Label>
                  <Input
                    id='edit-bill_to_due_days'
                    type='number'
                    min={1}
                    max={365}
                    placeholder='30'
                    value={editedAccount.bill_to_due_days}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setEditedAccount((prev) => ({
                        ...prev,
                        bill_to_due_days:
                          Number.isNaN(v) || v < 1 ? 1 : Math.min(v, 365),
                      }));
                    }}
                    autoComplete='off'
                  />
                  <p className='text-xs text-muted-foreground'>
                    인보이스 발행 시 Invoice Date 로부터 며칠 뒤를 Due Date 로
                    설정할지 (기본 30일)
                  </p>
                </div>
              </div>
            )}
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
