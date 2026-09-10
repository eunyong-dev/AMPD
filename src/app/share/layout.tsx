import type { Metadata } from 'next';

// 공유(비로그인) 페이지 — 검색엔진 색인 방지
export const metadata: Metadata = {
  title: 'AMPD · 캠페인 현황',
  robots: { index: false, follow: false },
};

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
