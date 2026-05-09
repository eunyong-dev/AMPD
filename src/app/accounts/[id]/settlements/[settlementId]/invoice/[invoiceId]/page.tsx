'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { AccessControl } from '@/components/access-control';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/sonner';
import { DeleteConfirmationDialog } from '@/components/common/delete-confirmation-dialog';
import { createClient } from '@/utils/supabase/client';
import {
  compareByDescriptionAndGeo,
} from '@/lib/utils/campaign-sort';
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

const MIN_ROWS = 12;

const formatAmount = (n: number) =>
  `$ ${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatRate = (n: number) =>
  `$ ${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;

export default function InvoiceViewPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;
  const settlementId = params.settlementId as string;
  const invoiceId = params.invoiceId as string;

  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        lines: ((linesData ?? []) as SettlementLineRow[]).slice().sort(
          compareByDescriptionAndGeo
        ),
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

  const buildPdfFilename = useCallback(() => {
    if (!data) return 'invoice';
    const dateRaw = (data.invoice.invoice_date ?? '').replace(/-/g, '');
    const yymmdd = dateRaw.length >= 8 ? dateRaw.slice(2, 8) : dateRaw;
    const companyRaw = data.invoice.bill_to_name ?? 'invoice';
    const companySafe =
      companyRaw.replace(/[\\/:*?"<>|]/g, '').trim() || 'invoice';
    return `${yymmdd}_invoice_${companySafe}`;
  }, [data]);

  // PDF 다운로드 = 브라우저 인쇄 대화창에서 "PDF로 저장" 선택
  // document.title 을 임시로 변경해 기본 파일명을 지정
  const handleDownloadPdf = () => {
    if (typeof window === 'undefined' || !data) return;
    const filename = buildPdfFilename();
    const originalTitle = document.title;
    document.title = filename;

    const restore = () => {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);

    // 약간의 지연 후 인쇄 호출 (title 변경 반영)
    setTimeout(() => {
      window.print();
      // 일부 브라우저는 afterprint 미발생 — 안전장치로 복원
      setTimeout(restore, 1000);
    }, 50);
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

  const { invoice, settlement, lines, company } = data;
  const total = lines.reduce((sum, l) => sum + Number(l.amount ?? 0), 0);
  const emptyRows = Math.max(0, MIN_ROWS - lines.length);

  return (
    <AccessControl>
      <style jsx global>{`
        @media print {
          html,
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .invoice-page {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 16mm 14mm !important;
            max-width: 100% !important;
            width: 100% !important;
            min-height: auto !important;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .invoice-page * {
            page-break-inside: avoid;
          }
          .invoice-page table td,
          .invoice-page table th {
            padding-top: 4px !important;
            padding-bottom: 4px !important;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>

      <div className='relative'>
        {/* PDF Download + Delete Buttons */}
        <div className='no-print fixed top-20 right-6 z-30 flex gap-2'>
          <Button onClick={handleDownloadPdf} size='sm'>
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

        <div
          className='invoice-page bg-white text-black mx-auto p-10 shadow-md max-w-[900px] text-[12px] mt-10 print:mt-0'
          style={{ minHeight: '1100px' }}
        >
          {/* Top: Title + Invoice Info */}
          <div className='flex items-start justify-between gap-6 mb-6'>
            <div>
              <h1 className='text-4xl font-extrabold tracking-tight'>
                INVOICE
              </h1>
            </div>
            <table className='text-sm border-collapse'>
              <tbody>
                <tr>
                  <td className='font-semibold pr-3 py-0.5 align-top'>
                    Invoice No
                  </td>
                  <td className='py-0.5 font-mono'>{invoice.invoice_no}</td>
                </tr>
                <tr>
                  <td className='font-semibold pr-3 py-0.5 align-top'>
                    Invoice Date
                  </td>
                  <td className='py-0.5 tabular-nums'>{invoice.invoice_date}</td>
                </tr>
                <tr>
                  <td className='font-semibold pr-3 py-0.5 align-top'>
                    Due Date
                  </td>
                  <td className='py-0.5 tabular-nums'>{invoice.due_date}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* FROM / BILL TO */}
          <div className='grid grid-cols-2 gap-6 mb-6'>
            <div>
              <div className='text-xs font-bold tracking-wider uppercase text-gray-600 mb-1'>
                From
              </div>
              <div className='border-t-2 border-black pt-2 space-y-0.5'>
                <div className='font-semibold text-sm'>
                  {company?.name ?? '—'}
                </div>
                {invoice.from_email && (
                  <div className='text-xs'>{invoice.from_email}</div>
                )}
                {company?.address && (
                  <div className='text-xs'>{company.address}</div>
                )}
              </div>
            </div>
            <div>
              <div className='text-xs font-bold tracking-wider uppercase text-gray-600 mb-1'>
                Bill To
              </div>
              <div className='border-t-2 border-black pt-2 space-y-0.5'>
                <div className='font-semibold text-sm'>
                  {invoice.bill_to_name ?? '—'}
                </div>
                {invoice.bill_to_email && (
                  <div className='text-xs'>{invoice.bill_to_email}</div>
                )}
                {invoice.bill_to_address && (
                  <div className='text-xs'>{invoice.bill_to_address}</div>
                )}
              </div>
            </div>
          </div>

          {/* Detail Table */}
          <div className='mb-4'>
            <div className='text-xs font-bold tracking-wider uppercase text-gray-600 mb-1'>
              Detail
            </div>
            <table className='w-full border-collapse text-[11px]'>
              <thead>
                <tr className='bg-gray-100 border-y-2 border-black'>
                  <th className='text-left py-2 px-2 font-semibold'>
                    DESCRIPTION
                  </th>
                  <th className='text-left py-2 px-2 font-semibold'>Model</th>
                  <th className='text-right py-2 px-2 font-semibold'>Rate</th>
                  <th className='text-left py-2 px-2 font-semibold'>GEO</th>
                  <th className='text-left py-2 px-2 font-semibold'>
                    Duration
                  </th>
                  <th className='text-right py-2 px-2 font-semibold'>
                    Quantity
                  </th>
                  <th className='text-right py-2 px-2 font-semibold'>
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className='border-b border-gray-200'>
                    <td className='py-1.5 px-2'>{l.description ?? ''}</td>
                    <td className='py-1.5 px-2'>{l.model ?? ''}</td>
                    <td className='py-1.5 px-2 text-right tabular-nums'>
                      {formatRate(Number(l.rate))}
                    </td>
                    <td className='py-1.5 px-2'>{l.geo ?? ''}</td>
                    <td className='py-1.5 px-2 tabular-nums whitespace-nowrap'>
                      {l.duration_from} ~ {l.duration_to}
                    </td>
                    <td className='py-1.5 px-2 text-right tabular-nums'>
                      {l.quantity.toLocaleString()}
                    </td>
                    <td className='py-1.5 px-2 text-right tabular-nums'>
                      {formatAmount(Number(l.amount))}
                    </td>
                  </tr>
                ))}
                {Array.from({ length: emptyRows }).map((_, i) => (
                  <tr
                    key={`empty-${i}`}
                    className='border-b border-gray-200'
                  >
                    <td className='py-1.5 px-2'>&nbsp;</td>
                    <td className='py-1.5 px-2'></td>
                    <td className='py-1.5 px-2'></td>
                    <td className='py-1.5 px-2'></td>
                    <td className='py-1.5 px-2'></td>
                    <td className='py-1.5 px-2'></td>
                    <td className='py-1.5 px-2'></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* TOTAL + Stamp (도장은 박스 우측에 살짝 겹쳐서 inline 배치 — 페이지 분리 방지) */}
          <div className='flex items-center justify-end mb-10 pr-10'>
            <div className='inline-flex items-center'>
              <div className='border-2 border-black p-3 min-w-[260px]'>
                <div className='flex items-baseline gap-3'>
                  <div className='text-xs font-bold tracking-wider'>TOTAL</div>
                  <div className='flex-1 text-center text-base font-bold tabular-nums'>
                    {formatAmount(
                      settlement.total_amount
                        ? Number(settlement.total_amount)
                        : total
                    )}
                  </div>
                </div>
              </div>
              {company?.stamp_url ? (
                <div
                  aria-hidden
                  className='-ml-16 pointer-events-none relative z-10'
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={company.stamp_url}
                    alt='Stamp'
                    className='h-20 w-20 object-contain opacity-90'
                  />
                </div>
              ) : null}
            </div>
          </div>

          {/* Payment Information */}
          <div className='border-t-2 border-black pt-3'>
            <div className='text-xs font-bold tracking-wider uppercase text-gray-600 mb-2'>
              Payment Information
            </div>
            <table className='text-[11px] w-full border-collapse'>
              <tbody>
                <PayInfoRow
                  label='Beneficiary Name'
                  value={company?.beneficiary_name}
                />
                <PayInfoRow
                  label='Beneficiary Address'
                  value={company?.beneficiary_address}
                />
                <PayInfoRow label='Bank Name' value={company?.bank_name} />
                <PayInfoRow
                  label='Bank Account Number'
                  value={company?.bank_account_number}
                />
                <PayInfoRow
                  label='Bank Swift Code'
                  value={company?.bank_swift_code}
                />
                <PayInfoRow
                  label='Payment Method'
                  value={company?.payment_method}
                />
                <PayInfoRow
                  label='Bank Address'
                  value={company?.bank_address}
                />
              </tbody>
            </table>
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

      <Toaster position='top-center' />
    </AccessControl>
  );
}

function PayInfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <tr className='border-b border-gray-200 last:border-b-0'>
      <td
        className='py-1 pr-3 align-top font-semibold whitespace-nowrap'
        style={{ width: 200 }}
      >
        {label}
      </td>
      <td className='py-1'>{value || '—'}</td>
    </tr>
  );
}
