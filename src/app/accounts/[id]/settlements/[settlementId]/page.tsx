'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Trash2, Copy, ChevronDown, FileText, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import { AccessControl } from '@/components/access-control';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  TableWrapper,
  TABLE_STYLES,
} from '@/components/common/table-wrapper';
import { Toaster } from '@/components/ui/sonner';
import { DeleteConfirmationDialog } from '@/components/common/delete-confirmation-dialog';
import { IssueInvoiceModal } from '@/components/invoices/issue-invoice-modal';
import { createClient } from '@/utils/supabase/client';
import { accountUrl } from '@/lib/utils/account-url';
import {
  compareByNameAndRegion,
  compareByDescriptionAndGeo,
} from '@/lib/utils/campaign-sort';
import { useRawCopy } from '@/lib/utils/use-raw-copy';
import type { Database } from '@/lib/database.types';

type InvoiceRow = Database['public']['Tables']['invoices']['Row'];

type SettlementRow = Database['public']['Tables']['settlements']['Row'];
type SettlementLineRow =
  Database['public']['Tables']['settlement_lines']['Row'];

interface CampaignBrief {
  id: string;
  name: string;
}

interface SettlementLineWithGame extends SettlementLineRow {
  game_store_url: string | null;
  game_logo_url: string | null;
}

interface SettlementDetail extends SettlementRow {
  campaigns: CampaignBrief[];
  lines: SettlementLineWithGame[];
  account_company: string | null;
}

// 게임 아이콘 + Description 셀
// 스프레드시트로 복사 시 행 분리되지 않도록 inline 구조 사용
function DescriptionCell({
  description,
  gameLogoUrl,
}: {
  description: string | null;
  gameStoreUrl?: string | null;
  gameLogoUrl: string | null;
}) {
  const logoUrl = gameLogoUrl ?? null;

  return (
    <span className='inline-flex items-center gap-2 align-middle'>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=''
          width={24}
          height={24}
          className='h-6 w-6 rounded object-cover border border-border inline-block flex-shrink-0'
        />
      ) : (
        <span className='h-6 w-6 rounded bg-muted border border-border inline-block flex-shrink-0' />
      )}
      <span>{description ?? '—'}</span>
    </span>
  );
}

// 지역별 색상 (캠페인 페이지의 지역 카드 색상과 동일)
const GEO_COLORS: Record<string, string> = {
  KR: '#3b82f6',
  JP: '#a855f7',
  TW: '#14b8a6',
  US: '#f97316',
};

const GEO_FLAGS: Record<string, string> = {
  KR: '🇰🇷',
  JP: '🇯🇵',
  TW: '🇹🇼',
  US: '🇺🇸',
};

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

