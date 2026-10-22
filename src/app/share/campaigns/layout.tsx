/**
 * 공개 캠페인 레이아웃 — @modal 슬롯: 공개 캠페인 현황에서 누르면 성과 화면을 모달로
 */
export default function SharedCampaignsLayout({
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
