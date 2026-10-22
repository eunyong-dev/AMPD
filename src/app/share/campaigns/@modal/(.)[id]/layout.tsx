'use client';

import { useParams } from 'next/navigation';
import { CampaignModalShell } from '@/components/campaigns/campaign-detail/campaign-modal-shell';

/** 공개 캠페인 현황 → 공개 성과 모달 */
export default function SharedCampaignModalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ id: string }>();
  return (
    <CampaignModalShell fullPageHref={`/share/campaigns/${params?.id}`}>
      {children}
    </CampaignModalShell>
  );
}
