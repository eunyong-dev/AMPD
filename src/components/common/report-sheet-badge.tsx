import { FileSpreadsheet } from 'lucide-react';

/**
 * 리포트 시트 연동 표시 — 캠페인명 앞에 작은 시트 아이콘 (연동: 초록 / 미연동: 회색).
 * 별도 클릭 동작 없음 (내부 캠페인 테이블 · 공개 캠페인 현황 공통).
 */
export function ReportSheetBadge({ connected }: { connected: boolean }) {
  const label = connected ? '리포트 연동됨' : '리포트 미연동';
  return (
    <span
      role='img'
      aria-label={label}
      title={label}
      className={`inline-flex flex-shrink-0 items-center ${
        connected
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-gray-300 dark:text-gray-600'
      }`}
    >
      <FileSpreadsheet aria-hidden className='h-3.5 w-3.5' />
    </span>
  );
}
