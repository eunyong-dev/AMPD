'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Download, Trash2, Send } from 'lucide-react';
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

interface InvoiceData {
  invoice: InvoiceRow;
  settlement: SettlementRow;
  lines: SettlementLineRow[];
  company: CompanyInfoRow | null;
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

      setData({
        invoice: invoiceData as InvoiceRow,
        settlement: settlementData as SettlementRow,
        lines: (linesData ?? []) as SettlementLineRow[],
        company: (companyData as CompanyInfoRow) ?? null,
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

  // PDF 다운로드 = /api/invoices/[id]/pdf 호출 → blob 으로 받아 파일 저장
  const handleDownloadPdf = async () => {
    if (!data) return;
    try {
      const dateRaw = (data.invoice.invoice_date ?? '').replace(/-/g, '');
      const yymmdd = dateRaw.length >= 8 ? dateRaw.slice(2, 8) : dateRaw;
      const companyRaw = data.invoice.bill_to_name ?? 'invoice';
      const companySafe =
        companyRaw.replace(/[\\/:*?"<>|]/g, '').trim() || 'invoice';
      const filename = `${yymmdd}_invoice_${companySafe}.pdf`;

      const res = await fetch(`/api/invoices/${invoiceId}/pdf`);
      if (!res.ok) throw new Error(`PDF 생성 실패 (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      toast.error(`PDF 다운로드 실패: ${msg}`);
    }
  };

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
      <div className='relative'>
        {/* Action Buttons */}
        <div className='no-print fixed top-20 right-6 z-30 flex gap-2'>
          <Button onClick={() => setSendModalOpen(true)} size='sm'>
            <Send className='h-4 w-4 mr-1.5' />
            이메일 발송
          </Button>
          <Button onClick={handleDownloadPdf} size='sm' variant='outline'>
            <Download className='h-4 w-4 mr-1.5' />
            PDF 다운로드
          </Button>
          <Button
            onClick={() => setConfirmDeleteOpen(true)}
            size='sm'
            variant='outline'
            className='text-destructive hover:bg-destructive/10 hover:text-destructive'
          >
            <Trash2 className='h-4 w-4 mr-1.5' />
            삭제
          </Button>
        </div>

        {/* 발송 이력 배너 */}
        {data.invoice.sent_at && (
          <div className='no-print mt-10 mx-auto max-w-[900px] mb-3 rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-3 text-sm'>
            <div className='font-medium text-emerald-900 dark:text-emerald-200'>
              ✅ 이메일 발송 완료
            </div>
            <div className='text-emerald-800 dark:text-emerald-300 mt-1 text-xs space-y-0.5'>
              <div>
                <span className='font-semibold'>To:</span>{' '}
                {data.invoice.sent_to}
              </div>
              {data.invoice.sent_cc && (
                <div>
                  <span className='font-semibold'>CC:</span>{' '}
                  {data.invoice.sent_cc}
                </div>
              )}
              <div>
                <span className='font-semibold'>발송 시각:</span>{' '}
                {new Date(data.invoice.sent_at).toLocaleString('ko-KR')}
              </div>
            </div>
          </div>
        )}

        <div
          className={`mx-auto max-w-[900px] ${
            data.invoice.sent_at ? '' : 'mt-10'
          }`}
        >
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

