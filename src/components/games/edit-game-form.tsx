'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Game, GameFormData } from '@/hooks/use-game-management';
import { PLATFORM_OPTIONS } from '@/hooks/use-game-management';

interface EditGameFormProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game | null;
  onUpdateGame: (
    gameId: string,
    gameData: Partial<GameFormData>
  ) => Promise<Game>;
  onGameUpdated?: () => void;
}

// 데이터베이스 제약조건 매핑
const PLATFORM_NORMALIZE: Record<string, string> = {
  ios: 'iOS',
  iOS: 'iOS',
  android: 'Android',
  Android: 'Android',
  both: 'Both',
  Both: 'Both',
};

interface FormState {
  game_name: string;
  platform: string;
  store_url: string;
  package_identifier: string;
  logo_url: string;
}

const emptyForm = (): FormState => ({
  game_name: '',
  platform: '',
  store_url: '',
  package_identifier: '',
  logo_url: '',
});

export function EditGameForm({
  isOpen,
  onClose,
  game,
  onUpdateGame,
  onGameUpdated,
}: EditGameFormProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && game) {
      setForm({
        game_name: game.game_name || '',
        platform: game.platform || '',
        store_url: game.store_url || '',
        package_identifier: game.package_identifier || '',
        logo_url: game.logo_url || '',
      });
    }
  }, [isOpen, game]);

  const validate = (): boolean => {
    if (!form.game_name.trim()) {
      toast.error('게임 이름을 입력해주세요.');
      return false;
    }
    if (!form.platform) {
      toast.error('플랫폼을 선택해주세요.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!game) return;
    if (!validate()) return;
    try {
      setIsSubmitting(true);
      // platform 정규화
      const normalizedPlatform =
        PLATFORM_NORMALIZE[form.platform] || form.platform;

      const payload: Partial<GameFormData> = {
        game_name: form.game_name.trim(),
        platform: normalizedPlatform,
        store_url: form.store_url.trim() || undefined,
        package_identifier: form.package_identifier.trim() || undefined,
        logo_url: form.logo_url.trim() || undefined,
      };

      await onUpdateGame(game.id, payload);
      toast.success('게임 정보가 업데이트되었습니다.');
      onGameUpdated?.();
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : '게임을 업데이트하는 중 오류가 발생했습니다.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!game) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>게임 수정</DialogTitle>
          <DialogDescription>
            게임 정보를 수정합니다. 스토어 URL을 변경하더라도 자동 새로고침은
            되지 않으니 필요한 필드를 직접 수정해주세요.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          {/* 게임 이름 + 플랫폼 */}
          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='edit-game-name'>
                게임 이름 <span className='text-red-500'>*</span>
              </Label>
              <Input
                id='edit-game-name'
                value={form.game_name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, game_name: e.target.value }))
                }
                autoComplete='off'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-game-platform'>
                플랫폼 <span className='text-red-500'>*</span>
              </Label>
              <Select
                value={
                  PLATFORM_OPTIONS.find(
                    (p) =>
                      p.value === form.platform ||
                      p.value === form.platform.toLowerCase()
                  )?.value || form.platform.toLowerCase()
                }
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, platform: v }))
                }
              >
                <SelectTrigger id='edit-game-platform'>
                  <SelectValue placeholder='플랫폼을 선택해주세요' />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Store URL */}
          <div className='space-y-2'>
            <Label htmlFor='edit-game-store-url'>스토어 URL</Label>
            <Input
              id='edit-game-store-url'
              placeholder='https://apps.apple.com/... 또는 https://play.google.com/...'
              value={form.store_url}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, store_url: e.target.value }))
              }
              autoComplete='off'
            />
          </div>

          {/* Package/Bundle ID */}
          <div className='space-y-2'>
            <Label htmlFor='edit-game-package'>
              Package/Bundle ID{' '}
              <span className='text-xs text-muted-foreground font-normal'>
                (선택)
              </span>
            </Label>
            <Input
              id='edit-game-package'
              placeholder='예: com.example.game'
              value={form.package_identifier}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  package_identifier: e.target.value,
                }))
              }
              autoComplete='off'
              className='font-mono text-sm'
            />
          </div>

          {/* Logo URL */}
          <div className='space-y-2'>
            <Label htmlFor='edit-game-logo'>
              로고 URL{' '}
              <span className='text-xs text-muted-foreground font-normal'>
                (선택)
              </span>
            </Label>
            <Input
              id='edit-game-logo'
              placeholder='https://...'
              value={form.logo_url}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, logo_url: e.target.value }))
              }
              autoComplete='off'
            />
          </div>

        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={onClose}
            disabled={isSubmitting}
          >
            취소
          </Button>
          <Button type='button' onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
