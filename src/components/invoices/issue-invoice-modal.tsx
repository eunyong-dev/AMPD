'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CalendarIcon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { createClient } from '@/utils/supabase/client';
import type { Database } from '@/lib/database.types';

type InvoiceRow = Database['public']['Tables']['invoices']['Row'];

interface IssueInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  settlementId: string;
  accountId: string;
  onIssued: (invoiceId: string) => void;
}

const todayISO = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const addDaysISO = (dateStr: string, days: number): string => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDateDisplay = (iso: string): string => {
  if (!iso) return '';
  const [yyyy, mm, dd] = iso.split('-');
  return `${yyyy}/${mm}/${dd}`;
};

const isoFromDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const daysBetweenISO = (fromISO: string, toISO: string): number => {
  if (!fromISO || !toISO) return 0;
  const from = new Date(fromISO);
  const to = new Date(toISO);
  const diffMs = to.getTime() - from.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

const buildInvoiceNo = (
  invoiceDate: string,
  dailySeq: number,
  managerNo: string
): string => {
  // YYYY-MM-DD 파싱
  const [yyyy, mm, dd] = invoiceDate.split('-');
  const yy = yyyy.slice(2);
  const seq = String(dailySeq).padStart(2, '0');
  return `GNA${yy}${mm}${dd}${seq}-${managerNo}`;
};

export function IssueInvoiceModal({
  isOpen,
  onClose,
  settlementId,
  accountId,
  onIssued,
}: IssueInvoiceModalProps) {
  const [invoiceDate, setInvoiceDate] = useState<string>(todayISO());
  const [dueDate, setDueDate] = useState<string>(addDaysISO(todayISO(), 30));
  const [accountDueDays, setAccountDueDays] = useState<number>(30); // 광고주의 기본 청구 기한
  const [submitting, setSubmitting] = useState(false);

  // Due Date 와 Invoice Date 의 실제 차이 (사용자가 수동 변경하면 즉시 반영)
  const dueDays = daysBetweenISO(invoiceDate, dueDate);
  const [existingInvoice, setExistingInvoice] = useState<InvoiceRow | null>(
    null
  );
  const [checking, setChecking] = useState(false);
  const [missingBillTo, setMissingBillTo] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const today = todayISO();
    setInvoiceDate(today);
    setDueDate(addDaysISO(today, 30));
    setAccountDueDays(30);
    setExistingInvoice(null);
    setMissingBillTo([]);
    // 동일 settlement에 이미 발행된 인보이스가 있는지 + BILL TO 정보 확인
    (async () => {
      setChecking(true);
      try {
        const supabase = createClient();
        const [invoiceRes, accountRes] = await Promise.all([
          supabase
            .from('invoices')
            .select('*')
            .eq('settlement_id', settlementId)
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('accounts')
            .select(
              'bill_to_name, bill_to_email, bill_to_address, bill_to_due_days'
            )
            .eq('id', accountId)
            .single(),
        ]);
        if (invoiceRes.error) throw invoiceRes.error;
        if (invoiceRes.data && invoiceRes.data.length > 0) {
          setExistingInvoice(invoiceRes.data[0] as InvoiceRow);
        }
        if (accountRes.data) {
          const missing: string[] = [];
          if (!accountRes.data.bill_to_name?.trim()) missing.push('이름');
          if (!accountRes.data.bill_to_email?.trim()) missing.push('이메일');
          if (!accountRes.data.bill_to_address?.trim()) missing.push('주소');
          setMissingBillTo(missing);

          // 광고주별 청구 기한 적용
          const days = accountRes.data.bill_to_due_days ?? 30;
          setAccountDueDays(days);
          setDueDate(addDaysISO(today, days));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류';
        toast.error(`인보이스 확인 실패: ${msg}`);
      } finally {
        setChecking(false);
      }
    })();
  }, [isOpen, settlementId, accountId]);

  // invoiceDate 변경 시 dueDate 자동 갱신 (광고주의 기본 청구 기한 일수 기준)
  useEffect(() => {
    if (!invoiceDate) return;
    setDueDate(addDaysISO(invoiceDate, accountDueDays));
    // accountDueDays 가 바뀌어도 동일 (모달 오픈 시 한번 적용)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceDate]);

  const handleIssue = async () => {
    if (!invoiceDate || !dueDate) {
      toast.error('Invoice Date와 Due Date를 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();

      // 1. 현재 사용자
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        toast.error('사용자 정보를 가져올 수 없습니다.');
        return;
      }

      // 2. user_profiles에서 manager_no + email 조회
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, manager_no, email')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile) {
        toast.error('사용자 프로필을 찾을 수 없습니다.');
        return;
      }

      const managerNo = (profile.manager_no ?? '').trim();
      if (!managerNo) {
        toast.error(
          '담당자 번호가 설정되지 않았습니다. 권한 페이지에서 담당자 번호를 먼저 입력해주세요.'
        );
        return;
      }

      // 담당자 이메일 — user_profiles.email 우선, 없으면 auth user의 email
      const fromEmail = (profile.email ?? user.email ?? '').trim() || null;

      // 3. accounts에서 BILL TO snapshot 조회
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .select('bill_to_name, bill_to_email, bill_to_address')
        .eq('id', accountId)
        .single();

      if (accountError || !account) {
        toast.error('광고주 정보를 찾을 수 없습니다.');
        return;
      }

      // BILL TO 필수 정보 검증 (이름/이메일/주소 중 하나라도 비어있으면 발행 불가)
      const missing: string[] = [];
      if (!account.bill_to_name?.trim()) missing.push('이름');
      if (!account.bill_to_email?.trim()) missing.push('이메일');
      if (!account.bill_to_address?.trim()) missing.push('주소');
      if (missing.length > 0) {
        toast.error(
          `광고주 BILL TO 정보(${missing.join(
            ', '
          )})가 누락되어 인보이스를 발행할 수 없습니다. 광고주 수정에서 먼저 채워주세요.`
        );
        return;
      }

      // 4. RPC + INSERT (충돌 시 재시도, 최대 3회)
      let lastError: unknown = null;
      let inserted: InvoiceRow | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: seqData, error: seqError } = await supabase.rpc(
          'next_invoice_daily_seq',
          {
            p_manager_no: managerNo,
            p_invoice_date: invoiceDate,
          }
        );
        if (seqError || seqData === null || seqData === undefined) {
          lastError = seqError ?? new Error('daily_seq를 가져올 수 없습니다.');
          continue;
        }
        const dailySeq = Number(seqData);
        const invoiceNo = buildInvoiceNo(invoiceDate, dailySeq, managerNo);

        const { data: insertedData, error: insertError } = await supabase
          .from('invoices')
          .insert({
            settlement_id: settlementId,
            invoice_no: invoiceNo,
            invoice_date: invoiceDate,
            due_date: dueDate,
            manager_no: managerNo,
            daily_seq: dailySeq,
            from_email: fromEmail,
            bill_to_name: account.bill_to_name ?? null,
            bill_to_email: account.bill_to_email ?? null,
            bill_to_address: account.bill_to_address ?? null,
            created_by: user.id,
          })
          .select()
          .single();

        if (!insertError && insertedData) {
          inserted = insertedData as InvoiceRow;
          break;
        }

        lastError = insertError;
        // unique constraint 충돌이면 재시도
        const msg = insertError?.message ?? '';
        const code = (insertError as any)?.code ?? '';
        const isConflict =
          code === '23505' ||
          /duplicate|unique|invoices_manager_date_seq_uniq/i.test(msg);
        if (!isConflict) {
          // 다른 에러는 즉시 종료
          break;
        }
        // 충돌 — 다음 루프에서 다시 시도
      }

      if (!inserted) {
        const msg =
          lastError instanceof Error
            ? lastError.message
            : '인보이스 발행에 실패했습니다.';
        toast.error(`인보이스 발행 실패: ${msg}`);
        return;
      }

      toast.success(`인보이스 ${inserted.invoice_no} 가 발행되었습니다.`);
      onIssued(inserted.id);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      toast.error(`인보이스 발행 실패: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>인보이스 발행</DialogTitle>
          <DialogDescription>
            이 정산서로 인보이스를 발행합니다. 발행 후에는 인보이스 화면으로
            이동합니다.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          {missingBillTo.length > 0 && (
            <div className='rounded-md border border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-3 text-sm'>
              <p className='font-medium text-red-900 dark:text-red-200'>
                광고주 BILL TO 정보가 누락되어 발행할 수 없습니다.
              </p>
              <p className='text-red-800 dark:text-red-300 mt-1'>
                누락된 항목:{' '}
                <span className='font-semibold'>
                  {missingBillTo.join(', ')}
                </span>
                . 광고주 수정 화면에서 먼저 채워주세요.
              </p>
            </div>
          )}

          {existingInvoice && (
            <div className='rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 p-3 text-sm'>
              <p className='font-medium text-yellow-900 dark:text-yellow-200'>
                이 정산서에는 이미 인보이스{' '}
                <span className='font-mono'>{existingInvoice.invoice_no}</span>{' '}
                가 발행되었습니다.
              </p>
              <p className='text-yellow-800 dark:text-yellow-300 mt-1'>
                추가 발행하려면 그대로 진행하세요.
              </p>
            </div>
          )}

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-2'>
              <Label htmlFor='invoice-date'>Invoice Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id='invoice-date'
                    variant='outline'
                    className='w-full justify-start text-left font-normal'
                  >
                    <span className='flex-1 text-left'>
                      {formatDateDisplay(invoiceDate) || '날짜 선택'}
                    </span>
                    <CalendarIcon className='ml-auto h-4 w-4 opacity-50' />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className='w-auto p-0' align='start'>
                  <Calendar
                    mode='single'
                    captionLayout='dropdown'
                    selected={invoiceDate ? new Date(invoiceDate) : undefined}
                    defaultMonth={
                      invoiceDate ? new Date(invoiceDate) : undefined
                    }
                    onSelect={(date) => {
                      if (date) setInvoiceDate(isoFromDate(date));
                    }}
                    fromYear={2020}
                    toYear={2100}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='due-date'>
                Due Date{' '}
                <span className='text-xs text-muted-foreground font-normal'>
                  ({dueDays}일 후)
                </span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id='due-date'
                    variant='outline'
                    className='w-full justify-start text-left font-normal'
                  >
                    <span className='flex-1 text-left'>
                      {formatDateDisplay(dueDate) || '날짜 선택'}
                    </span>
                    <CalendarIcon className='ml-auto h-4 w-4 opacity-50' />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className='w-auto p-0' align='start'>
                  <Calendar
                    mode='single'
                    captionLayout='dropdown'
                    selected={dueDate ? new Date(dueDate) : undefined}
                    defaultMonth={dueDate ? new Date(dueDate) : undefined}
                    onSelect={(date) => {
                      if (date) setDueDate(isoFromDate(date));
                    }}
                    fromYear={2020}
                    toYear={2100}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button
            onClick={handleIssue}
            disabled={submitting || checking || missingBillTo.length > 0}
          >
            {submitting ? '발행 중...' : '발행'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
