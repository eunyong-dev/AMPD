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
import type { AccountInputData } from '@/lib/account-management';
import { COUNTRY_OPTIONS } from '@/constants/countries';

interface CreateAccountFormProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountCreated?: () => void;
  onCreateAccount: (accountData: AccountInputData) => Promise<void>;
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
    bill_to_name: '',
    bill_to_email: '',
    bill_to_address: '',
    bill_to_due_days: 30,
    invoice_email_to: '',
    invoice_email_cc: '',
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

  const resetForm = useCallback(() => {
    setNewAccount({
      company: '',
      country: '',
      assigned_user_id: '',
      bill_to_name: '',
      bill_to_email: '',
      bill_to_address: '',
      bill_to_due_days: 30,
      invoice_email_to: '',
      invoice_email_cc: '',
    });
    setBillToOpen(false);
  }, []);

  // 폼이 닫힐 때 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

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
        bill_to_name: newAccount.bill_to_name.trim() || null,
        bill_to_email: newAccount.bill_to_email.trim() || null,
        bill_to_address: newAccount.bill_to_address.trim() || null,
        bill_to_due_days: newAccount.bill_to_due_days,
        invoice_email_to: newAccount.invoice_email_to.trim() || null,
        invoice_email_cc: newAccount.invoice_email_cc.trim() || null,
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
                  <Label htmlFor='bill_to_name'>청구처 이름</Label>
                  <Input
                    id='bill_to_name'
                    placeholder='청구처 이름'
                    value={newAccount.bill_to_name}
                    onChange={(e) =>
                      setNewAccount((prev) => ({
                        ...prev,
                        bill_to_name: e.target.value,
                      }))
                    }
                    autoComplete='off'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='bill_to_email'>청구처 이메일</Label>
                  <Input
                    id='bill_to_email'
                    type='email'
                    placeholder='billing@example.com'
                    value={newAccount.bill_to_email}
                    onChange={(e) =>
                      setNewAccount((prev) => ({
                        ...prev,
                        bill_to_email: e.target.value,
                      }))
                    }
                    autoComplete='off'
                  />
                  <p className='text-xs text-muted-foreground'>
                    인보이스 문서의 BILL TO 섹션에 인쇄됨
                  </p>
                </div>
                <div className='space-y-2 md:col-span-2'>
                  <Label htmlFor='bill_to_address'>청구처 주소</Label>
                  <Input
                    id='bill_to_address'
                    placeholder='청구처 주소'
                    value={newAccount.bill_to_address}
                    onChange={(e) =>
                      setNewAccount((prev) => ({
                        ...prev,
                        bill_to_address: e.target.value,
                      }))
                    }
                    autoComplete='off'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='bill_to_due_days'>청구 기한 (일)</Label>
                  <Input
                    id='bill_to_due_days'
                    type='number'
                    min={1}
                    max={365}
                    placeholder='30'
                    value={newAccount.bill_to_due_days}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setNewAccount((prev) => ({
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
                <div className='md:col-span-2 mt-2'>
                  <div className='text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3'>
                    인보이스 발송 (Email)
                  </div>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='invoice_email_to'>
                    받는사람 (To){' '}
                    <span className='text-xs text-muted-foreground font-normal'>
                      쉼표로 여러 개
                    </span>
                  </Label>
                  <Input
                    id='invoice_email_to'
                    placeholder='billing@example.com, finance@example.com'
                    value={newAccount.invoice_email_to}
                    onChange={(e) =>
                      setNewAccount((prev) => ({
                        ...prev,
                        invoice_email_to: e.target.value,
                      }))
                    }
                    autoComplete='off'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='invoice_email_cc'>
                    참조 (CC){' '}
                    <span className='text-xs text-muted-foreground font-normal'>
                      쉼표로 여러 개
                    </span>
                  </Label>
                  <Input
                    id='invoice_email_cc'
                    placeholder='manager@example.com'
                    value={newAccount.invoice_email_cc}
                    onChange={(e) =>
                      setNewAccount((prev) => ({
                        ...prev,
                        invoice_email_cc: e.target.value,
                      }))
                    }
                    autoComplete='off'
                  />
                </div>
              </div>
            )}
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
