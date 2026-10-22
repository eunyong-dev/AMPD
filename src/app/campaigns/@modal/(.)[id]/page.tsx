'use client';

import { CampaignDetailView } from '@/components/campaigns/campaign-detail/campaign-detail-view';

/** 캠페인 현황에서 누르면 — 모달(layout) 안의 성과 화면. 새로고침·공유 시에는 전체 페이지 */
export default function CampaignModalPage() {
  return <CampaignDetailView inModal />;
}
