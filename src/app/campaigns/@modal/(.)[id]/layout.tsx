'use client';

import { useParams } from 'next/navigation';
import { CampaignModalShell } from '@/components/campaigns/campaign-detail/campaign-modal-shell';

/** 내부 캠페인 현황 → 성과 모달 (layout 이라 클릭 즉시 열림) */
export default function CampaignModalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ id: string }>();
  return (
    <CampaignModalShell fullPageHref={`/campaigns/${params?.id}`}>
      {children}
    </CampaignModalShell>
  );
}
