'use client';

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import Image from 'next/image';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CAMPAIGN_STATUS_OPTIONS,
  CAMPAIGN_TYPE_OPTIONS,
  MMP_OPTIONS,
  REGION_OPTIONS,
} from '@/constants/campaigns';
import type { CampaignFormData } from '@/hooks/use-campaign-management';
import type { Game } from '@/hooks/use-game-management';
import { PLATFORM_OPTIONS } from '@/hooks/use-game-management';

const REGION_EMOJI: Record<string, string> = {
  KR: '🇰🇷',
  JP: '🇯🇵',
  TW: '🇹🇼',
  US: '🇺🇸',
};

const STATUS_COLOR: Record<string, string> = {
  planning: 'text-yellow-600 dark:text-yellow-500',
  ongoing: 'text-green-600 dark:text-green-500',
  holding: 'text-red-600 dark:text-red-500',
  end: 'text-gray-500 dark:text-gray-400',
};

function formatDateDisplay(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface CampaignFormFieldsProps {
  value: CampaignFormData;
  onChange: (next: CampaignFormData) => void;
  games: Game[];
  gameImages: Record<string, string | null>;
  /** create/edit 간 input id 충돌 방지용 prefix */
  idPrefix: string;
}

export function CampaignFormFields({
  value,
  onChange,
  games,
  gameImages,
  idPrefix,
}: CampaignFormFieldsProps) {
  const selectedGameImage = value.game_id ? gameImages[value.game_id] : null;
  const selectedGame = games.find((g) => g.id === value.game_id);
  const id = (suffix: string) => `${idPrefix}-${suffix}`;

  return (
    <div className='space-y-4 py-4'>
      {/* Campaign Name */}
      <div className='space-y-2'>
        <Label htmlFor={id('name')}>
          캠페인 제목 <span className='text-red-500'>*</span>
        </Label>
        <Input
          id={id('name')}
          placeholder='캠페인 제목을 입력해주세요'
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          autoComplete='off'
        />
      </div>

      {/* Game Selection */}
      <div className='space-y-2'>
        <Label htmlFor={id('game')}>
          게임 <span className='text-red-500'>*</span>
        </Label>
        <Select
          value={value.game_id || ''}
          onValueChange={(v) => onChange({ ...value, game_id: v })}
        >
          <SelectTrigger id={id('game')} className='w-full'>
            <div className='flex items-center gap-2 flex-1 w-full'>
              {selectedGameImage && (
                <Image
                  src={selectedGameImage}
                  alt={selectedGame?.game_name || 'Game'}
                  width={20}
                  height={20}
                  className='rounded-lg object-contain'
                  unoptimized
                />
              )}
              {value.game_id ? (
                <>
                  <span className='flex-1 text-left truncate'>
                    {selectedGame?.game_name || '게임을 선택해주세요'}
                  </span>
                  {(() => {
                    const platformLabel =
                      PLATFORM_OPTIONS.find(
                        (opt) => opt.value === selectedGame?.platform
                      )?.label ||
                      selectedGame?.platform ||
                      '';
                    return platformLabel ? (
                      <span className='text-xs text-muted-foreground flex-shrink-0'>
                        {platformLabel}
                      </span>
                    ) : null;
                  })()}
                </>
              ) : (
                <span className='flex-1 text-left'>게임을 선택해주세요</span>
              )}
            </div>
          </SelectTrigger>
          <SelectContent>
            {games.map((game) => {
              const platformLabel =
                PLATFORM_OPTIONS.find((opt) => opt.value === game.platform)
                  ?.label ||
                game.platform ||
                '';
              return (
                <SelectItem key={game.id} value={game.id} className='w-full'>
                  <div className='flex items-center gap-2 w-full pr-0'>
                    {gameImages[game.id] ? (
                      <Image
                        src={gameImages[game.id]!}
                        alt={game.game_name}
                        width={20}
                        height={20}
                        className='rounded-lg object-contain flex-shrink-0'
                        unoptimized
                      />
                    ) : (
                      <div className='w-5 h-5 rounded-lg bg-muted flex items-center justify-center flex-shrink-0'>
                        <span className='text-xs text-muted-foreground'>?</span>
                      </div>
                    )}
                    <span className='truncate flex-1'>{game.game_name}</span>
                    <span className='text-xs text-muted-foreground flex-shrink-0 ml-auto'>
                      {platformLabel}
                    </span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Region and MMP */}
      <div className='grid grid-cols-2 gap-4'>
        <div className='space-y-2'>
          <Label htmlFor={id('region')}>
            지역 <span className='text-red-500'>*</span>
          </Label>
          <Select
            value={value.region || undefined}
            onValueChange={(v) => onChange({ ...value, region: v })}
          >
            <SelectTrigger id={id('region')}>
              <SelectValue placeholder='지역을 선택해주세요'>
                {(() => {
                  if (!value.region) return '';
                  const opt = REGION_OPTIONS.find(
                    (o) => o.value === value.region
                  );
                  const emoji = REGION_EMOJI[value.region] || '';
                  return opt ? `${emoji} ${opt.label}` : '';
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {REGION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {REGION_EMOJI[option.value] || ''} {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-2'>
          <Label htmlFor={id('mmp')}>
            MMP <span className='text-red-500'>*</span>
          </Label>
          <Select
            value={value.mmp || undefined}
            onValueChange={(v) => onChange({ ...value, mmp: v })}
          >
            <SelectTrigger id={id('mmp')} className='w-full'>
              {value.mmp ? (
                <div className='flex items-center gap-2 flex-1'>
                  <MmpIcon mmp={value.mmp} />
                  <span className='flex-1 text-left'>
                    {MMP_OPTIONS.find((opt) => opt.value === value.mmp)?.label ||
                      'MMP를 선택해주세요'}
                  </span>
                </div>
              ) : (
                <SelectValue placeholder='MMP를 선택해주세요' />
              )}
            </SelectTrigger>
            <SelectContent>
              {MMP_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className='flex items-center gap-2'>
                    <MmpIcon mmp={option.value} />
                    <span>{option.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Campaign Type and Status */}
      <div className='grid grid-cols-2 gap-4'>
        <div className='space-y-2'>
          <Label htmlFor={id('type')}>
            캠페인 유형 <span className='text-red-500'>*</span>
          </Label>
          <Select
            value={value.campaign_type || undefined}
            onValueChange={(v) => onChange({ ...value, campaign_type: v })}
          >
            <SelectTrigger id={id('type')}>
              <SelectValue placeholder='캠페인 유형을 선택해주세요' />
            </SelectTrigger>
            <SelectContent>
              {CAMPAIGN_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-2'>
          <Label htmlFor={id('status')}>
            상태 <span className='text-red-500'>*</span>
          </Label>
          <Select
            value={value.status || undefined}
            onValueChange={(v) => onChange({ ...value, status: v })}
          >
            <SelectTrigger id={id('status')}>
              {value.status ? (
                <span className={STATUS_COLOR[value.status] || ''}>
                  {CAMPAIGN_STATUS_OPTIONS.find(
                    (opt) => opt.value === value.status
                  )?.label || '상태를 선택해주세요'}
                </span>
              ) : (
                <SelectValue placeholder='상태를 선택해주세요' />
              )}
            </SelectTrigger>
            <SelectContent>
              {CAMPAIGN_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className={STATUS_COLOR[option.value] || ''}>
                    {option.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Start Date and End Date */}
      <div className='grid grid-cols-2 gap-4'>
        <DateField
          id={id('start-date')}
          label='시작일'
          required
          value={value.start_date}
          onChange={(d) => onChange({ ...value, start_date: d ?? '' })}
          placeholder='시작일을 선택해주세요'
        />
        <DateField
          id={id('end-date')}
          label='종료일'
          value={value.end_date ?? ''}
          onChange={(d) => onChange({ ...value, end_date: d })}
          placeholder='종료일을 선택해주세요'
        />
      </div>

      {/* Jira URL */}
      <div className='space-y-2'>
        <Label htmlFor={id('jira-url')}>Jira URL</Label>
        <Input
          id={id('jira-url')}
          placeholder='https://jira.example.com/issue/XXX'
          value={value.jira_url || ''}
          onChange={(e) =>
            onChange({ ...value, jira_url: e.target.value || null })
          }
          autoComplete='off'
        />
      </div>

      {/* Daily Report URL */}
      <div className='space-y-2'>
        <Label htmlFor={id('daily-report-url')}>Daily Report URL</Label>
        <Input
          id={id('daily-report-url')}
          placeholder='https://example.com/daily-report'
          value={value.daily_report_url || ''}
          onChange={(e) =>
            onChange({ ...value, daily_report_url: e.target.value || null })
          }
          autoComplete='off'
        />
      </div>

      {/* Description */}
      <div className='space-y-2'>
        <Label htmlFor={id('description')}>설명</Label>
        <Input
          id={id('description')}
          placeholder='캠페인 설명을 입력해주세요 (선택)'
          value={value.description || ''}
          onChange={(e) =>
            onChange({ ...value, description: e.target.value || null })
          }
          autoComplete='off'
        />
      </div>
    </div>
  );
}

function MmpIcon({ mmp }: { mmp: string }) {
  if (mmp === 'Adjust') {
    return (
      <div className='flex items-center justify-center w-5 h-5'>
        <Image
          src='/Adjust Logo.svg'
          alt='Adjust'
          width={20}
          height={20}
          className='object-contain'
          unoptimized
        />
      </div>
    );
  }
  if (mmp === 'AppsFlyer') {
    return (
      <div className='flex items-center justify-center w-5 h-5'>
        <Image
          src='/AppsFlyer Logo.svg'
          alt='AppsFlyer'
          width={20}
          height={20}
          className='object-contain'
          style={{ width: 'auto', height: 'auto' }}
          unoptimized
        />
      </div>
    );
  }
  return null;
}

interface DateFieldProps {
  id: string;
  label: string;
  required?: boolean;
  value: string | null;
  onChange: (iso: string | null) => void;
  placeholder: string;
}

function DateField({
  id,
  label,
  required,
  value,
  onChange,
  placeholder,
}: DateFieldProps) {
  const display = formatDateDisplay(value);
  return (
    <div className='space-y-2'>
      <Label htmlFor={id}>
        {label} {required && <span className='text-red-500'>*</span>}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant='outline'
            className='w-full justify-start text-left font-normal'
          >
            <span className='flex-1 text-left'>{display ?? placeholder}</span>
            <CalendarIcon className='ml-auto h-4 w-4 opacity-50' />
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-auto p-0' align='start'>
          <Calendar
            mode='single'
            captionLayout='dropdown'
            selected={value ? new Date(value) : undefined}
            onSelect={(date) => {
              if (date) onChange(toIsoDate(date));
            }}
            fromYear={1900}
            toYear={2100}
            formatters={{
              formatMonthDropdown: (date) =>
                date.toLocaleString('en-US', { month: 'short' }),
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
