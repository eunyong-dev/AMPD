'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { AccessControl } from '@/components/access-control';
import { Button } from '@/components/ui/button';
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
import { createClient } from '@/utils/supabase/client';
import { accountUrl } from '@/lib/utils/account-url';
import { useGameInfo } from '@/hooks/use-game-info';
import type { Database } from '@/lib/database.types';

type SettlementRow = Database['public']['Tables']['settlements']['Row'];
type SettlementLineRow =
  Database['public']['Tables']['settlement_lines']['Row'];

interface CampaignBrief {
  id: string;
  name: string;
}

interface SettlementLineWithGame extends SettlementLineRow {
  game_store_url: string | null;
}

interface SettlementDetail extends SettlementRow {
  campaigns: CampaignBrief[];
  lines: SettlementLineWithGame[];
  account_company: string | null;
}

// 게임 아이콘 + Description 셀 (line별 useGameInfo)
function DescriptionCell({
  description,
  gameStoreUrl,
}: {
  description: string | null;
  gameStoreUrl: string | null;
}) {
  const { data: gameInfo } = useGameInfo(gameStoreUrl);
  const logoUrl = gameInfo?.logo_url ?? null;

  return (
    <div className='flex items-center gap-2'>
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt=''
          width={24}
          height={24}
          className='h-6 w-6 rounded object-cover border border-border flex-shrink-0'
          unoptimized
        />
      ) : (
        <div className='h-6 w-6 rounded bg-muted border border-border flex-shrink-0' />
      )}
      <span className='truncate'>{description ?? '—'}</span>
    </div>
  );
}

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
              game:games ( store_url )
            )
          )
          `
        )
        .eq('id', settlementId)
        .single();

      if (error) throw error;
      if (!data) {
        toast.error('Settlement not found.');
        router.push(`${accountBaseUrl}?tab=settlements`);
        return;
      }

      const lines: SettlementLineWithGame[] = (
        (data as any).settlement_lines ?? []
      )
        .map((l: any) => ({
          ...(l as SettlementLineRow),
          game_store_url: l?.campaign?.game?.store_url ?? null,
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
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to load settlement: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [accountBaseUrl, router, settlementId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    if (!settlement) return;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('settlements')
        .delete()
        .eq('id', settlement.id);
      if (error) throw error;
      toast.success('Settlement deleted.');
      router.push(`${accountBaseUrl}?tab=settlements`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to delete: ${msg}`);
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
          Settlement not found.
        </div>
      </AccessControl>
    );
  }

  return (
    <AccessControl>
      <div className='space-y-6 w-full overflow-x-hidden'>
        {/* Back + Header */}
        <div>
          <Button variant='ghost' size='sm' asChild className='-ml-2 mb-2'>
            <Link href={`${accountBaseUrl}?tab=settlements`}>
              <ChevronLeft className='h-4 w-4 mr-1' />
              Back to Settlements
            </Link>
          </Button>

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
              {settlement.campaigns.length > 0 && (
                <div className='flex flex-wrap gap-1.5 mt-3'>
                  {settlement.campaigns.map((c) => (
                    <Badge
                      key={c.id}
                      variant='outline'
                      className='font-normal'
                    >
                      {c.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Button
              variant='outline'
              size='sm'
              className='text-destructive hover:bg-destructive/10 hover:text-destructive flex-shrink-0'
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className='h-4 w-4 mr-1.5' />
              Delete
            </Button>
          </div>
        </div>

        {/* Detail Lines */}
        <div>
          <h2 className='text-lg font-semibold mb-3'>Detail</h2>

          {settlement.lines.length === 0 ? (
            <div className='border rounded-xl py-12 text-center text-sm text-muted-foreground'>
              No detail lines. (시트에 해당 기간의 데이터가 없거나 단가가
              비어있을 수 있습니다.)
            </div>
          ) : (
            <TableWrapper>
              <Table style={{ width: 'max-content', minWidth: '100%' }}>
                <TableHeader className={TABLE_STYLES.header}>
                  <TableRow>
                    <TableHead className='whitespace-nowrap'>
                      Description
                    </TableHead>
                    <TableHead className='whitespace-nowrap'>Model</TableHead>
                    <TableHead className='whitespace-nowrap text-right'>
                      Rate
                    </TableHead>
                    <TableHead className='whitespace-nowrap'>GEO</TableHead>
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
                  {settlement.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className='whitespace-nowrap font-medium'>
                        <DescriptionCell
                          description={l.description}
                          gameStoreUrl={l.game_store_url}
                        />
                      </TableCell>
                      <TableCell className='whitespace-nowrap'>
                        {l.model ?? '—'}
                      </TableCell>
                      <TableCell className='whitespace-nowrap text-right tabular-nums'>
                        {formatRate(Number(l.rate))}
                      </TableCell>
                      <TableCell className='whitespace-nowrap'>
                        {l.geo ?? '—'}
                      </TableCell>
                      <TableCell className='whitespace-nowrap tabular-nums text-muted-foreground'>
                        {l.duration_from} ~ {l.duration_to}
                      </TableCell>
                      <TableCell className='whitespace-nowrap text-right tabular-nums'>
                        {l.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell className='whitespace-nowrap text-right tabular-nums font-medium'>
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
                      TOTAL
                    </TableCell>
                    <TableCell className='whitespace-nowrap text-right tabular-nums font-bold'>
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
          title='Delete Settlement'
          description={`"${settlement.title}" 정산을 삭제합니다. 모든 정산 detail이 함께 삭제됩니다.`}
        />
      </div>
      <Toaster position='top-center' />
    </AccessControl>
  );
}
