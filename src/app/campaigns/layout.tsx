/**
 * 캠페인 레이아웃 — @modal 슬롯: 캠페인 현황에서 캠페인을 누르면 성과 화면을 모달로 (가로채기 라우트)
 */
export default function CampaignsLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
