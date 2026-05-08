'use client';

import { PlusIcon, BuildingIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  accountsLength: number;
  onCreateAccount: () => void;
  hasFilter?: boolean;
}

export function EmptyState({
  accountsLength,
  onCreateAccount,
  hasFilter = false,
}: EmptyStateProps) {
  return (
    <div className='flex flex-col items-center justify-center py-12 px-4'>
      <div className='rounded-full bg-muted p-3 mb-4'>
        <BuildingIcon className='h-8 w-8 text-muted-foreground' />
      </div>
      <h3 className='text-lg font-semibold mb-2'>광고주가 없습니다</h3>
      <p className='text-muted-foreground text-center mb-6 max-w-sm'>
        {accountsLength === 0
          ? '아직 등록된 광고주가 없습니다. 첫 광고주를 추가하여 시작해보세요.'
          : hasFilter
          ? '검색 조건에 일치하는 광고주가 없습니다. 필터를 조정해 보세요.'
          : '표시할 광고주가 없습니다.'}
      </p>
      {accountsLength === 0 && (
        <Button onClick={onCreateAccount} className='flex items-center gap-2'>
          <PlusIcon className='h-4 w-4' />
          첫 광고주 추가
        </Button>
      )}
    </div>
  );
}
