/**
 * 캠페인 관리 훅
 */

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { logSupabaseError } from '@/lib/utils/error-handler';

export interface Campaign {
  id: string;
  account_id: string;
  game_id: string | null;
  name: string;
  description: string | null;
  region: string;
  mmp: string;
  campaign_type: string;
  start_date: string;
  end_date: string | null;
  status: string;
  jira_url: string | null;
  daily_report_url: string | null;
  regional_game_name: string | null;
  timezone: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  // 조인된 데이터
  game_name?: string;
  game_store_url?: string | null;
  game_package_identifier?: string | null;
  game_logo_url?: string | null;
  account_company?: string;
  assigned_user_id?: string;
  assigned_user_name?: string;
  assigned_user_avatar_url?: string | null;
}

export interface CampaignFormData {
  account_id: string;
  game_id: string | null;
  name: string;
  description?: string | null;
  region: string;
  mmp: string;
  campaign_type: string;
  start_date: string;
  end_date: string | null;
  status: string;
  jira_url?: string | null;
  daily_report_url?: string | null;
  regional_game_name?: string | null;
  timezone?: string | null;
}

export {
  CAMPAIGN_STATUS_OPTIONS,
  CAMPAIGN_TYPE_OPTIONS,
  MMP_OPTIONS,
  REGION_OPTIONS,
} from '@/constants/campaigns';

// 단일 캠페인 조회
export async function getCampaignById(
  campaignId: string
): Promise<Campaign | null> {
  try {
    const supabase = createClient();

    if (!campaignId) {
      console.error('캠페인 ID가 없습니다');
      return null;
    }

    const { data, error } = await supabase
      .from('campaigns')
      .select(
        `
        *,
        games(
          id,
          game_name,
          store_url,
          package_identifier,
          logo_url,
          account_id,
          accounts(
            id,
            company,
            assigned_user_id,
            user_profiles!assigned_user_id(
              display_name,
              avatar_url
            )
          )
        )
      `
      )
      .eq('id', campaignId)
      .single();

    if (error) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return null;
      }
      console.error('캠페인 조회 오류:', error, 'id:', campaignId);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      ...data,
      game_name: (data.games as any)?.game_name || null,
      game_store_url: (data.games as any)?.store_url || null,
      game_package_identifier: (data.games as any)?.package_identifier || null,
      game_logo_url: (data.games as any)?.logo_url || null,
      account_company: (data.games as any)?.accounts?.company || null,
      assigned_user_id: (data.games as any)?.accounts?.assigned_user_id || null,
      assigned_user_name:
        (data.games as any)?.accounts?.user_profiles?.display_name || null,
      assigned_user_avatar_url:
        (data.games as any)?.accounts?.user_profiles?.avatar_url || null,
    };
  } catch (err) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return null;
    }
    console.error('getCampaignById 예외:', err);
    return null;
  }
}

// 계정별 캠페인 조회
export async function getCampaignsByAccount(
  accountId: string
): Promise<Campaign[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('campaigns')
    .select(
      `
      *,
      games(
        id,
        game_name,
        store_url,
        package_identifier,
        logo_url,
        account_id,
        accounts(
          id,
          company,
          assigned_user_id,
          user_profiles!assigned_user_id(
            display_name,
            avatar_url
          )
        )
      )
    `
    )
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  if (error) {
    logSupabaseError(
      '계정별 캠페인 조회 오류:',
      error,
      '캠페인을 불러올 수 없습니다.'
    );
  }

  return data.map((campaign: any) => ({
    ...campaign,
    account_id: campaign.games?.account_id || null,
    game_name: campaign.games?.game_name || null,
    game_store_url: campaign.games?.store_url || null,
    game_package_identifier: campaign.games?.package_identifier || null,
    game_logo_url: campaign.games?.logo_url || null,
    account_company: campaign.games?.accounts?.company || null,
    assigned_user_id: campaign.games?.accounts?.assigned_user_id || null,
    assigned_user_name:
      campaign.games?.accounts?.user_profiles?.display_name || null,
    assigned_user_avatar_url:
      campaign.games?.accounts?.user_profiles?.avatar_url || null,
  }));
}

