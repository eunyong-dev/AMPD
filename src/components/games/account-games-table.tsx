'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { TrashIcon, MoreHorizontalIcon, Copy, Check } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import type { Game } from '@/hooks/use-game-management';
import type { UserProfile } from '@/lib/permissions';
import { getPlatformDisplay } from '@/lib/utils/platform';
import { canManageResource } from '@/lib/utils/permissions';
import { TableWrapper, TABLE_STYLES } from '@/components/common/table-wrapper';
import { DeleteConfirmationDialog } from '@/components/common/delete-confirmation-dialog';
import { GameThumbnailTooltip } from '@/components/common/game-thumbnail-tooltip';
import { useMemo } from 'react';

interface AccountGamesTableProps {
  games: Game[];
  onGameDeleted?: (gameId: string) => void;
  onDeleteGame: (gameId: string) => Promise<void>;
  currentUserProfile?: UserProfile | null;
  accountAssignedUserId?: string;
}

// 게임 테이블 행 컴포넌트 (이미지 로딩 처리)
interface GameTableRowProps {
  game: Game;
  onDeleteGame: (gameId: string) => Promise<void>;
  onGameDeleted?: (gameId: string) => void;
  handleOpenStore: (url: string) => void;
  currentUserProfile?: UserProfile | null;
  accountAssignedUserId?: string;
}

