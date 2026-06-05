'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, CalendarIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ChangeType = 'note' | 'cpi';

// 비고 카테고리 — 다중 선택. 선택 시 비고 앞에 [태그] 형태로 prepend.
const NOTE_CATEGORIES = ['히든퀘스트', '타임퀘스트', '기타'] as const;
type NoteCategory = (typeof NOTE_CATEGORIES)[number];

interface AddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  campaignName: string;
  /** 캠페인 타임존 (예: 'Asia/Seoul', 'UTC') — 기본 날짜 결정용 */
  timezone?: string | null;
  /** 시트 행 데이터 — 선택한 날짜의 현재 CPI 표시용 (선택) */
  rows?: Array<Record<string, unknown>>;
  /** 저장 성공 시 호출 — 시트 재조회 등에 사용 */
  onSaved?: () => void;
  /** 미리 채울 메모 */
  defaultNote?: string;
}

function todayInTz(tz: string | null | undefined): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function formatDateDisplay(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${y}/${m}/${d}`;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 행에서 Date 컬럼 키 추정
function findDateKey(row: Record<string, unknown> | undefined): string | null {
  if (!row) return null;
  for (const k of Object.keys(row)) {
    const nk = k.trim().toLowerCase();
    if (nk === 'date' || nk === '날짜') return k;
  }
  return null;
}

// 행에서 CPI 컬럼 키 추정
function findCpiKey(row: Record<string, unknown> | undefined): string | null {
  if (!row) return null;
  for (const k of Object.keys(row)) {
    if (k.trim().toLowerCase() === 'cpi') return k;
  }
  return null;
}

// 'YYYY-MM-DD' 또는 'YYYY/MM/DD ...' → 'YYYY-MM-DD'
function normalizeRowDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  const m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

export function AddNoteModal({
  isOpen,
  onClose,
  campaignId,
  campaignName,
  timezone,
  rows,
  onSaved,
  defaultNote = '',
}: AddNoteModalProps) {
  const [date, setDate] = useState<string>(() => todayInTz(timezone));
  const [type, setType] = useState<ChangeType>('note');
  const [categories, setCategories] = useState<NoteCategory[]>([]);
  const [note, setNote] = useState<string>(defaultNote);
  const [cpi, setCpi] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // 모달 열릴 때마다 초기화
  useEffect(() => {
    if (isOpen) {
      setDate(todayInTz(timezone));
      setType('note');
      setCategories([]);
      setNote(defaultNote);
      setCpi('');
    }
  }, [isOpen, timezone, defaultNote]);

  const toggleCategory = (c: NoteCategory) => {
    setCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  // 선택한 날짜의 현재 CPI 값 (rows 에서 조회)
  const currentCpi = useMemo<string | null>(() => {
    if (!rows || rows.length === 0) return null;
    const dateKey = findDateKey(rows[0]);
    const cpiKey = findCpiKey(rows[0]);
    if (!dateKey || !cpiKey) return null;
    const match = rows.find((r) => normalizeRowDate(r[dateKey]) === date);
    if (!match) return null;
    const v = match[cpiKey];
    return v === null || v === undefined || v === '' ? null : String(v);
  }, [rows, date]);

  const handleSubmit = async () => {
    // 입력 검증
    if (type === 'note' && !note.trim() && categories.length === 0) {
      toast.error('카테고리를 선택하거나 비고 내용을 입력해주세요.');
      return;
    }
    if (type === 'cpi') {
      const n = Number(cpi);
      if (!cpi.trim() || !Number.isFinite(n) || n < 0) {
        toast.error('변경할 CPI 단가를 올바르게 입력해주세요.');
        return;
      }
    }

    try {
      setSubmitting(true);
      // 카테고리 → 비고 셀 텍스트, note → 비고 셀 메모(hover)
      const payload =
        type === 'cpi'
          ? {
              date,
              type: 'cpi',
              cpi: Number(cpi),
              categories,
              note: note.trim(),
            }
          : { date, type: 'note', categories, note: note.trim() };

      const res = await fetch(`/api/campaigns/${campaignId}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '저장 실패');
      }
      toast.success(
        type === 'cpi'
          ? `CPI 단가가 변경되었습니다${
              data.old_cpi ? ` (${data.old_cpi} → $${data.new_cpi})` : ''
            }`
          : '변경 사항이 기록되었습니다.'
      );
      onSaved?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      toast.error(`저장 실패: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>변경 사항 기록</DialogTitle>
          <DialogDescription>
            <span className='text-foreground font-medium'>{campaignName}</span>{' '}
            의 daily report 시트에 변경 사항을 기록합니다.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          {/* 변경 사항 타입 — 세그먼트 토글 */}
          <div className='space-y-2'>
            <Label>변경 사항 타입</Label>
            <div className='inline-flex w-full rounded-xl border bg-muted/40 p-1'>
              <button
                type='button'
                onClick={() => setType('note')}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  type === 'note'
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                비고
              </button>
              <button
                type='button'
                onClick={() => setType('cpi')}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  type === 'cpi'
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                단가 변경 (CPI)
              </button>
            </div>
          </div>

          {/* 날짜 */}
          <div className='space-y-2'>
            <Label htmlFor='note-date'>날짜</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id='note-date'
                  variant='outline'
                  className='w-full justify-start text-left font-normal'
                >
                  <span className='flex-1 text-left'>
                    {formatDateDisplay(date)}
                  </span>
                  <CalendarIcon className='ml-auto h-4 w-4 opacity-50' />
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-auto p-0' align='start'>
                <Calendar
                  mode='single'
                  captionLayout='dropdown'
                  selected={new Date(date)}
                  onSelect={(d) => {
                    if (d) setDate(toIsoDate(d));
                  }}
                  fromYear={2020}
                  toYear={2100}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* 단가 변경 (CPI) 전용 필드 */}
          {type === 'cpi' && (
            <div className='space-y-2'>
              <Label htmlFor='note-cpi'>
                새 CPI 단가{' '}
                {currentCpi && (
                  <span className='text-xs text-muted-foreground font-normal'>
                    (현재: {currentCpi})
                  </span>
                )}
              </Label>
              <div className='relative'>
                <span className='absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground'>
                  $
                </span>
                <Input
                  id='note-cpi'
                  type='number'
                  inputMode='decimal'
                  step='0.01'
                  min='0'
                  value={cpi}
                  onChange={(e) => setCpi(e.target.value)}
                  placeholder='예: 1.30'
                  className='pl-7'
                  autoFocus
                />
              </div>
              <p className='text-xs text-muted-foreground'>
                CPI 컬럼의 해당 날짜 단가를 변경하고, 비고에 변경 이력을 자동
                기록합니다. (Cost 가 수식이면 자동 반영)
              </p>
            </div>
          )}

          {/* 카테고리 다중 선택 — 비고 앞에 [태그] 로 붙음 */}
          <div className='space-y-2'>
            <Label>
              카테고리{' '}
              <span className='text-xs text-muted-foreground font-normal'>
                (다중 선택)
              </span>
            </Label>
            <div className='flex flex-wrap gap-2'>
              {NOTE_CATEGORIES.map((c) => {
                const active = categories.includes(c);
                return (
                  <button
                    key={c}
                    type='button'
                    onClick={() => toggleCategory(c)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 비고 내용 — 셀 메모(hover note)로 기록됨 */}
          <div className='space-y-2'>
            <Label htmlFor='note-content'>
              비고 내용{' '}
              <span className='text-xs text-muted-foreground font-normal'>
                (셀 메모로 기록)
              </span>
            </Label>
            <textarea
              id='note-content'
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder='예: 히든퀘스트 完成等級120 보상 20,000젬으로 변경'
              rows={type === 'cpi' ? 3 : 5}
              className='flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y'
            />
            <p className='text-xs text-muted-foreground'>
              비고 셀에 마우스를 올리면 보이는 메모로 기록됩니다. 카테고리는 셀에
              직접 텍스트로 표시됩니다.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={onClose}
            disabled={submitting}
          >
            취소
          </Button>
          <Button type='button' onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            기록
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
