'use client';

import { useState } from 'react';

// 외부 서비스 아이콘 — 공식 사이트 파비콘을 그대로 쓴다 (MMP 아이콘과 같은 방식)
const SERVICE_FAVICON: Record<'sheet' | 'jira', string> = {
  sheet:
    'https://www.google.com/s2/favicons?domain_url=https://docs.google.com/spreadsheets/u/0/&sz=64',
  jira: 'https://www.google.com/s2/favicons?domain_url=https://jira.atlassian.com&sz=64',
};

export function ServiceFavicon({
  service,
  className = 'h-4 w-4',
}: {
  service: 'sheet' | 'jira';
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SERVICE_FAVICON[service]}
      alt=''
      aria-hidden
      onError={() => setFailed(true)}
      className={`${className} flex-shrink-0 object-contain`}
    />
  );
}