function GameTableRow({
  game,
  onDeleteGame,
  onGameDeleted,
  handleOpenStore,
  currentUserProfile,
  accountAssignedUserId,
}: GameTableRowProps) {
  const [copiedFieldId, setCopiedFieldId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // 삭제 권한 확인
  const isDeleteAllowed = canManageResource(
    currentUserProfile,
    accountAssignedUserId || ''
  );

  // game.logo_url DB 값만 사용. NULL이면 placeholder.
  // 레거시 게임은 Settings → "Refresh missing logos"로 일괄 채움.
  const imageUrl = game.logo_url || null;
  const imageLoading = false;
  const imageError = null;

  // 스토어 favicon URL 생성
  const storeFaviconUrl = useMemo(() => {
    if (!game.store_url) return null;

    if (/apps\.apple\.com|itunes\.apple\.com/i.test(game.store_url)) {
      return 'https://www.google.com/s2/favicons?domain=apps.apple.com&sz=32';
    }
    if (/play\.google\.com/i.test(game.store_url)) {
      return 'https://www.google.com/s2/favicons?domain=play.google.com&sz=32';
    }
    return null;
  }, [game.store_url]);

  const handleDeleteGame = async () => {
    // 권한 재확인 (안전을 위해)
    if (!isDeleteAllowed) {
      toast.error('You can only delete games from accounts assigned to you.');
      setShowDeleteDialog(false);
      return;
    }

    try {
      await onDeleteGame(game.id);
      toast.success('Game deleted successfully');
      onGameDeleted?.(game.id);
      setShowDeleteDialog(false);
    } catch (err) {
      toast.error(
        `Failed to delete game: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`
      );
    }
  };

  const handleCopy = (text: string, label: string, fieldId: string) => {
    if (!text || !text.trim()) return;

    navigator.clipboard
      .writeText(text.trim())
      .then(() => {
        setCopiedFieldId(fieldId);
        toast.success(`${label} copied to clipboard`);

        setTimeout(() => {
          setCopiedFieldId(null);
        }, 2000);
      })
      .catch(() => {
        toast.error('Failed to copy to clipboard');
      });
  };

  return (
    <TableRow>
      <TableCell style={{ width: '300px' }}>
        <div className='flex items-center gap-2'>
          {game.store_url && imageUrl ? (
            <GameThumbnailTooltip
              imageUrl={imageUrl}
              gameName={game.game_name || null}
              packageIdentifier={game.package_identifier || null}
              storeUrl={game.store_url}
              storeFaviconUrl={storeFaviconUrl || null}
              enableCopy={true}
            >
              <a
                href={game.store_url}
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center gap-2 flex-1 min-w-0'
              >
                {imageLoading ? (
                  <div className='w-6 h-6 rounded-lg border border-border bg-muted flex items-center justify-center animate-pulse flex-shrink-0'>
                    <span className='text-[8px] text-muted-foreground'>
                      ...
                    </span>
                  </div>
                ) : imageUrl ? (
                  <div className='w-6 h-6 rounded-lg border border-border overflow-hidden flex items-center justify-center bg-muted flex-shrink-0'>
                    <Image
                      src={imageUrl}
                      alt={game.game_name}
                      width={24}
                      height={24}
                      className='max-w-full max-h-full w-auto h-auto object-contain'
                      unoptimized
                      loading='lazy'
                    />
                  </div>
                ) : (
                  <div className='w-6 h-6 rounded-lg border border-border bg-muted flex items-center justify-center flex-shrink-0'>
                    <span className='text-[8px] text-muted-foreground'>-</span>
                  </div>
                )}
                <span className='text-sm truncate w-[180px] max-w-[180px] hover:text-primary'>
                  {game.game_name}
                </span>
              </a>
            </GameThumbnailTooltip>
          ) : (
            <>
              {imageLoading ? (
                <div className='w-6 h-6 rounded-lg border border-border bg-muted flex items-center justify-center animate-pulse flex-shrink-0'>
                  <span className='text-[8px] text-muted-foreground'>...</span>
                </div>
              ) : imageUrl ? (
                <div className='w-6 h-6 rounded-lg border border-border overflow-hidden flex items-center justify-center bg-muted flex-shrink-0'>
                  <Image
                    src={imageUrl}
                    alt={game.game_name}
                    width={24}
                    height={24}
                    className='max-w-full max-h-full w-auto h-auto object-contain'
                    onError={(e) => {
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML =
                          '<span class="text-[8px] text-muted-foreground">-</span>';
                      }
                    }}
                  />
                </div>
              ) : (
                <div className='w-6 h-6 rounded-lg border border-border bg-muted flex items-center justify-center flex-shrink-0'>
                  <span className='text-[8px] text-muted-foreground'>-</span>
                </div>
              )}
              {game.store_url ? (
                <button
                  onClick={() => handleOpenStore(game.store_url!)}
                  className='font-medium truncate text-sm text-left hover:text-primary hover:underline cursor-pointer'
                >
                  {game.game_name}
                </button>
              ) : (
                <div className='font-medium truncate text-sm'>
                  {game.game_name}
                </div>
              )}
            </>
          )}
        </div>
      </TableCell>
      <TableCell style={{ width: '120px' }}>
        <div className='text-sm'>{getPlatformDisplay(game.platform)}</div>
      </TableCell>
      <TableCell style={{ width: '250px' }}>
        <div className='relative'>
          {game.package_identifier ? (
            <>
              <div className='text-xs text-muted-foreground truncate font-mono pr-7'>
                {game.package_identifier}
              </div>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() =>
                  handleCopy(
                    game.package_identifier!,
                    'Package/Bundle ID',
                    game.id
                  )
                }
                className='absolute right-0 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted'
              >
                {copiedFieldId === game.id ? (
                  <Check className='h-3 w-3 text-green-600 dark:text-green-500' />
                ) : (
                  <Copy className='h-3 w-3 text-muted-foreground' />
                )}
              </Button>
            </>
          ) : (
            <div className='text-xs text-muted-foreground'>-</div>
          )}
        </div>
      </TableCell>
      <TableCell
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              className='flex size-8 hover:bg-muted/50'
              size='icon'
            >
              <MoreHorizontalIcon className='h-4 w-4' />
              <span className='sr-only'>Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-auto min-w-[120px]'>
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className='text-red-600 focus:text-red-600 flex items-center gap-0'
            >
              <TrashIcon className='mr-1 h-4 w-4' />
              Delete Game
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteGame}
        title={isDeleteAllowed ? 'Are you sure?' : 'Cannot Delete Game'}
        description={
          isDeleteAllowed
            ? `This action cannot be undone. This will permanently delete the game ${game.game_name} from your account.`
            : `You can only delete games from accounts assigned to you. This game ${game.game_name} is from an account assigned to another user.`
        }
        confirmLabel='Delete'
        cancelLabel='Close'
        isAllowed={isDeleteAllowed}
      />
    </TableRow>
  );
}

export function AccountGamesTable({
  games,
  onGameDeleted,
  onDeleteGame,
  currentUserProfile,
  accountAssignedUserId,
}: AccountGamesTableProps) {
  const handleOpenStore = (url: string) => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <TableWrapper>
      <div className='overflow-x-auto'>
        <Table style={{ tableLayout: 'fixed', width: '100%' }}>
          <TableHeader className={TABLE_STYLES.header}>
            <TableRow>
              <TableHead style={{ width: '300px' }}>Game Name</TableHead>
              <TableHead style={{ width: '120px' }}>Platform</TableHead>
              <TableHead style={{ width: '250px' }}>
                Package/Bundle ID
              </TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className={TABLE_STYLES.body}>
            {games.map((game) => (
              <GameTableRow
                key={game.id}
                game={game}
                onDeleteGame={onDeleteGame}
                onGameDeleted={onGameDeleted}
                handleOpenStore={handleOpenStore}
                currentUserProfile={currentUserProfile}
                accountAssignedUserId={accountAssignedUserId}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </TableWrapper>
  );
}
