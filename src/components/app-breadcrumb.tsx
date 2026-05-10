'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { getCampaignById } from '@/hooks/use-campaign-management';
import { createClient } from '@/utils/supabase/client';

// 정적 경로 → 한국어 표시 이름 매핑
const pathMap: Record<string, string> = {
  '/': '홈',
  '/accounts': '광고주',
  '/analytics': '분석',
  '/campaigns': '캠페인',
  '/campaigns/my': '내 캠페인',
  '/email-templates': '이메일 템플릿',
  '/team': '팀',
  '/settings': '설정',
  '/permissions': '권한',
};

export function AppBreadcrumb() {
  const pathname = usePathname();
  const [campaignName, setCampaignName] = useState<string | null>(null);
  const [invoiceNo, setInvoiceNo] = useState<string | null>(null);

  // 경로를 분할하여 breadcrumb 항목 생성
  const pathSegments = pathname.split('/').filter(Boolean);

  // /campaigns/[id] 경로인 경우 캠페인 이름 가져오기
  useEffect(() => {
    if (
      pathSegments[0] === 'campaigns' &&
      pathSegments.length === 2 &&
      pathSegments[1] &&
      pathSegments[1] !== 'all' &&
      pathSegments[1] !== 'my'
    ) {
      const campaignId = pathSegments[1];
      getCampaignById(campaignId)
        .then((campaign) => {
          if (campaign) {
            setCampaignName(campaign.name);
          }
        })
        .catch(() => {
          // 에러 발생 시 무시
        });
    } else {
      setCampaignName(null);
    }
  }, [pathname, pathSegments]);

  // /accounts/[id]/settlements/[settlementId]/invoice/[invoiceId] 인 경우 invoice_no 가져오기
  useEffect(() => {
    if (
      pathSegments[0] === 'accounts' &&
      pathSegments[2] === 'settlements' &&
      pathSegments[4] === 'invoice' &&
      pathSegments[5]
    ) {
      const invoiceId = pathSegments[5];
      const supabase = createClient();
      supabase
        .from('invoices')
        .select('invoice_no')
        .eq('id', invoiceId)
        .single()
        .then(({ data }) => {
          if (data?.invoice_no) {
            setInvoiceNo(data.invoice_no);
          }
        });
    } else {
      setInvoiceNo(null);
    }
  }, [pathname, pathSegments]);

  // 홈 페이지인 경우 breadcrumb 표시하지 않음
  if (pathname === '/') {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href='/'>홈</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {pathSegments.map((segment, index) => {
          let href = '/' + pathSegments.slice(0, index + 1).join('/');
          const isLast = index === pathSegments.length - 1;

          // 동적 경로 표시 이름 결정 — 위치(index) + segment 패턴 매칭
          let displayName = pathMap[href];
          if (!displayName) {
            const isAccountsRoute = pathSegments[0] === 'accounts';
            const isCampaignsRoute = pathSegments[0] === 'campaigns';

            // /accounts/[id] — index 1: 회사명 (URL slug)
            if (isAccountsRoute && index === 1) {
              displayName = decodeURIComponent(segment);
            }
            // /accounts/[id]/settlements — index 2
            // 실제 페이지 없으므로 광고주 상세의 정산서 탭으로 링크
            else if (
              isAccountsRoute &&
              index === 2 &&
              segment === 'settlements'
            ) {
              displayName = '정산서';
              href = `/accounts/${pathSegments[1]}?tab=settlements`;
            }
            // /accounts/[id]/settlements/[settlementId] — index 3
            else if (isAccountsRoute && index === 3) {
              displayName = '정산서 상세';
            }
            // /accounts/[id]/settlements/[settlementId]/invoice — index 4
            // (인보이스 목록 페이지는 없으므로 정산서 상세로 링크)
            else if (
              isAccountsRoute &&
              index === 4 &&
              segment === 'invoice'
            ) {
              displayName = '인보이스';
              href = `/accounts/${pathSegments[1]}/settlements/${pathSegments[3]}`;
            }
            // /accounts/[id]/settlements/[settlementId]/invoice/[invoiceId] — index 5
            else if (isAccountsRoute && index === 5 && isLast) {
              displayName = invoiceNo || segment;
            }
            // /campaigns/[id] — index 1: 캠페인 이름
            else if (isCampaignsRoute && index === 1 && isLast) {
              displayName = campaignName || segment;
            } else {
              // 그 외: 디코딩한 segment 그대로
              try {
                displayName = decodeURIComponent(segment);
              } catch {
                displayName = segment;
              }
            }
          }

          return (
            <div key={`${index}-${segment}`} className='flex items-center'>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{displayName}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={href}>{displayName}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
