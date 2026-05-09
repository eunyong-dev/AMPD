'use client';

import { toast } from 'sonner';
import {
  TrashIcon,
  EditIcon,
  MoreHorizontalIcon,
  ExternalLinkIcon,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import type { Game } from '@/hooks/use-game-management';
import { getPlatformDisplay } from '@/lib/utils/platform';

interface GamesTableProps {
  games: Game[];
  selectedGames: string[];
  onSelectAll: (checked: boolean) => void;
  onSelectGame: (gameId: string, checked: boolean) => void;
  onGameDeleted?: (gameId: string) => void;
  onDeleteGame: (gameId: string) => Promise<void>;
}

export function GamesTable({
  games,
  selectedGames,
  onSelectAll,
  onSelectGame,
  onGameDeleted,
  onDeleteGame,
}: GamesTableProps) {
  const isAllSelected =
    games.length > 0 && selectedGames.length === games.length;

  const handleDeleteGame = async (gameId: string) => {
    try {
      await onDeleteGame(gameId);
      toast.success('게임이 삭제되었습니다');
      onGameDeleted?.(gameId);
    } catch (err) {
      toast.error(
        `게임 삭제 실패: ${
          err instanceof Error ? err.message : '알 수 없는 오류'
        }`
      );
    }
  };

  const handleEditGame = (gameId: string) => {
    // TODO: 게임 수정 모달 구현
    // TODO: 게임 수정 기능 구현 필요
  };

  const handleOpenStore = (url: string) => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <div className='overflow-hidden rounded-xl border'>
      <Table style={{ tableLayout: 'fixed', width: '100%' }}>
        <TableHeader className='sticky top-0 z-20 bg-muted'>
          <TableRow>
            <TableHead style={{ width: '32px' }}>
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={onSelectAll}
                aria-label='전체 선택'
              />
            </TableHead>
            <TableHead style={{ width: '200px' }}>게임명</TableHead>
            <TableHead style={{ width: '120px' }}>광고주</TableHead>
            <TableHead style={{ width: '100px' }}>플랫폼</TableHead>
            <TableHead style={{ width: '120px' }}>스토어 링크</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {games.map((game) => {
            return (
              <ContextMenu key={game.id}>
                <ContextMenuTrigger asChild>
              <TableRow>
                <TableCell style={{ width: '32px' }}>
                  <Checkbox
                    checked={selectedGames.includes(game.id)}
                    onCheckedChange={(checked) =>
                      onSelectGame(game.id, !!checked)
                    }
                    aria-label='행 선택'
                  />
                </TableCell>
                <TableCell style={{ width: '200px' }}>
                  <div className='font-medium truncate text-sm'>
                    {game.game_name}
                  </div>
                </TableCell>
                <TableCell style={{ width: '120px' }}>
                  <div className='text-sm'>
                    <div className='font-medium truncate'>
                      {game.account_company}
                    </div>
                    <div className='text-xs text-muted-foreground'>
                      {game.account_country}
                    </div>
                  </div>
                </TableCell>
                <TableCell style={{ width: '100px' }}>
                  <div className='text-sm'>
                    {getPlatformDisplay(game.platform)}
                  </div>
                </TableCell>
                <TableCell style={{ width: '120px' }}>
                  <div className='flex gap-1'>
                    {game.store_url && (
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-6 w-6 p-0'
                        onClick={() => handleOpenStore(game.store_url!)}
                      >
                        <ExternalLinkIcon className='h-3 w-3' />
                      </Button>
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
                        <span className='sr-only'>메뉴 열기</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align='end'
                      className='w-auto min-w-[120px]'
                    >
                      <DropdownMenuItem
                        onClick={() => handleEditGame(game.id)}
                        className='flex items-center gap-0'
                      >
                        <EditIcon className='mr-1 h-4 w-4' />
                        게임 수정
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteGame(game.id)}
                        className='text-red-600 focus:text-red-600 flex items-center gap-0'
                      >
                        <TrashIcon className='mr-1 h-4 w-4' />
                        게임 삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
                </ContextMenuTrigger>
                <ContextMenuContent className='w-auto min-w-[140px]'>
                  <ContextMenuItem onClick={() => handleEditGame(game.id)}>
                    <EditIcon className='mr-2 h-4 w-4' />
                    게임 수정
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => handleDeleteGame(game.id)}
                    className='text-red-600 focus:text-red-600'
                  >
                    <TrashIcon className='mr-2 h-4 w-4' />
                    게임 삭제
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
