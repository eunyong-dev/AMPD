import { FileSpreadsheet } from 'lucide-react';

/**
 * 리포트 시트 연결 표시 — 시트가 연결된 캠페인만 캠페인명 옆에 작은 시트 아이콘.
 * 별도 클릭 동작 없이 캠페인명 링크 안에 들어감 (내부 캠페인 테이블 · 공개 캠페인 현황 공통).
 */
export function ReportSheetBadge({ connected }: { connected: boolean }) {
  if (!connected) return null;
  return (
    <span
      role='img'
      aria-label='리포트 연결됨'
      title='리포트 연결됨'
      className='inline-flex flex-shrink-0 items-center text-emerald-600 dark:text-emerald-400'
    >
      <FileSpreadsheet aria-hidden className='h-3.5 w-3.5' />
    </span>
  );
}
