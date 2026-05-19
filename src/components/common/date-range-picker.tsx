'use client';

import { useEffect, useState } from 'react';
import { CalendarIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type DateRange = {
  from: Date | undefined;
  to: Date | undefined;
};

export type DateRangePreset = {
  id: string;
  label: string;
  /** null 반환 시 적용하지 않음 (컨텍스트 부족 등) */
  getRange: () => DateRange | { from: Date; to: Date } | null;
};

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  presets?: DateRangePreset[];
  placeholder?: string;
  triggerClassName?: string;
  align?: 'start' | 'center' | 'end';
  numberOfMonths?: number;
  /** 작은 화면에서 텍스트 숨길지 (compact 모드) */
  hideLabelClassName?: string;
}

const formatRangeLabel = (range: DateRange | undefined, fallback: string) => {
  if (range?.from && range?.to) {
    return `${range.from.toLocaleDateString(
      'ko-KR'
    )} - ${range.to.toLocaleDateString('ko-KR')}`;
  }
  if (range?.from) {
    return `${range.from.toLocaleDateString('ko-KR')} - ...`;
  }
  return fallback;
};

export function DateRangePicker({
  value,
  onChange,
  presets = [],
  placeholder = 'Select date range',
  triggerClassName,
  align = 'start',
  numberOfMonths = 2,
  hideLabelClassName,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange | undefined>(value);

  // Popover 열릴 때 현재 value를 임시값으로 복사
  useEffect(() => {
    if (isOpen) setTempRange(value);
  }, [isOpen, value]);

  const triggerLabel = formatRangeLabel(value, placeholder);

  const handleApplyPreset = (preset: DateRangePreset) => {
    const range = preset.getRange();
    if (!range) return;
    const normalized: DateRange = {
      from: range.from ?? undefined,
      to: range.to ?? undefined,
    };
    setTempRange(normalized);
    onChange(normalized);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className={cn(
            'w-auto justify-start text-left font-normal flex-shrink-0',
            triggerClassName
          )}
        >
          <CalendarIcon
            className={cn(
              'h-4 w-4 mr-1.5',
              hideLabelClassName?.replace(':hidden', ':mr-0')
            )}
          />
          <span className={hideLabelClassName}>{triggerLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0' align={align}>
        <div className='flex'>
          {presets.length > 0 && (
            <div className='flex flex-col gap-1 p-2 border-r min-w-[140px]'>
              {presets.map((preset, idx) => {
                // null 구분자: id가 빈 문자열이거나 label === '---'면 separator
                if (preset.id === '---') {
                  return (
                    <div key={`sep-${idx}`} className='my-1 border-t' />
                  );
                }
                return (
                  <Button
                    key={preset.id}
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='justify-start h-8 px-2 text-sm font-normal'
                    onClick={() => handleApplyPreset(preset)}
                  >
                    {preset.label}
                  </Button>
                );
              })}
            </div>
          )}
          <div>
            <Calendar
              mode='range'
              selected={tempRange}
              onSelect={(range) => {
                setTempRange(range as DateRange | undefined);
              }}
              numberOfMonths={numberOfMonths}
              initialFocus
              showOutsideDays={false}
              weekStartsOn={1}
            />
            <div className='p-3 border-t flex items-center justify-between gap-2'>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='flex-1'
                onClick={() => {
                  setTempRange(undefined);
                  onChange(undefined);
                  setIsOpen(false);
                }}
              >
                Reset
              </Button>
              <Button
                type='button'
                variant='default'
                size='sm'
                className='flex-1'
                disabled={!tempRange?.from || !tempRange?.to}
                onClick={() => {
                  if (tempRange?.from && tempRange?.to) {
                    onChange(tempRange);
                    setIsOpen(false);
                  }
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
