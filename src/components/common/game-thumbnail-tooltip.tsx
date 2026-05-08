'use client';

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface GameThumbnailTooltipProps {
  imageUrl: string | null;
  gameName: string | null;
  packageIdentifier?: string | null;
  storeUrl: string | null;
  storeFaviconUrl?: string | null;
  children: React.ReactNode;
  enableCopy?: boolean;
}

const COPY_RESET_DELAY = 2000;

export function GameThumbnailTooltip({
  imageUrl,
  gameName,
  packageIdentifier,
  storeUrl,
  storeFaviconUrl,
  children,
  enableCopy = false,
}: GameThumbnailTooltipProps) {
  const [copiedGameName, setCopiedGameName] = useState(false);
  const [copiedPackageName, setCopiedPackageName] = useState(false);

  // 게임명 복사 핸들러
  const handleCopyGameName = useCallback(async () => {
    const gameNameToCopy = gameName || '';
    if (!gameNameToCopy) return;

    try {
      await navigator.clipboard.writeText(gameNameToCopy);
      setCopiedGameName(true);
      toast.success('게임 이름을 클립보드에 복사했습니다');
      setTimeout(() => {
        setCopiedGameName(false);
      }, COPY_RESET_DELAY);
    } catch (error) {
      toast.error('게임 이름 복사에 실패했습니다');
    }
  }, [gameName]);

  // 패키지 네임 복사 핸들러
  const handleCopyPackageName = useCallback(async () => {
    const packageNameToCopy = packageIdentifier || '';
    if (!packageNameToCopy) return;

    try {
      await navigator.clipboard.writeText(packageNameToCopy);
      setCopiedPackageName(true);
      toast.success('패키지 이름을 클립보드에 복사했습니다');
      setTimeout(() => {
        setCopiedPackageName(false);
      }, COPY_RESET_DELAY);
    } catch (error) {
      toast.error('패키지 이름 복사에 실패했습니다');
    }
  }, [packageIdentifier]);

  if (!imageUrl) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side='bottom' align='center' className='p-3 max-w-none'>
          <div className='flex flex-col gap-2 w-[256px] items-start'>
            <a
              href={storeUrl || '#'}
              target='_blank'
              rel='noopener noreferrer'
              className='w-full'
            >
              <Image
                src={imageUrl}
                alt={gameName || 'Game'}
                width={256}
                height={128}
                className='w-full h-32 object-cover rounded-md'
                unoptimized
                loading='eager'
              />
            </a>
            <div className='flex flex-col gap-1.5 w-full'>
              <div className='flex items-center gap-1.5 justify-start w-full'>
                {storeFaviconUrl && (
                  <Image
                    src={storeFaviconUrl}
                    alt='Store'
                    width={16}
                    height={16}
                    className='w-4 h-4 flex-shrink-0'
                    unoptimized
                  />
                )}
                <span className='text-sm font-medium text-left truncate flex-1 min-w-0'>
                  {gameName || 'Game'}
                </span>
                {enableCopy && gameName && (
                  <button
                    type='button'
                    className='flex-shrink-0 hover:opacity-70 transition-opacity'
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCopyGameName();
                    }}
                  >
                    {copiedGameName ? (
                      <Check className='h-3 w-3 text-green-600 dark:text-green-500' />
                    ) : (
                      <Copy className='h-3 w-3 text-muted-foreground' />
                    )}
                  </button>
                )}
              </div>
              {packageIdentifier && (
                <div className='flex items-center gap-1.5 justify-start w-full'>
                  <span className='text-xs text-muted-foreground text-left truncate flex-1 min-w-0'>
                    {packageIdentifier}
                  </span>
                  {enableCopy && (
                    <button
                      type='button'
                      className='flex-shrink-0 hover:opacity-70 transition-opacity'
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCopyPackageName();
                      }}
                    >
                      {copiedPackageName ? (
                        <Check className='h-3 w-3 text-green-600 dark:text-green-500' />
                      ) : (
                        <Copy className='h-3 w-3 text-muted-foreground' />
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
