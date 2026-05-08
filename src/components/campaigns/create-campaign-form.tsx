'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { CampaignFormData } from '@/hooks/use-campaign-management';
import type { Game } from '@/hooks/use-game-management';
import { CampaignFormFields } from './campaign-form-fields';
import { useGameImages } from './use-game-images';
import { convertStoreUrlByRegion } from '@/lib/store-url-utils';

interface CreateCampaignFormProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateCampaign: (campaignData: CampaignFormData) => Promise<any>;
  accountId: string;
  games: Game[];
}

const emptyForm = (accountId: string): CampaignFormData => ({
  account_id: accountId,
  game_id: null,
  name: '',
  description: null,
  region: '',
  mmp: '',
  campaign_type: '',
  start_date: '',
  end_date: null,
  status: '',
  jira_url: null,
  daily_report_url: null,
});

export function CreateCampaignForm({
  isOpen,
  onClose,
  onCreateCampaign,
  accountId,
  games,
}: CreateCampaignFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<CampaignFormData>(() => emptyForm(accountId));
  const gameImages = useGameImages(games);

  // 다이얼로그 열릴 때 폼 초기화
  useEffect(() => {
    if (isOpen) setForm(emptyForm(accountId));
  }, [isOpen, accountId]);

  // Game + Region 선택 시 Campaign Name 자동 생성
  useEffect(() => {
    if (!form.name.trim() && form.game_id && form.region) {
      const game = games.find((g) => g.id === form.game_id);
      if (game) {
        setForm((prev) => ({
          ...prev,
          name: `${game.game_name}_${form.region}`,
        }));
      }
    }
  }, [form.game_id, form.region, form.name, games]);

  const validateForm = (): boolean => {
    if (games.length === 0) {
      toast.error('캠페인을 생성하려면 먼저 게임을 추가해주세요.');
      return false;
    }
    if (!form.name.trim()) {
      toast.error('캠페인 제목을 입력해주세요.');
      return false;
    }
    if (!form.game_id) {
      toast.error('게임을 선택해주세요.');
      return false;
    }
    if (!form.start_date) {
      toast.error('시작일을 선택해주세요.');
      return false;
    }
    if (!form.region) {
      toast.error('지역을 선택해주세요.');
      return false;
    }
    if (!form.mmp) {
      toast.error('MMP를 선택해주세요.');
      return false;
    }
    if (!form.campaign_type) {
      toast.error('캠페인 유형을 선택해주세요.');
      return false;
    }
    if (
      form.end_date &&
      new Date(form.start_date) > new Date(form.end_date)
    ) {
      toast.error('종료일은 시작일 이후여야 합니다.');
      return false;
    }
    return true;
  };

  // 캠페인의 region에 맞는 regional_game_name을 1회 fetch
  // 실패해도 캠페인 생성은 막지 않음 (canonical game_name으로 fallback)
  const fetchRegionalGameName = async (
    storeUrl: string | null | undefined,
    region: string
  ): Promise<string | null> => {
    if (!storeUrl || !region) return null;
    const regionalUrl = convertStoreUrlByRegion(storeUrl, region);
    if (!regionalUrl) return null;
    try {
      const res = await fetch('/api/fetch-game-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: regionalUrl }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json?.data?.game_name ?? null;
    } catch {
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      setIsSubmitting(true);
      const game = games.find((g) => g.id === form.game_id);
      const regionalName = await fetchRegionalGameName(
        game?.store_url,
        form.region
      );
      await onCreateCampaign({
        ...form,
        name: form.name.trim(),
        description: form.description?.trim() || null,
        jira_url: form.jira_url?.trim() || null,
        daily_report_url: form.daily_report_url?.trim() || null,
        regional_game_name: regionalName,
      });
      toast.success('캠페인이 생성되었습니다.');
      onClose();
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : '캠페인을 생성하는 중 오류가 발생했습니다.';
      toast.error(`캠페인 생성 오류: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>새 캠페인 생성</DialogTitle>
          <DialogDescription>
            새 캠페인을 생성합니다. 모든 필수 항목을 입력해주세요.
          </DialogDescription>
        </DialogHeader>

        <CampaignFormFields
          value={form}
          onChange={setForm}
          games={games}
          gameImages={gameImages}
          idPrefix='create-campaign'
        />

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
            캠페인 생성
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
