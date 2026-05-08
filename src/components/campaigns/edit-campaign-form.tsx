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
import type {
  Campaign,
  CampaignFormData,
} from '@/hooks/use-campaign-management';
import type { Game } from '@/hooks/use-game-management';
import { CampaignFormFields } from './campaign-form-fields';
import { useGameImages } from './use-game-images';

interface EditCampaignFormProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateCampaign: (
    campaignId: string,
    campaignData: Partial<CampaignFormData>
  ) => Promise<any>;
  campaign: Campaign | null;
  accountId: string;
  games: Game[];
}

const initialForm = (accountId: string): CampaignFormData => ({
  account_id: accountId,
  game_id: null,
  name: '',
  description: null,
  region: 'KR',
  mmp: 'adjust',
  campaign_type: 'CPI',
  start_date: '',
  end_date: '',
  status: 'planning',
  jira_url: null,
  daily_report_url: null,
});

export function EditCampaignForm({
  isOpen,
  onClose,
  onUpdateCampaign,
  campaign,
  accountId,
  games,
}: EditCampaignFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<CampaignFormData>(() =>
    initialForm(accountId)
  );
  const gameImages = useGameImages(games);

  useEffect(() => {
    if (isOpen && campaign) {
      setForm({
        account_id: campaign.account_id,
        game_id: campaign.game_id || null,
        name: campaign.name,
        description: campaign.description || null,
        region: campaign.region,
        mmp: campaign.mmp,
        campaign_type: campaign.campaign_type,
        start_date: campaign.start_date,
        end_date: campaign.end_date,
        status: campaign.status,
        jira_url: campaign.jira_url || null,
        daily_report_url: campaign.daily_report_url || null,
      });
    }
  }, [isOpen, campaign]);

  const validateForm = (): boolean => {
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
    if (
      form.end_date &&
      new Date(form.start_date) > new Date(form.end_date)
    ) {
      toast.error('종료일은 시작일 이후여야 합니다.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!campaign) return;
    if (!validateForm()) return;
    try {
      setIsSubmitting(true);
      await onUpdateCampaign(campaign.id, {
        game_id: form.game_id,
        name: form.name.trim(),
        description: form.description?.trim() || null,
        region: form.region,
        mmp: form.mmp,
        campaign_type: form.campaign_type,
        start_date: form.start_date,
        end_date: form.end_date || null,
        status: form.status,
        jira_url: form.jira_url?.trim() || null,
        daily_report_url: form.daily_report_url?.trim() || null,
      });
      onClose();
    } catch (error) {
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!campaign) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>캠페인 수정</DialogTitle>
          <DialogDescription>
            캠페인 정보를 업데이트합니다. 모든 필수 항목을 입력해주세요.
          </DialogDescription>
        </DialogHeader>

        <CampaignFormFields
          value={form}
          onChange={setForm}
          games={games}
          gameImages={gameImages}
          idPrefix='edit-campaign'
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
            캠페인 업데이트
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
