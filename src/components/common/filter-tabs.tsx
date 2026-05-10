'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface FilterTabOption<T extends string> {
  value: T;
  label: string;
}

interface FilterTabsProps<T extends string> {
  value: T;
  onValueChange: (v: T) => void;
  options: FilterTabOption<T>[];
  className?: string;
}

/**
 * 페이지 상단 필터 탭 — 캠페인/광고주/템플릿 등 일관된 스타일.
 * shadcn Tabs 위에 통일된 className 을 입히는 얇은 래퍼.
 */
export function FilterTabs<T extends string>({
  value,
  onValueChange,
  options,
  className,
}: FilterTabsProps<T>) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      className={className}
    >
      <TabsList className='rounded-xl h-9'>
        {options.map((opt) => (
          <TabsTrigger
            key={opt.value}
            value={opt.value}
            className='rounded-lg text-sm px-3 py-1'
          >
            {opt.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