export default function SettlementDetailPage() {
  const params = useParams();
  const router = useRouter();
  // [id] 라우트는 회사명(slug). decode해서 사용
  const companyParam = decodeURIComponent(params.id as string);
  const accountBaseUrl = accountUrl(companyParam);
  const settlementId = params.settlementId as string;

  const [settlement, setSettlement] = useState<SettlementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [showIssueInvoice, setShowIssueInvoice] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);

  const loadInvoices = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('settlement_id', settlementId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setInvoices((data ?? []) as InvoiceRow[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      toast.error(`인보이스 목록 조회 실패: ${msg}`);
    }
  }, [settlementId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('settlements')
        .select(
          `
          *,
          account:accounts ( company ),
          settlement_campaigns ( campaign:campaigns ( id, name ) ),
          settlement_lines (
            *,
            campaign:campaigns (
              id,
              game:games ( store_url, logo_url )
            )
          )
          `
        )
        .eq('id', settlementId)
        .single();

      if (error) throw error;
      if (!data) {
        toast.error('정산서를 찾을 수 없습니다.');
        router.push(`${accountBaseUrl}?tab=settlements`);
        return;
      }

      const lines: SettlementLineWithGame[] = (
        (data as any).settlement_lines ?? []
      )
        .map((l: any) => ({
          ...(l as SettlementLineRow),
          game_store_url: l?.campaign?.game?.store_url ?? null,
          game_logo_url: l?.campaign?.game?.logo_url ?? null,
        }))
        .sort(
          (a: SettlementLineWithGame, b: SettlementLineWithGame) =>
            a.sort_order - b.sort_order
        );

      const detail: SettlementDetail = {
        ...(data as SettlementRow),
        campaigns: ((data as any).settlement_campaigns ?? [])
          .map((sc: any) => sc.campaign)
          .filter(Boolean),
        lines,
        account_company: (data as any).account?.company ?? null,
      };
      setSettlement(detail);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      toast.error(`정산서 불러오기 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [accountBaseUrl, router, settlementId]);

  useEffect(() => {
    load();
    loadInvoices();
  }, [load, loadInvoices]);

  // 페이지가 다시 visible 될 때 인보이스 목록 재로드
  // (인보이스 상세에서 발송 후 돌아왔을 때 발송 상태 갱신용)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadInvoices();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  }, [loadInvoices]);

  const handleDelete = async () => {
    if (!settlement) return;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('settlements')
        .delete()
        .eq('id', settlement.id);
      if (error) throw error;
      toast.success('정산서가 삭제되었습니다.');
      router.push(`${accountBaseUrl}?tab=settlements`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      toast.error(`삭제 실패: ${msg}`);
    } finally {
      setShowDelete(false);
    }
  };

  const linesTotal = useMemo(() => {
    if (!settlement) return 0;
    return settlement.lines.reduce(
      (sum, l) => sum + Number(l.amount ?? 0),
      0
    );
  }, [settlement]);

  // 지역(GEO)별 총 금액 — KR/JP/TW/US 순으로 표시 (값 있는 것만)
  const amountByGeo = useMemo(() => {
    if (!settlement) return [];
    const map = new Map<string, number>();
    for (const l of settlement.lines) {
      const geo = (l.geo ?? '').trim() || '—';
      map.set(geo, (map.get(geo) ?? 0) + Number(l.amount ?? 0));
    }
    const order = ['KR', 'JP', 'TW', 'US'];
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [settlement]);

  // 정렬: 베이스 이름 + region(KR>JP>TW>US) 우선순위
  const sortedCampaigns = useMemo(() => {
    if (!settlement) return [];
    return [...settlement.campaigns].sort(compareByNameAndRegion);
  }, [settlement]);

  const sortedLines = useMemo(() => {
    if (!settlement) return [];
    return [...settlement.lines].sort(compareByDescriptionAndGeo);
  }, [settlement]);

  // Detail 테이블 복사 시 포맷팅된 숫자 → raw 숫자로 치환
  const tableRef = useRef<HTMLTableElement>(null);
  useRawCopy(tableRef);

  // Detail 라인을 클립보드로 복사
  // - withHeader: 헤더 + 데이터 + TOTAL (전체 테이블)
  // - !withHeader: 데이터 라인만 (헤더 미리 세팅된 템플릿용)
  const copyLines = async ({ withHeader }: { withHeader: boolean }) => {
    if (sortedLines.length === 0) return;

    const headers = [
      'Description',
      'Model',
      'Rate',
      'GEO',
      'Duration',
      'Quantity',
      'Amount',
    ];
    const dataRows: string[][] = sortedLines.map((l) => [
      l.description ?? '',
      l.model ?? '',
      String(Number(l.rate)),
      l.geo ?? '',
      `${l.duration_from} ~ ${l.duration_to}`,
      String(l.quantity),
      String(Number(l.amount)),
    ]);
    const totalRow = [
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      String(linesTotal),
    ];
    const rows: string[][] = withHeader
      ? [headers, ...dataRows, totalRow]
      : dataRows;

    const tsv = rows.map((r) => r.join('\t')).join('\n');

    // HTML <table> — visual styling 포함 (헤더/총계 배경, 테두리).
    // Google 시트는 inline style을 source 서식으로 받고, 셀 내용 서식은
    // destination 우선 적용 (예: $ 표시는 시트의 셀 format이 적용)
    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const cellBase =
      'border:1px solid #d1d5db;padding:6px 10px;vertical-align:top;';
    const headerStyle =
      cellBase + 'background-color:#f3f4f6;font-weight:600;';
    const totalStyle =
      cellBase + 'background-color:#f9fafb;font-weight:600;border-top:2px solid #9ca3af;';

    const renderRow = (cells: string[], style: string) =>
      `<tr>${cells
        .map((c) => `<td style="${style}">${escapeHtml(c)}</td>`)
        .join('')}</tr>`;

    let bodyHtml = '';
    if (withHeader) {
      bodyHtml += renderRow(headers, headerStyle);
    }
    bodyHtml += dataRows.map((r) => renderRow(r, cellBase)).join('');
    if (withHeader) {
      bodyHtml += renderRow(totalRow, totalStyle);
    }

    const html = `<table style="border-collapse:collapse;">${bodyHtml}</table>`;

    try {
      if (
        typeof ClipboardItem !== 'undefined' &&
        navigator.clipboard.write
      ) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([tsv], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(tsv);
      }
      toast.success(
        `${sortedLines.length}개 행${
          withHeader ? ' (헤더 포함)' : ''
        }을(를) 복사했습니다.`
      );
    } catch {
      toast.error('클립보드 복사에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <AccessControl>
        <div className='space-y-4 w-full overflow-x-hidden'>
          <Skeleton className='h-10 w-1/3' />
          <Skeleton className='h-6 w-1/2' />
          <Skeleton className='h-[300px] w-full' />
        </div>
      </AccessControl>
    );
  }

  if (!settlement) {
    return (
      <AccessControl>
        <div className='text-center py-12 text-muted-foreground'>
          정산서를 찾을 수 없습니다.
        </div>
      </AccessControl>
    );
  }

  return (
    <AccessControl>
      <div className='space-y-6 w-full overflow-x-hidden'>
        {/* Header */}
        <div>
          <div className='flex items-start justify-between gap-4 flex-wrap'>
            <div>
              <h1 className='text-2xl font-bold'>{settlement.title}</h1>
              <div className='flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground'>
                {settlement.account_company && (
                  <>
                    <span>{settlement.account_company}</span>
                    <span>·</span>
                  </>
                )}
                <span className='tabular-nums'>
                  {settlement.period_from} ~ {settlement.period_to}
                </span>
              </div>
              {amountByGeo.length > 0 && (
                <div className='flex items-center flex-wrap gap-x-5 gap-y-2 mt-3 text-sm'>
                  <div className='flex items-baseline gap-2'>
                    <span className='text-xs font-medium text-muted-foreground'>
                      Total
                    </span>
                    <span className='text-base font-bold tabular-nums'>
                      ${linesTotal.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className='h-4 w-px bg-border' />
                  {amountByGeo.map(([geo, amount]) => {
                    const pct =
                      linesTotal > 0 ? (amount / linesTotal) * 100 : 0;
                    return (
                      <div
                        key={geo}
                        className='flex items-baseline gap-1.5'
                      >
                        <span
                          className='inline-block h-2 w-2 rounded-full'
                          style={{
                            backgroundColor: GEO_COLORS[geo] ?? '#94a3b8',
                          }}
                        />
                        <span className='text-xs font-semibold text-muted-foreground'>
                          {GEO_FLAGS[geo] ?? ''} {geo}
                        </span>
                        <span className='font-semibold tabular-nums'>
                          ${amount.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className='text-xs text-muted-foreground tabular-nums'>
                          ({pct.toFixed(0)}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className='flex items-center gap-2 flex-shrink-0'>
              <Button
                variant='default'
                size='sm'
                onClick={() => setShowIssueInvoice(true)}
              >
                <FileText className='h-4 w-4' />
                인보이스 발행
              </Button>
              <Button
                variant='outline'
                size='sm'
                className='text-destructive hover:bg-destructive/10 hover:text-destructive'
                onClick={() => setShowDelete(true)}
              >
                <Trash2 className='h-4 w-4' />
                삭제
              </Button>
            </div>
          </div>
        </div>

        {/* 발행된 인보이스 */}
        {invoices.length > 0 && (
          <div>
            <h2 className='text-lg font-semibold mb-3'>발행된 인보이스</h2>
            <TableWrapper>
              <Table style={{ width: '100%' }}>
                <TableHeader className={TABLE_STYLES.header}>
                  <TableRow>
                    <TableHead className='whitespace-nowrap'>
                      Invoice No
                    </TableHead>
                    <TableHead className='whitespace-nowrap tabular-nums'>
                      Invoice Date
                    </TableHead>
                    <TableHead className='whitespace-nowrap tabular-nums'>
                      Due Date
                    </TableHead>
                    <TableHead className='whitespace-nowrap'>
                      발송 상태
                    </TableHead>
                    <TableHead
                      className='whitespace-nowrap text-right'
                      style={{ width: 100 }}
                    >
                      보기
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className={TABLE_STYLES.body}>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className='font-mono text-sm'>
                        {inv.invoice_no}
                      </TableCell>
                      <TableCell className='tabular-nums'>
                        {inv.invoice_date}
                      </TableCell>
                      <TableCell className='tabular-nums'>
                        {inv.due_date}
                      </TableCell>
                      <TableCell>
                        {inv.sent_at ? (
                          <Badge
                            variant='outline'
                            className='gap-1 text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-800 dark:bg-emerald-950/30'
                          >
                            <span className='h-1.5 w-1.5 rounded-full bg-emerald-500' />
                            발송됨{' '}
                            <span className='text-[10px] opacity-80'>
                              {new Date(inv.sent_at).toLocaleDateString(
                                'ko-KR'
                              )}
                            </span>
                          </Badge>
                        ) : (
                          <Badge
                            variant='outline'
                            className='gap-1 text-muted-foreground'
                          >
                            <span className='h-1.5 w-1.5 rounded-full bg-muted-foreground/40' />
                            미발송
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className='text-right'>
                        <Link
                          href={`${accountBaseUrl}/settlements/${settlementId}/invoice/${inv.id}`}
                          className='inline-flex items-center gap-1 text-primary hover:underline text-sm'
                        >
                          <ExternalLink className='h-3.5 w-3.5' />
                          보기
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </div>
        )}

        {/* Detail Lines */}
        <div>
          <div className='flex items-center justify-between mb-3'>
            <h2 className='text-lg font-semibold'>상세</h2>
            {settlement.lines.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='outline' size='sm'>
                    <Copy className='h-4 w-4' />
                    복사
                    <ChevronDown className='h-4 w-4 ml-1' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuItem
                    onClick={() => copyLines({ withHeader: true })}
                  >
                    헤더 포함 복사
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => copyLines({ withHeader: false })}
                  >
                    데이터만 복사
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {settlement.lines.length === 0 ? (
            <div className='border rounded-xl py-12 text-center text-sm text-muted-foreground'>
              상세 라인이 없습니다. (시트에 해당 기간의 데이터가 없거나 단가가
              비어있을 수 있습니다.)
            </div>
          ) : (
            <TableWrapper>
              <Table ref={tableRef} style={{ width: '100%' }}>
                <TableHeader className={TABLE_STYLES.header}>
                  <TableRow>
                    <TableHead
                      className='whitespace-nowrap'
                      style={{ width: '100%' }}
                    >
                      Description
                    </TableHead>
                    <TableHead className='whitespace-nowrap'>Model</TableHead>
                    <TableHead className='whitespace-nowrap text-right'>
                      Rate
                    </TableHead>
                    <TableHead className='whitespace-nowrap pl-10'>
                      GEO
                    </TableHead>
                    <TableHead className='whitespace-nowrap tabular-nums'>
                      Duration
                    </TableHead>
                    <TableHead className='whitespace-nowrap text-right'>
                      Quantity
                    </TableHead>
                    <TableHead className='whitespace-nowrap text-right'>
                      Amount
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className={TABLE_STYLES.body}>
                  {sortedLines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className='whitespace-nowrap font-medium'>
                        <DescriptionCell
                          description={l.description}
                          gameStoreUrl={l.game_store_url}
                          gameLogoUrl={l.game_logo_url}
                        />
                      </TableCell>
                      <TableCell className='whitespace-nowrap'>
                        {l.model ?? '—'}
                      </TableCell>
                      <TableCell
                        className='whitespace-nowrap text-right tabular-nums'
                        data-copy={String(Number(l.rate))}
                      >
                        {formatRate(Number(l.rate))}
                      </TableCell>
                      <TableCell className='whitespace-nowrap pl-10'>
                        {l.geo ?? '—'}
                      </TableCell>
                      <TableCell className='whitespace-nowrap tabular-nums text-muted-foreground'>
                        {l.duration_from} ~ {l.duration_to}
                      </TableCell>
                      <TableCell
                        className='whitespace-nowrap text-right tabular-nums'
                        data-copy={String(l.quantity)}
                      >
                        {l.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell
                        className='whitespace-nowrap text-right tabular-nums font-medium'
                        data-copy={String(Number(l.amount))}
                      >
                        {formatAmount(Number(l.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* TOTAL Row */}
                  <TableRow className='border-t-2 bg-muted/40'>
                    <TableCell
                      colSpan={6}
                      className='whitespace-nowrap text-right font-semibold'
                    >
                      Total
                    </TableCell>
                    <TableCell
                      className='whitespace-nowrap text-right tabular-nums font-bold'
                      data-copy={String(linesTotal)}
                    >
                      {formatAmount(linesTotal)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableWrapper>
          )}
        </div>

        <DeleteConfirmationDialog
          isOpen={showDelete}
          onClose={() => setShowDelete(false)}
          onConfirm={handleDelete}
          title='정산서 삭제'
          description={`"${settlement.title}" 정산을 삭제합니다. 모든 정산 상세 내역이 함께 삭제됩니다.`}
        />

        <IssueInvoiceModal
          isOpen={showIssueInvoice}
          onClose={() => setShowIssueInvoice(false)}
          settlementId={settlementId}
          accountId={settlement.account_id}
          periodTo={settlement.period_to}
          onIssued={(invoiceId) => {
            // 발행 후 인보이스 보기로 이동
            router.push(
              `${accountBaseUrl}/settlements/${settlementId}/invoice/${invoiceId}`
            );
          }}
        />
      </div>
      <Toaster position='top-center' />
    </AccessControl>
  );
}
