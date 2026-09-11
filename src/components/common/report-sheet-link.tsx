'use client';

import { FileSpreadsheet } from 'lucide-react';

/**
 * 리포트 시트 바로가기 아이콘 — 시트가 연결된 캠페인만 캠페인명 옆에 표시.
 * 내부 캠페인 테이블과 공개 캠페인 현황이 공유.
 */
export function ReportSheetLink({ url }: { url: string | null | undefined }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target='_blank'
      rel='noopener noreferrer'
      title='리포트 시트 열기'
      aria-label='리포트 시트 열기'
      className='inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
    >
      <FileSpreadsheet className='h-4 w-4' />
    </a>
  );
}
