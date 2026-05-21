'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Trash2, Send, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

import { AccessControl } from '@/components/access-control';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/sonner';
import { DeleteConfirmationDialog } from '@/components/common/delete-confirmation-dialog';
import { SendInvoiceModal } from '@/components/invoices/send-invoice-modal';
import { createClient } from '@/utils/supabase/client';
import type { Database } from '@/lib/database.types';

type InvoiceRow = Database['public']['Tables']['invoices']['Row'];
type SettlementRow = Database['public']['Tables']['settlements']['Row'];
type SettlementLineRow =
  Database['public']['Tables']['settlement_lines']['Row'];
type CompanyInfoRow = Database['public']['Tables']['company_info']['Row'];
type SendHistoryRow =
  Database['public']['Tables']['invoice_send_history']['Row'];

interface InvoiceData {
  invoice: InvoiceRow;
  settlement: SettlementRow;
  lines: SettlementLineRow[];
  company: CompanyInfoRow | null;
  history: SendHistoryRow[];
}

export default function InvoiceViewPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;
  const settlementId = params.settlementId as string;
  const invoiceId = params.invoiceId as string;

  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      // Invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();
      if (invoiceError) throw invoiceError;

      // Settlement + lines
      const { data: settlementData, error: settlementError } = await supabase
        .from('settlements')
        .select('*')
        .eq('id', settlementId)
        .single();
      if (settlementError) throw settlementError;

      const { data: linesData, error: linesError } = await supabase
        .from('settlement_lines')
        .select('*')
        .eq('settlement_id', settlementId)
        .order('sort_order', { ascending: true });
      if (linesError) throw linesError;

      // Company info
      const { data: companyData, error: companyError } = await supabase
        .from('company_info')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (companyError) throw companyError;

      // 발송 이력
      const { data: historyData, error: historyError } = await supabase
        .from('invoice_send_history')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('sent_at', { ascending: false });
      if (historyError) throw historyError;

      setData({
        invoice: invoiceData as InvoiceRow,
        settlement: settlementData as SettlementRow,
        lines: (linesData ?? []) as SettlementLineRow[],
        company: (companyData as CompanyInfoRow) ?? null,
        history: (historyData ?? []) as SendHistoryRow[],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      toast.error(`인보이스 불러오기 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [invoiceId, settlementId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);
      if (error) throw error;
      toast.success('인보이스가 삭제되었습니다.');
      // 정산서 상세 페이지로 이동
      router.push(`/accounts/${accountId}/settlements/${settlementId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      toast.error(`인보이스 삭제 실패: ${msg}`);
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <AccessControl>
        <div className='space-y-4 max-w-5xl mx-auto'>
          <Skeleton className='h-12 w-1/3' />
          <Skeleton className='h-64 w-full' />
          <Skeleton className='h-96 w-full' />
        </div>
      </AccessControl>
    );
  }

  if (!data) {
    return (
      <AccessControl>
        <div className='text-center py-12 text-muted-foreground'>
          인보이스를 찾을 수 없습니다.
        </div>
      </AccessControl>
    );
  }


  return (
    <AccessControl>
      <div className='space-y-3'>
        {/* Action Buttons */}
        <div className='mx-auto max-w-[900px] flex justify-end gap-2'>
          <Button onClick={() => setSendModalOpen(true)} size='sm'>
            <Send className='h-4 w-4' />
            이메일 발송
          </Button>
          <Button
            onClick={() => setConfirmDeleteOpen(true)}
            size='sm'
            variant='outline'
            className='text-destructive hover:bg-destructive/10 hover:text-destructive'
          >
            <Trash2 className='h-4 w-4' />
            삭제
          </Button>
        </div>

        {/* 발송 이력 */}
        {data.history.length > 0 && (
          <div className='mx-auto max-w-[900px] rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 text-sm overflow-hidden'>
            <button
              type='button'
              onClick={() => setHistoryOpen((v) => !v)}
              className='w-full flex items-center gap-2 p-3 text-left hover:bg-emerald-100/40 dark:hover:bg-emerald-950/30 transition-colors'
            >
              {historyOpen ? (
                <ChevronDown className='h-4 w-4 flex-shrink-0 text-emerald-700 dark:text-emerald-300' />
              ) : (
                <ChevronRight className='h-4 w-4 flex-shrink-0 text-emerald-700 dark:text-emerald-300' />
              )}
              <span className='font-medium text-emerald-900 dark:text-emerald-200'>
                ✅ 이메일 발송 완료
              </span>
              <span className='text-xs text-emerald-700 dark:text-emerald-300'>
                ({data.history.length}회 발송 · 최근:{' '}
                {new Date(data.history[0].sent_at).toLocaleString('ko-KR')})
              </span>
            </button>
            {historyOpen && (
              <div className='border-t border-emerald-200 dark:border-emerald-800 divide-y divide-emerald-200 dark:divide-emerald-800'>
                {data.history.map((h, idx) => (
                  <div
                    key={h.id}
                    className='p-3 text-xs text-emerald-800 dark:text-emerald-300 space-y-0.5'
                  >
                    <div className='flex items-center justify-between gap-2 mb-1'>
                      <span className='font-semibold text-emerald-900 dark:text-emerald-200'>
                        #{data.history.length - idx} ·{' '}
                        {new Date(h.sent_at).toLocaleString('ko-KR')}
                      </span>
                      {h.sent_by_email && (
                        <span className='text-[11px]'>
                          by {h.sent_by_email}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className='font-semibold'>제목:</span>{' '}
                      {h.sent_subject}
                    </div>
                    <div>
                      <span className='font-semibold'>To:</span> {h.sent_to}
                    </div>
                    {h.sent_cc && (
                      <div>
                        <span className='font-semibold'>CC:</span> {h.sent_cc}
                      </div>
                    )}
                    {h.attachments_summary && (
                      <div className='truncate'>
                        <span className='font-semibold'>첨부:</span>{' '}
                        {h.attachments_summary}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className='mx-auto max-w-[900px]'>
          <div
            className='relative w-full bg-white shadow-md rounded-md border overflow-hidden'
            style={{ height: 'calc(100vh - 140px)', minHeight: '900px' }}
          >
            <iframe
              key={invoiceId}
              src={`/api/invoices/${invoiceId}/pdf`}
              title='Invoice PDF Preview'
              className='w-full h-full'
              onLoad={() => setPdfLoaded(true)}
            />
            {!pdfLoaded && (
              <div className='absolute inset-0 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm'>
                <div className='flex space-x-1.5 mb-3'>
                  <div className='w-2.5 h-2.5 bg-primary rounded-full animate-bounce'></div>
                  <div
                    className='w-2.5 h-2.5 bg-primary rounded-full animate-bounce'
                    style={{ animationDelay: '0.1s' }}
                  ></div>
                  <div
                    className='w-2.5 h-2.5 bg-primary rounded-full animate-bounce'
                    style={{ animationDelay: '0.2s' }}
                  ></div>
                </div>
                <p className='text-sm text-muted-foreground'>
                  PDF 생성 중...
                </p>
                <p className='text-xs text-muted-foreground mt-1'>
                  몇 초 정도 걸릴 수 있어요
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      <DeleteConfirmationDialog
        isOpen={confirmDeleteOpen}
        onClose={() => !deleting && setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        title='인보이스 삭제'
        description={`인보이스 "${data.invoice.invoice_no}" 를 삭제합니다. 정산서는 삭제되지 않습니다.`}
        confirmLabel={deleting ? '삭제 중...' : '삭제'}
        cancelLabel='취소'
      />

      <SendInvoiceModal
        isOpen={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        invoiceId={invoiceId}
        accountId={data.settlement.account_id}
        invoiceNo={data.invoice.invoice_no}
        invoiceDate={data.invoice.invoice_date}
        dueDate={data.invoice.due_date}
        periodTo={data.settlement.period_to}
        totalAmount={
          data.settlement.total_amount
            ? Number(data.settlement.total_amount)
            : data.lines.reduce((s, l) => s + Number(l.amount ?? 0), 0)
        }
        billToCompany={data.invoice.bill_to_name ?? ''}
        fromCompany={data.company?.name ?? ''}
        onSent={() => load()}
      />

      <Toaster position='top-center' />
    </AccessControl>
  );
}

