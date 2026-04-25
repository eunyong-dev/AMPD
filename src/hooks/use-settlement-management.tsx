'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { Database } from '@/lib/database.types';

type SettlementRow = Database['public']['Tables']['settlements']['Row'];
type SettlementLineRow =
  Database['public']['Tables']['settlement_lines']['Row'];
type SettlementLineInsert =
  Database['public']['Tables']['settlement_lines']['Insert'];

export interface SettlementWithDetail extends SettlementRow {
  campaigns: { id: string; name: string }[];
  lines: SettlementLineRow[];
}

export interface SettlementCampaignInput {
  id: string;
  name: string;
  region: string | null;
  campaign_type: string | null;
  daily_report_url: string | null;
  game_package_identifier: string | null;
}

export interface CreateSettlementInput {
  account_id: string;
  title: string;
  period_from: string; // YYYY-MM-DD
  period_to: string; // YYYY-MM-DD
  campaigns: SettlementCampaignInput[];
}

// ── 유틸 ──────────────────────────────────────────────────────────────────

function extractSheetParams(
  url: string
): { sheetId: string; gid: string } | null {
  try {
    const sheetIdMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const gidMatch = url.match(/[#&?]gid=(\d+)/);
    if (sheetIdMatch && gidMatch) {
      return { sheetId: sheetIdMatch[1], gid: gidMatch[1] };
    }
    return null;
  } catch {
    return null;
  }
}

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (!str || str === '-') return null;
  const cleaned = str.replace(/[$,\s%]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  const str = String(val);
  const match = str.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  date.setHours(0, 0, 0, 0);
  return date;
}

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function fetchSheetRows(
  url: string
): Promise<Array<Record<string, unknown>>> {
  const params = extractSheetParams(url);
  if (!params) throw new Error('Invalid Google Sheets URL.');
  const res = await fetch(
    `/api/google-sheets?sheetId=${encodeURIComponent(
      params.sheetId
    )}&gid=${encodeURIComponent(params.gid)}`,
    { method: 'GET' }
  );
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Failed to fetch sheet (${res.status})`);
  }
  return Array.isArray(json.data) ? json.data : [];
}

// ── 핵심: 시트에서 settlement_lines 생성 ───────────────────────────────────

async function buildLinesForCampaign(
  campaign: SettlementCampaignInput,
  periodFrom: string,
  periodTo: string,
  startSortOrder: number
): Promise<Omit<SettlementLineInsert, 'settlement_id'>[]> {
  if (!campaign.daily_report_url) return [];

  const rows = await fetchSheetRows(campaign.daily_report_url);
  if (rows.length === 0) return [];

  const sample = rows[0];
  // 날짜 / CPI / Install 컬럼 자동 매칭
  const dateHeader =
    Object.keys(sample).find(
      (h) => h === '날짜' || h.toLowerCase() === 'date'
    ) ?? null;
  const cpiHeader =
    Object.keys(sample).find((h) => h.toLowerCase().trim() === 'cpi') ?? null;
  const installHeader =
    Object.keys(sample).find(
      (h) =>
        h.toLowerCase().trim() === 'install' ||
        h.toLowerCase().trim() === 'installs' ||
        h === '인스톨'
    ) ?? null;

  if (!dateHeader || !cpiHeader) return [];

  // 기간 필터 + 숫자 파싱 + 날짜 정렬
  type Filtered = { date: string; cpi: number; install: number };
  const filtered: Filtered[] = rows
    .map((row): Filtered | null => {
      const d = parseDate(row[dateHeader]);
      if (!d) return null;
      const iso = toIsoDate(d);
      if (iso < periodFrom || iso > periodTo) return null;
      const cpi = parseNum(row[cpiHeader]);
      if (cpi === null || cpi <= 0) return null;
      const install = installHeader ? parseNum(row[installHeader]) ?? 0 : 0;
      return { date: iso, cpi, install };
    })
    .filter((v): v is Filtered => v !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (filtered.length === 0) return [];

  // CPI 연속 같은 값 → 한 그룹
  type Group = { from: string; to: string; cpi: number; quantity: number };
  const groups: Group[] = [];
  for (const r of filtered) {
    const last = groups[groups.length - 1];
    if (last && last.cpi === r.cpi) {
      last.to = r.date;
      last.quantity += r.install;
    } else {
      groups.push({
        from: r.date,
        to: r.date,
        cpi: r.cpi,
        quantity: r.install,
      });
    }
  }

  return groups.map((g, idx) => ({
    campaign_id: campaign.id,
    description: campaign.game_package_identifier ?? null,
    model: campaign.campaign_type ?? 'CPI',
    rate: g.cpi,
    geo: campaign.region ?? null,
    duration_from: g.from,
    duration_to: g.to,
    quantity: g.quantity,
    amount: +(g.cpi * g.quantity).toFixed(2),
    sort_order: startSortOrder + idx,
  }));
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useSettlementManagement(accountId?: string) {
  const [settlements, setSettlements] = useState<SettlementWithDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchSettlements = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('settlements')
        .select(
          `
          *,
          settlement_campaigns ( campaign:campaigns ( id, name ) ),
          settlement_lines ( * )
          `
        )
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: SettlementWithDetail[] = (data ?? []).map((s: any) => ({
        ...s,
        campaigns: (s.settlement_campaigns ?? [])
          .map((sc: any) => sc.campaign)
          .filter(Boolean),
        lines: (s.settlement_lines ?? []).sort(
          (a: SettlementLineRow, b: SettlementLineRow) =>
            a.sort_order - b.sort_order
        ),
      }));
      setSettlements(mapped);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (accountId) {
      fetchSettlements();
    }
  }, [accountId, fetchSettlements]);

  const createSettlement = useCallback(
    async (input: CreateSettlementInput): Promise<SettlementWithDetail> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      setCreating(true);
      let createdId: string | null = null;

      try {
        // 1) 시트 fetch + CPI 그룹화 → lines 미리 생성
        const allLines: Omit<SettlementLineInsert, 'settlement_id'>[] = [];
        let sortCursor = 0;
        for (const campaign of input.campaigns) {
          const lines = await buildLinesForCampaign(
            campaign,
            input.period_from,
            input.period_to,
            sortCursor
          );
          allLines.push(...lines);
          sortCursor += lines.length;
        }

        const totalAmount = +allLines
          .reduce((sum, l) => sum + (l.amount ?? 0), 0)
          .toFixed(2);

        // 2) settlement 저장
        const { data: settlement, error: setErr } = await supabase
          .from('settlements')
          .insert({
            account_id: input.account_id,
            title: input.title,
            period_from: input.period_from,
            period_to: input.period_to,
            total_amount: totalAmount,
            created_by: user.id,
          })
          .select()
          .single();
        if (setErr) throw setErr;
        if (!settlement) throw new Error('Failed to create settlement');
        createdId = settlement.id;

        // 3) settlement_campaigns 저장
        if (input.campaigns.length > 0) {
          const { error: scErr } = await supabase
            .from('settlement_campaigns')
            .insert(
              input.campaigns.map((c) => ({
                settlement_id: settlement.id,
                campaign_id: c.id,
              }))
            );
          if (scErr) throw scErr;
        }

        // 4) settlement_lines 저장
        let insertedLines: SettlementLineRow[] = [];
        if (allLines.length > 0) {
          const linesToInsert: SettlementLineInsert[] = allLines.map((l) => ({
            ...l,
            settlement_id: settlement.id,
          }));
          const { data: linesData, error: linesErr } = await supabase
            .from('settlement_lines')
            .insert(linesToInsert)
            .select();
          if (linesErr) throw linesErr;
          insertedLines = linesData ?? [];
        }

        const newItem: SettlementWithDetail = {
          ...settlement,
          campaigns: input.campaigns.map((c) => ({
            id: c.id,
            name: c.name,
          })),
          lines: insertedLines.sort((a, b) => a.sort_order - b.sort_order),
        };
        setSettlements((prev) => [newItem, ...prev]);
        return newItem;
      } catch (err) {
        // 실패 시 settlement 삭제 → CASCADE로 자식 모두 정리
        if (createdId) {
          try {
            await supabase.from('settlements').delete().eq('id', createdId);
          } catch {
            // ignore cleanup error
          }
        }
        throw err;
      } finally {
        setCreating(false);
      }
    },
    []
  );

  const deleteSettlement = useCallback(async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from('settlements').delete().eq('id', id);
    if (error) throw error;
    setSettlements((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return {
    settlements,
    loading,
    creating,
    fetchSettlements,
    createSettlement,
    deleteSettlement,
  };
}
