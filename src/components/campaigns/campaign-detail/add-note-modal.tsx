'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, CalendarIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
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

interface AddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  campaignName: string;
  /** 캠페인 타임존 (예: 'Asia/Seoul', 'UTC') — 기본 날짜 결정용 */
  timezone?: string | null;
  /** 저장 성공 시 호출 — 시트 재조회 등에 사용 */
  onSaved?: () => void;
  /** 미리 채울 메모 (예: 외부에서 전달된 변경 사항) */
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

export function AddNoteModal({
  isOpen,
  onClose,
  campaignId,
  campaignName,
  timezone,
  onSaved,
  defaultNote = '',
}: AddNoteModalProps) {
  const [date, setDate] = useState<string>(() => todayInTz(timezone));
  const [note, setNote] = useState<string>(defaultNote);
  const [submitting, setSubmitting] = useState(false);

  // 모달 열릴 때마다 초기화
  useEffect(() => {
    if (isOpen) {
      setDate(todayInTz(timezone));
      setNote(defaultNote);
    }
  }, [isOpen, timezone, defaultNote]);

  const handleSubmit = async () => {
    if (!note.trim()) {
      toast.error('비고 내용을 입력해주세요.');
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch(`/api/campaigns/${campaignId}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, note: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '저장 실패');
      }
      toast.success(
        data.appended
          ? '기존 비고에 추가되었습니다.'
          : '비고가 기록되었습니다.'
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
          <DialogTitle>비고 기록</DialogTitle>
          <DialogDescription>
            <span className='text-foreground font-medium'>{campaignName}</span>{' '}
            의 daily report 시트 비고 컬럼에 메모를 기록합니다.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
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
            <p className='text-xs text-muted-foreground'>
              시트의 Date 컬럼에서 해당 날짜 행을 찾아 비고를 기록합니다.
            </p>
          </div>

          {/* 비고 내용 */}
          <div className='space-y-2'>
            <Label htmlFor='note-content'>비고 내용</Label>
            <textarea
              id='note-content'
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder='예: 히든퀘스트 完成等級120 보상 20,000젬으로 변경'
              rows={5}
              className='flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y'
              autoFocus
            />
            <p className='text-xs text-muted-foreground'>
              같은 날짜에 기존 비고가 있으면 줄바꿈으로 추가됩니다 (덮어쓰지 않음).
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