// 모든 캠페인 조회
export async function getAllCampaigns(): Promise<Campaign[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('campaigns')
    .select(
      `
      *,
      games(
        id,
        game_name,
        store_url,
        package_identifier,
        logo_url,
        account_id,
        accounts(
          id,
          company,
          assigned_user_id,
          user_profiles!assigned_user_id(
            display_name,
            avatar_url
          )
        )
      )
    `
    )
    .order('created_at', { ascending: false });

  if (error) {
    logSupabaseError(
      '모든 캠페인 조회 오류:',
      error,
      '캠페인을 불러올 수 없습니다.'
    );
  }

  return data.map((campaign: any) => ({
    ...campaign,
    account_id: campaign.games?.account_id || null,
    game_name: campaign.games?.game_name || null,
    game_store_url: campaign.games?.store_url || null,
    game_package_identifier: campaign.games?.package_identifier || null,
    game_logo_url: campaign.games?.logo_url || null,
    account_company: campaign.games?.accounts?.company || null,
    assigned_user_id: campaign.games?.accounts?.assigned_user_id || null,
    assigned_user_name:
      campaign.games?.accounts?.user_profiles?.display_name || null,
    assigned_user_avatar_url:
      campaign.games?.accounts?.user_profiles?.avatar_url || null,
  }));
}

// 내가 담당자인 캠페인 조회 (광고주의 담당자 기준)
export async function getMyCampaigns(userId: string): Promise<Campaign[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('campaigns')
    .select(
      `
      *,
      games(
        id,
        game_name,
        store_url,
        package_identifier,
        logo_url,
        account_id,
        accounts(
          id,
          company,
          assigned_user_id,
          user_profiles!assigned_user_id(
            display_name,
            avatar_url
          )
        )
      )
    `
    )
    .order('created_at', { ascending: false });

  if (error) {
    logSupabaseError(
      '내 캠페인 조회 오류:',
      error,
      '캠페인을 불러올 수 없습니다.'
    );
  }

  return data
    .map((campaign: any) => ({
      ...campaign,
      account_id: campaign.games?.account_id || null,
      game_name: campaign.games?.game_name || null,
      game_store_url: campaign.games?.store_url || null,
      game_package_identifier: campaign.games?.package_identifier || null,
      game_logo_url: campaign.games?.logo_url || null,
      account_company: campaign.games?.accounts?.company || null,
      assigned_user_id: campaign.games?.accounts?.assigned_user_id || null,
      assigned_user_name:
        campaign.games?.accounts?.user_profiles?.display_name || null,
      assigned_user_avatar_url:
        campaign.games?.accounts?.user_profiles?.avatar_url || null,
    }))
    .filter((c: Campaign) => c.assigned_user_id === userId);
}

// 캠페인 생성
export async function createCampaign(
  campaignData: CampaignFormData
): Promise<Campaign> {
  const supabase = createClient();

  // 현재 사용자 ID 가져오기
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('사용자 인증 오류:', userError);
    throw new Error('사용자 인증이 필요합니다.');
  }

  const insertPayload: any = {
    ...campaignData,
    end_date: campaignData.end_date ?? undefined,
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from('campaigns')
    .insert(insertPayload)
    .select(
      `
      *,
      games(
        id,
        game_name,
        store_url,
        package_identifier,
        logo_url,
        account_id,
        accounts(
          id,
          company,
          assigned_user_id,
          user_profiles!assigned_user_id(
            display_name,
            avatar_url
          )
        )
      )
    `
    )
    .single();

  if (error) {
    // 에러 객체를 any로 캐스팅하여 속성 접근
    const errorAny = error as any;

    // 에러 정보 추출
    const errorMessage =
      errorAny.message ||
      errorAny.details ||
      errorAny.hint ||
      errorAny.code ||
      '알 수 없는 오류';

    console.error('캠페인 생성 오류 발생');
    console.error('에러 메시지:', errorMessage);
    console.error('에러 코드:', errorAny.code);
    console.error('에러 상세:', errorAny.details);
    console.error('에러 힌트:', errorAny.hint);
    console.error('전체 에러 객체:', error);
    console.error('에러 객체 타입:', typeof error);
    console.error('에러 객체 키:', Object.keys(error || {}));
    console.error('캠페인 데이터:', JSON.stringify(campaignData, null, 2));

    // 중복 이름 오류 처리
    if (errorAny.code === '23505') {
      throw new Error('동일한 계정에 같은 이름의 캠페인이 이미 존재합니다.');
    }

    throw new Error(errorMessage);
  }

  return {
    ...data,
    game_name: (data.games as any)?.game_name || null,
    game_store_url: (data.games as any)?.store_url || null,
    game_package_identifier: (data.games as any)?.package_identifier || null,
    account_company: (data.games as any)?.accounts?.company || null,
    assigned_user_id: (data.games as any)?.accounts?.assigned_user_id || null,
    assigned_user_name:
      (data.games as any)?.accounts?.user_profiles?.display_name || null,
    assigned_user_avatar_url:
      (data.games as any)?.accounts?.user_profiles?.avatar_url || null,
  };
}

