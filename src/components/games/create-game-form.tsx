'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Loader2, LoaderCircle, Copy, Check } from 'lucide-react';
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
import type { GameFormData } from '@/hooks/use-game-management';
import { PLATFORM_OPTIONS } from '@/hooks/use-game-management';

// 상수 정의
const DEBOUNCE_DELAY = 1000; // URL 입력 debounce 시간
const COPY_RESET_DELAY = 2000; // 복사 버튼 아이콘 리셋 시간

// 플랫폼 값 매핑 (데이터베이스 제약조건에 맞게 변환)
const PLATFORM_MAP: Record<string, string> = {
  ios: 'iOS',
  android: 'Android',
  both: 'Both',
};

interface CreateGameFormProps {
  isOpen: boolean;
  onClose: () => void;
  onGameCreated?: () => void;
  onCreateGame: (gameData: GameFormData) => Promise<any>;
  accountId?: string;
}

type UrlType = 'app_store' | 'google_play';
type Platform = 'ios' | 'android' | 'both';

// 복사 버튼 컴포넌트
interface CopyButtonProps {
  text: string;
  label: string;
  fieldId: string;
  copiedFieldId: string | null;
  onCopy: (text: string, label: string, fieldId: string) => void;
}

const CopyButton = ({
  text,
  label,
  fieldId,
  copiedFieldId,
  onCopy,
}: CopyButtonProps) => {
  if (!text || !text.trim()) return null;

  return (
    <Button
      type='button'
      variant='ghost'
      size='sm'
      onClick={() => onCopy(text, label, fieldId)}
      className='absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted'
    >
      {copiedFieldId === fieldId ? (
        <Check className='h-3 w-3 text-green-600 dark:text-green-500' />
      ) : (
        <Copy className='h-3 w-3 text-muted-foreground' />
      )}
    </Button>
  );
};

// 게임 정보 필드 컴포넌트 (Game Name, Bundle ID, Package Name)
interface GameInfoFieldProps {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  logoUrl?: string;
  isFetching?: boolean;
  copiedFieldId: string | null;
  onCopy: (text: string, label: string, fieldId: string) => void;
  showCopy?: boolean;
}

const GameInfoField = ({
  id,
  label,
  value,
  placeholder = 'Enter URL to auto-fill',
  logoUrl,
  isFetching = false,
  copiedFieldId,
  onCopy,
  showCopy = true,
}: GameInfoFieldProps) => {
  const hasValue = !!value;
  const showSpinner = isFetching && !hasValue;

  return (
    <div className='space-y-2'>
      <Label htmlFor={id}>{label}</Label>
      <div className='relative'>
        {logoUrl && logoUrl.trim().length > 0 && id === 'game_name' && (
          <div className='absolute left-2 top-1/2 -translate-y-1/2 z-10 flex items-center'>
            <Image
              src={logoUrl}
              alt={value || 'Game logo'}
              width={24}
              height={24}
              className='w-6 h-6 rounded-lg object-cover border border-border'
              onError={(e) => {
                e.currentTarget.parentElement!.style.display = 'none';
              }}
              unoptimized
            />
          </div>
        )}
        <Input
          id={id}
          placeholder={placeholder}
          value={value || ''}
          disabled
          autoComplete='off'
          className={
            logoUrl && id === 'game_name'
              ? 'pl-10 pr-7'
              : hasValue && showCopy
              ? 'pr-7'
              : 'pr-0'
          }
        />
        {showCopy && hasValue && (
          <CopyButton
            text={value}
            label={label}
            fieldId={id}
            copiedFieldId={copiedFieldId}
            onCopy={onCopy}
          />
        )}
        {showSpinner && (
          <div className='absolute right-3 top-1/2 -translate-y-1/2'>
            <LoaderCircle className='h-4 w-4 animate-spin text-muted-foreground' />
          </div>
        )}
      </div>
    </div>
  );
};

// URL 입력 필드 컴포넌트
interface UrlInputFieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  urlType: UrlType;
  isFetching: boolean;
  onUrlChange: (url: string, urlType: UrlType) => void;
  onFetchClick: () => void;
  detectPlatform: (url: string) => 'app_store' | 'google_play' | null;
}

