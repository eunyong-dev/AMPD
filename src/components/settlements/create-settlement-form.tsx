'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { ChevronDown, Loader2 } from 'lucide-react';

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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useGameInfo } from '@/hooks/use-game-info';
import {
  DateRangePicker,
  type DateRange,
  type DateRangePreset,
} from '@/components/common/date-range-picker';

export interface SettlementCampaignOption {
  id: string;
  name: string;
  game_store_url?: string | null;
  region?: string | null;
  campaign_type?: string | null;
  daily_report_url?: string | null;
  game_package_identifier?: string | null;
}

export interface SettlementFormData {
  title: string;
  campaign_ids: string[];
  period_from: string; // YYYY-MM-DD
  period_to: string; // YYYY-MM-DD
}

interface CreateSettlementFormProps {
  isOpen: boolean;
  onClose: () => void;
  campaigns: SettlementCampaignOption[];
  onCreate?: (data: SettlementFormData) => Promise<void> | void;
  /** 외부에서 제어하는 제출 중 상태 (예: hook의 creating). 있으면 우선 적용 */
  submitting?: boolean;
}

// 캠페인 항목 (게임 아이콘 + 이름) — useGameInfo로 logo_url 캐시
function CampaignCheckboxItem({
  campaign,
  checked,
  onToggle,
}: {
  campaign: SettlementCampaignOption;
  checked: boolean;
  onToggle: () => void;
}) {
  const { data: gameInfo } = useGameInfo(campaign.game_store_url ?? null);
  const logoUrl = gameInfo?.logo_url ?? null;

  return (
    <DropdownMenuCheckboxItem
      checked={checked}
      onCheckedChange={onToggle}
      onSelect={(e) => e.preventDefault()}
      className='pl-8 pr-2 gap-2'
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt=''
          width={20}
          height={20}
          className='h-5 w-5 rounded object-cover border border-border'
          unoptimized
        />
      ) : (
        <div className='h-5 w-5 rounded bg-muted border border-border' />
      )}
      <span className='truncate text-sm'>{campaign.name}</span>
    </DropdownMenuCheckboxItem>
  );
}

// 달력 기준 일반 프리셋 (settlement 등 외부 컨텍스트 의존 없는 프리셋)
const buildCalendarPresets = (): DateRangePreset[] => [
  {
    id: 'this-week',
    label: 'This week',
    getRange: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const day = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((day + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { from: monday, to: sunday };
    },
  },
  {
    id: 'last-week',
    label: 'Last week',
    getRange: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const day = today.getDay();
      const lastMonday = new Date(today);
      lastMonday.setDate(today.getDate() - ((day + 6) % 7) - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      return { from: lastMonday, to: lastSunday };
    },
  },
  {
    id: 'this-month',
    label: 'This month',
    getRange: () => {
      const today = new Date();
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: first, to: last };
    },
  },
  {
    id: 'last-month',
    label: 'Last month',
    getRange: () => {
      const today = new Date();
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: first, to: last };
    },
  },
];

const toIsoDate = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export function CreateSettlementForm({
  isOpen,
  onClose,
  campaigns,
  onCreate,
  submitting: externalSubmitting,
}: CreateSettlementFormProps) {
  const [title, setTitle] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [internalSubmitting, setInternalSubmitting] = useState(false);
  const submitting = externalSubmitting ?? internalSubmitting;

  const presets = useMemo(() => buildCalendarPresets(), []);

  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setSelectedIds([]);
      setRange(undefined);
      setInternalSubmitting(false);
    }
  }, [isOpen]);

  const allSelected = useMemo(
    () => campaigns.length > 0 && selectedIds.length === campaigns.length,
    [campaigns.length, selectedIds.length]
  );

  const toggleId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : campaigns.map((c) => c.id));
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error('Enter a title.');
      return;
    }
    if (selectedIds.length === 0) {
      toast.error('Select at least one campaign.');
      return;
    }
    if (!range?.from || !range?.to) {
      toast.error('Select a period (start and end).');
      return;
    }

    try {
      setInternalSubmitting(true);
      const data: SettlementFormData = {
        title: trimmedTitle,
        campaign_ids: selectedIds,
        period_from: toIsoDate(range.from),
        period_to: toIsoDate(range.to),
      };
      if (onCreate) {
        await onCreate(data);
      } else {
        toast.success('Settlement saved (UI only).');
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to save settlement: ${msg}`);
    } finally {
      setInternalSubmitting(false);
    }
  };

  const triggerLabel =
    selectedIds.length === 0
      ? 'Select campaigns'
      : `${selectedIds.length} campaign${selectedIds.length > 1 ? 's' : ''} selected`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>Add Settlement</DialogTitle>
          <DialogDescription>
            Select the campaigns and the period this settlement covers.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {/* Title */}
          <div className='space-y-2'>
            <Label htmlFor='settlement-title'>Title *</Label>
            <Input
              id='settlement-title'
              placeholder='e.g. 2026-04 Hello Games'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>

          {/* Period */}
          <div className='space-y-2'>
            <Label>Period *</Label>
            <DateRangePicker
              value={range}
              onChange={setRange}
              presets={presets}
              placeholder='Select period'
              triggerClassName='w-full'
            />
          </div>

          {/* Campaigns */}
          <div className='space-y-2'>
            <Label>Campaigns *</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type='button'
                  variant='outline'
                  className='w-full justify-between font-normal'
                  disabled={campaigns.length === 0}
                >
                  <span
                    className={
                      selectedIds.length === 0
                        ? 'text-muted-foreground'
                        : ''
                    }
                  >
                    {campaigns.length === 0
                      ? 'No campaigns in this account'
                      : triggerLabel}
                  </span>
                  <ChevronDown className='h-4 w-4 opacity-50' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align='start'
                className='w-[var(--radix-dropdown-menu-trigger-width)] max-h-[300px] overflow-y-auto'
              >
                {campaigns.length > 0 && (
                  <>
                    <DropdownMenuLabel className='flex items-center justify-between'>
                      <span className='text-xs text-muted-foreground'>
                        {selectedIds.length} / {campaigns.length}
                      </span>
                      <button
                        type='button'
                        className='text-xs text-muted-foreground hover:text-foreground'
                        onClick={toggleAll}
                      >
                        {allSelected ? 'Clear all' : 'Select all'}
                      </button>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                  </>
                )}
                {campaigns.map((c) => (
                  <CampaignCheckboxItem
                    key={c.id}
                    campaign={c}
                    checked={selectedIds.includes(c.id)}
                    onToggle={() => toggleId(c.id)}
                  />
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={onClose}
            disabled={submitting}
            size='sm'
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={submitting} size='sm'>
            {submitting ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Creating...
              </>
            ) : (
              'Create'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