// 캠페인 수정
export async function updateCampaign(
  campaignId: string,
  campaignData: Partial<CampaignFormData>
): Promise<Campaign> {
  const supabase = createClient();
  const updatePayload: any = {
    ...campaignData,
    end_date:
      campaignData.end_date === null ? undefined : campaignData.end_date,
  };

  const { data, error } = await supabase
    .from('campaigns')
    .update(updatePayload)
    .eq('id', campaignId)
    .select(
      `
      *,
      games(
        id,
        game_name,
        store_url,
        package_identifier,
        logo_url,
        account_id,
        accounts(
          id,
          company,
          assigned_user_id,
          user_profiles!assigned_user_id(
            display_name,
            avatar_url
          )
        )
      )
    `
    )
    .single();

  if (error) {
    console.error('캠페인 수정 오류:', error);
    throw new Error('캠페인을 수정할 수 없습니다.');
  }

  return {
    ...data,
    game_name: (data.games as any)?.game_name || null,
    game_store_url: (data.games as any)?.store_url || null,
    game_package_identifier: (data.games as any)?.package_identifier || null,
    account_company: (data.games as any)?.accounts?.company || null,
    assigned_user_id: (data.games as any)?.accounts?.assigned_user_id || null,
    assigned_user_name:
      (data.games as any)?.accounts?.user_profiles?.display_name || null,
    assigned_user_avatar_url:
      (data.games as any)?.accounts?.user_profiles?.avatar_url || null,
  };
}

// 캠페인 삭제
export async function deleteCampaign(campaignId: string): Promise<void> {
  const supabase = createClient();
  // .select()로 실제 삭제된 행을 받아 RLS로 인한 silent skip을 감지
  const { data, error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', campaignId)
    .select('id');

  if (error) {
    const errAny = error as any;
    console.error('캠페인 삭제 오류:', error);

    // FK 제약 위반 — 정산서가 이 캠페인을 참조하고 있음
    if (errAny.code === '23503') {
      throw new Error(
        '이 캠페인을 참조하는 정산서가 있어 삭제할 수 없습니다. 먼저 관련 정산서를 삭제하세요.'
      );
    }
    // 그 외는 supabase 메시지 그대로 노출
    throw new Error(
      errAny.message || errAny.details || '캠페인을 삭제할 수 없습니다.'
    );
  }

  // RLS로 인해 에러 없이 0건 삭제되는 경우 감지
  if (!data || data.length === 0) {
    throw new Error(
      '캠페인 삭제 권한이 없거나 캠페인을 찾을 수 없습니다. (Permission denied or not found)'
    );
  }
}

export function useCampaignManagement(accountId?: string) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 캠페인 목록 로드
  const loadCampaigns = async () => {
    if (!accountId) return;

    try {
      setLoading(true);
      setError(null);
      const campaignData = await getCampaignsByAccount(accountId);
      setCampaigns(campaignData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '캠페인을 불러올 수 없습니다.'
      );
    } finally {
      setLoading(false);
    }
  };

  // 새 캠페인 추가
  const addCampaign = async (campaignData: CampaignFormData) => {
    try {
      const newCampaign = await createCampaign(campaignData);
      // 즉시 optimistic 추가 (UI 반응성)
      setCampaigns((prevCampaigns) => [newCampaign, ...prevCampaigns]);
      // 백그라운드로 list 재조회 — INSERT().select() join이 logo_url 등을
      // 누락하는 케이스가 있어 정확한 데이터로 동기화
      loadCampaigns();
      return newCampaign;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '캠페인을 생성할 수 없습니다.'
      );
      throw err;
    }
  };

  // 캠페인 수정
  const updateCampaignData = async (
    campaignId: string,
    campaignData: Partial<CampaignFormData>
  ) => {
    try {
      const updatedCampaign = await updateCampaign(campaignId, campaignData);
      setCampaigns((prevCampaigns) =>
        prevCampaigns.map((campaign) =>
          campaign.id === campaignId ? updatedCampaign : campaign
        )
      );
      // join 데이터 누락 케이스 대비 — 백그라운드 동기화
      loadCampaigns();
      toast.success('캠페인이 업데이트되었습니다.');
      return updatedCampaign;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '캠페인을 수정할 수 없습니다.';
      setError(errorMessage);
      toast.error(`캠페인 업데이트 실패: ${errorMessage}`);
      throw err;
    }
  };

  // 캠페인 삭제
  const removeCampaign = async (campaignId: string) => {
    try {
      await deleteCampaign(campaignId);
      setCampaigns((prevCampaigns) =>
        prevCampaigns.filter((campaign) => campaign.id !== campaignId)
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '캠페인을 삭제할 수 없습니다.'
      );
      throw err;
    }
  };

  // 계정 ID가 변경될 때마다 캠페인 로드
  useEffect(() => {
    loadCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  return {
    campaigns,
    loading,
    error,
    loadCampaigns,
    addCampaign,
    updateCampaign: updateCampaignData,
    removeCampaign,
  };
}
