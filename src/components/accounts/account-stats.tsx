'use client';

import { BuildingIcon, TargetIcon, GamepadIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AccountStatsProps {
  totalAccounts: number;
  totalGames: number;
  totalCampaigns: number;
}

export function AccountStats({
  totalAccounts,
  totalGames,
  totalCampaigns,
}: AccountStatsProps) {
  return (
    <div className='grid gap-4 md:grid-cols-3'>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>전체 광고주</CardTitle>
          <BuildingIcon className='h-4 w-4 text-muted-foreground' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>{totalAccounts}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>전체 게임</CardTitle>
          <GamepadIcon className='h-4 w-4 text-muted-foreground' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>{totalGames}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>
            전체 활성 캠페인
          </CardTitle>
          <TargetIcon className='h-4 w-4 text-muted-foreground' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>{totalCampaigns}</div>
        </CardContent>
      </Card>
    </div>
  );
}