const UrlInputField = ({
  id,
  label,
  placeholder,
  value,
  urlType,
  isFetching,
  onUrlChange,
  onFetchClick,
  detectPlatform,
}: UrlInputFieldProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    const detectedType = detectPlatform(url);

    // 잘못된 URL 입력 감지 및 예외처리
    if (url && detectedType) {
      if (urlType === 'app_store' && detectedType === 'google_play') {
        toast.warning(
          'This URL is for Google Play. Please enter an App Store URL.'
        );
        return;
      }
      if (urlType === 'google_play' && detectedType === 'app_store') {
        toast.warning(
          'This URL is for App Store. Please enter a Google Play URL.'
        );
        return;
      }
    }

    onUrlChange(url, urlType);
  };

  return (
    <div className='space-y-2'>
      <Label htmlFor={id}>{label}</Label>
      <div className='relative'>
        <Input
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          className='pr-24'
          autoComplete='off'
        />
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={onFetchClick}
          disabled={!value || isFetching}
          className='absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-xs'
        >
          {isFetching ? <Loader2 className='h-3 w-3 animate-spin' /> : 'Fetch'}
        </Button>
      </div>
    </div>
  );
};

export function CreateGameForm({
  isOpen,
  onClose,
  onGameCreated,
  onCreateGame,
  accountId,
}: CreateGameFormProps) {
  const [newGame, setNewGame] = useState<
    GameFormData & {
      logo_url?: string;
      app_store_url?: string;
      google_play_url?: string;
      bundle_id?: string;
      package_name?: string;
    }
  >({
    account_id: accountId || '',
    game_name: '',
    platform: '',
    store_url: '',
    package_identifier: '',
    logo_url: '',
    app_store_url: '',
    google_play_url: '',
    bundle_id: '',
    package_name: '',
  });

  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [copiedFieldId, setCopiedFieldId] = useState<string | null>(null);

  // URL에서 게임 정보 가져오기
  const fetchGameInfo = useCallback(async (url: string, urlType: UrlType) => {
    if (!url || !url.trim()) return;

    setIsFetchingInfo(true);
    try {
      const response = await fetch('/api/fetch-game-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch game info');
      }

      const result = await response.json();
      const gameInfo = result.data || {};

      // 게임 정보 업데이트
      const updates: Partial<typeof newGame> = {};

      if (gameInfo.game_name) {
        updates.game_name = gameInfo.game_name;
      }
      if (gameInfo.logo_url) {
        updates.logo_url = gameInfo.logo_url;
      }

      // URL 타입에 따라 적절한 필드에 저장
      if (gameInfo.package_identifier) {
        if (urlType === 'app_store') {
          updates.bundle_id = gameInfo.package_identifier;
        } else if (urlType === 'google_play') {
          updates.package_name = gameInfo.package_identifier;
        }
      }

      setNewGame((prev) => ({ ...prev, ...updates }));

      // 정보가 하나라도 가져온 경우에만 성공 토스트 표시
      if (gameInfo.game_name) {
        toast.success('Game information fetched successfully');
      } else {
        toast.warning(
          'Could not extract game information from URL. Please check the URL or enter manually.'
        );
      }
    } catch (error) {
      toast.error('Failed to fetch game information');
    } finally {
      setIsFetchingInfo(false);
    }
  }, []);

  // URL에서 플랫폼 자동 감지
  const detectPlatformFromUrl = useCallback(
    (url: string): 'app_store' | 'google_play' | null => {
      if (!url || !url.trim()) return null;
      if (url.includes('apps.apple.com')) return 'app_store';
      if (url.includes('play.google.com')) return 'google_play';
      return null;
    },
    []
  );

  // URL 변경 핸들러
  const handleUrlChange = useCallback(
    (url: string, urlType: UrlType) => {
      // 이전 timeout 취소
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      const trimmedUrl = url?.trim() || '';
      if (!trimmedUrl) {
        // 빈 URL인 경우 상태만 업데이트
        if (urlType === 'app_store') {
          setNewGame((prev) => ({ ...prev, app_store_url: '' }));
        } else {
          setNewGame((prev) => ({ ...prev, google_play_url: '' }));
        }
        return;
      }

      const detectedType = detectPlatformFromUrl(trimmedUrl);

      // URL 타입과 감지된 타입이 일치하지 않으면 플랫폼 자동 업데이트
      if (detectedType && detectedType !== urlType) {
        const platformName =
          detectedType === 'app_store'
            ? 'App Store (iOS)'
            : 'Google Play (Android)';
        const formName = urlType === 'app_store' ? 'App Store' : 'Google Play';

        toast.warning(
          `The URL you entered is for ${platformName}, but the form is set for ${formName}. Platform will be automatically updated.`
        );

        // 플랫폼 자동 업데이트
        const updates: Partial<typeof newGame> = {
          platform: detectedType === 'app_store' ? 'ios' : 'android',
        };

        if (detectedType === 'app_store') {
          updates.app_store_url = trimmedUrl;
          updates.google_play_url = '';
        } else {
          updates.google_play_url = trimmedUrl;
          updates.app_store_url = '';
        }

        setNewGame((prev) => ({ ...prev, ...updates }));

        // 자동으로 정보 가져오기
        fetchTimeoutRef.current = setTimeout(() => {
          fetchGameInfo(trimmedUrl, detectedType);
        }, DEBOUNCE_DELAY);
        return;
      }

      // URL 상태 업데이트
      if (urlType === 'app_store') {
        setNewGame((prev) => ({ ...prev, app_store_url: trimmedUrl }));
      } else {
        setNewGame((prev) => ({ ...prev, google_play_url: trimmedUrl }));
      }

      // 유효한 URL인 경우 자동으로 정보 가져오기
      const isValidUrl =
        (urlType === 'app_store' && trimmedUrl.includes('apps.apple.com')) ||
        (urlType === 'google_play' && trimmedUrl.includes('play.google.com'));

      if (isValidUrl) {
        fetchTimeoutRef.current = setTimeout(() => {
          fetchGameInfo(trimmedUrl, urlType);
        }, DEBOUNCE_DELAY);
      }
    },
    [fetchGameInfo, detectPlatformFromUrl]
  );

  // 복사 기능
  const handleCopy = useCallback(
    (text: string, label: string, fieldId: string) => {
      if (!text || !text.trim()) return;

      navigator.clipboard
        .writeText(text.trim())
        .then(() => {
          setCopiedFieldId(fieldId);
          toast.success(`${label} copied to clipboard`);

          setTimeout(() => {
            setCopiedFieldId(null);
          }, COPY_RESET_DELAY);
        })
        .catch(() => {
          toast.error('Failed to copy to clipboard');
        });
    },
    []
  );

  // 폼 리셋
  const resetForm = useCallback(() => {
    setNewGame({
      account_id: accountId || '',
      game_name: '',
      platform: '',
      store_url: '',
      package_identifier: '',
      logo_url: '',
      app_store_url: '',
      google_play_url: '',
      bundle_id: '',
      package_name: '',
    });
    setCopiedFieldId(null);
  }, [accountId]);

  // 폼이 열릴 때 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  // cleanup: 컴포넌트 언마운트 시 timeout 정리
  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  // 폼 검증
  const validateForm = useCallback(() => {
    const errors: string[] = [];

    if (!accountId) {
      errors.push('Account ID is required');
    }
    if (!newGame.platform) {
      errors.push('Platform is required');
    }

    // URL이 입력되었는지 확인
    const hasUrl =
      (newGame.platform === 'ios' && newGame.app_store_url) ||
      (newGame.platform === 'android' && newGame.google_play_url) ||
      (newGame.platform === 'both' &&
        (newGame.app_store_url || newGame.google_play_url));

    if (!hasUrl) {
      errors.push('Please enter at least one store URL.');
    }

    if (!newGame.game_name || !newGame.game_name.trim()) {
      errors.push(
        'Game name is required. Please wait for the URL to fetch game information or enter a URL.'
      );
    }

    return errors;
  }, [newGame, accountId]);

  const handleCreateGame = async () => {
    const validationErrors = validateForm();

    if (validationErrors.length > 0) {
      validationErrors.forEach((error) => toast.error(error));
      return;
    }

    try {
      // UI에서는 분리된 필드를 사용하지만, 저장할 때는 통합된 필드로 변환
      const storeUrl =
        newGame.app_store_url || newGame.google_play_url || undefined;
      let packageIdentifier =
        newGame.bundle_id || newGame.package_name || undefined;
      let logoUrl = newGame.logo_url || undefined;

      // logo_url이나 package_identifier가 비어있는데 store URL이 있으면
      // submit 시점에 한 번 더 fetch — 사용자가 fetch 완료 전 클릭한 경우 대비
      if (storeUrl && (!logoUrl || !packageIdentifier)) {
        try {
          const res = await fetch('/api/fetch-game-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: storeUrl }),
          });
          if (res.ok) {
            const json = await res.json();
            const info = json?.data ?? {};
            if (!logoUrl && info.logo_url) logoUrl = info.logo_url;
            if (!packageIdentifier && info.package_identifier) {
              packageIdentifier = info.package_identifier;
            }
          }
        } catch {
          // fetch 실패해도 캠페인 생성은 진행
        }
      }

      // 플랫폼 값을 데이터베이스 제약조건에 맞게 변환
      const platform = PLATFORM_MAP[newGame.platform] || newGame.platform;

      const gameData: GameFormData = {
        account_id: accountId!,
        game_name: newGame.game_name.trim(),
        platform: platform,
        store_url: storeUrl || undefined,
        package_identifier: packageIdentifier || undefined,
        logo_url: logoUrl,
      };

      await onCreateGame(gameData);

      toast.success('Game created successfully');
      resetForm();
      onGameCreated?.();
      onClose();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create game';
      toast.error(errorMessage);
    }
  };

  // 플랫폼별 URL 입력 필드 렌더링
  const renderUrlInputs = () => {
    if (newGame.platform === 'ios') {
      return (
        <UrlInputField
          id='app_store_url'
          label='App Store URL *'
          placeholder='https://apps.apple.com/...'
          value={newGame.app_store_url || ''}
          urlType='app_store'
          isFetching={isFetchingInfo}
          onUrlChange={handleUrlChange}
          onFetchClick={() =>
            newGame.app_store_url &&
            fetchGameInfo(newGame.app_store_url, 'app_store')
          }
          detectPlatform={detectPlatformFromUrl}
        />
      );
    }

    if (newGame.platform === 'android') {
      return (
        <UrlInputField
          id='google_play_url'
          label='Google Play URL *'
          placeholder='https://play.google.com/...'
          value={newGame.google_play_url || ''}
          urlType='google_play'
          isFetching={isFetchingInfo}
          onUrlChange={handleUrlChange}
          onFetchClick={() =>
            newGame.google_play_url &&
            fetchGameInfo(newGame.google_play_url, 'google_play')
          }
          detectPlatform={detectPlatformFromUrl}
        />
      );
    }

    if (newGame.platform === 'both') {
      return (
        <div className='grid gap-4 md:grid-cols-2'>
          <UrlInputField
            id='app_store_url'
            label='App Store URL'
            placeholder='https://apps.apple.com/...'
            value={newGame.app_store_url || ''}
            urlType='app_store'
            isFetching={isFetchingInfo}
            onUrlChange={handleUrlChange}
            onFetchClick={() =>
              newGame.app_store_url &&
              fetchGameInfo(newGame.app_store_url, 'app_store')
            }
            detectPlatform={detectPlatformFromUrl}
          />
          <UrlInputField
            id='google_play_url'
            label='Google Play URL'
            placeholder='https://play.google.com/...'
            value={newGame.google_play_url || ''}
            urlType='google_play'
            isFetching={isFetchingInfo}
            onUrlChange={handleUrlChange}
            onFetchClick={() =>
              newGame.google_play_url &&
              fetchGameInfo(newGame.google_play_url, 'google_play')
            }
            detectPlatform={detectPlatformFromUrl}
          />
        </div>
      );
    }

    return null;
  };

  // 플랫폼별 게임 정보 필드 렌더링
  const renderGameInfoFields = () => {
    const commonProps = {
      logoUrl: newGame.logo_url || undefined,
      isFetching: isFetchingInfo,
      copiedFieldId,
      onCopy: handleCopy,
    };

    if (newGame.platform === 'ios') {
      return (
        <div className='grid gap-4 md:grid-cols-2'>
          <GameInfoField
            id='game_name'
            label='Game Name'
            value={newGame.game_name || ''}
            {...commonProps}
          />
          <GameInfoField
            id='bundle_id'
            label='Bundle ID (Optional)'
            value={newGame.bundle_id || ''}
            {...commonProps}
          />
        </div>
      );
    }

    if (newGame.platform === 'android') {
      return (
        <div className='grid gap-4 md:grid-cols-2'>
          <GameInfoField
            id='game_name'
            label='Game Name'
            value={newGame.game_name || ''}
            {...commonProps}
          />
          <GameInfoField
            id='package_name'
            label='Package Name (Optional)'
            value={newGame.package_name || ''}
            {...commonProps}
          />
        </div>
      );
    }

    if (newGame.platform === 'both') {
      return (
        <div className='grid gap-4 md:grid-cols-3'>
          <GameInfoField
            id='game_name'
            label='Game Name'
            value={newGame.game_name || ''}
            {...commonProps}
          />
          <GameInfoField
            id='bundle_id'
            label='Bundle ID (Optional)'
            value={newGame.bundle_id || ''}
            {...commonProps}
          />
          <GameInfoField
            id='package_name'
            label='Package Name (Optional)'
            value={newGame.package_name || ''}
            {...commonProps}
          />
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Create New Game</DialogTitle>
          <DialogDescription>
            Add a new game to your account. Enter the store URL to automatically
            fetch game information.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          {/* Platform 선택 */}
          <div className='space-y-2'>
            <Label htmlFor='platform'>Platform *</Label>
            <Select
              value={newGame.platform}
              onValueChange={(value) =>
                setNewGame((prev) => ({ ...prev, platform: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder='Select platform' />
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

          {/* URL 입력 필드 */}
          {renderUrlInputs()}

          {/* 게임 정보 필드 */}
          {renderGameInfoFields()}
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={onClose} size='sm'>
            Cancel
          </Button>
          <Button onClick={handleCreateGame} size='sm'>
            Create Game
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
