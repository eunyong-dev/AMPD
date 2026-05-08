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
      toast.error('Please add a game first before creating a campaign.');
      return false;
    }
    if (!form.name.trim()) {
      toast.error('Please enter campaign name.');
      return false;
    }
    if (!form.game_id) {
      toast.error('Please select a game.');
      return false;
    }
    if (!form.start_date) {
      toast.error('Please select start date.');
      return false;
    }
    if (!form.region) {
      toast.error('Please select region.');
      return false;
    }
    if (!form.mmp) {
      toast.error('Please select MMP.');
      return false;
    }
    if (!form.campaign_type) {
      toast.error('Please select campaign type.');
      return false;
    }
    if (
      form.end_date &&
      new Date(form.start_date) > new Date(form.end_date)
    ) {
      toast.error('End date must be after start date.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      setIsSubmitting(true);
      await onCreateCampaign({
        ...form,
        name: form.name.trim(),
        description: form.description?.trim() || null,
        jira_url: form.jira_url?.trim() || null,
        daily_report_url: form.daily_report_url?.trim() || null,
      });
      toast.success('Campaign created successfully.');
      onClose();
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : 'An error occurred while creating the campaign.';
      toast.error(`Campaign creation error: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
          <DialogDescription>
            Create a new campaign. Please fill in all required fields.
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
            Cancel
          </Button>
          <Button type='button' onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Create Campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
