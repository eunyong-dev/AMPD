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

const SERVICE_LABEL: Record<'sheet' | 'jira', string> = {
  sheet: '시트',
  jira: 'JIRA',
};

/**
 * 시트 / JIRA 링크 버튼 — 주소가 없으면 자리를 비우지 않고 흐린 비활성 모양으로
 * (줄마다 위치가 같아서 어느 캠페인에 없는지 한눈에 보인다)
 */
export function ServiceLink({
  service,
  url,
}: {
  service: 'sheet' | 'jira';
  url: string | null | undefined;
}) {
  const base =
    'inline-flex items-center gap-1 rounded-md border border-transparent px-1.5 py-0.5 text-[11px]';
  if (!url) {
    return (
      <span
        aria-disabled
        title={`${SERVICE_LABEL[service]} 연결 안 됨`}
        className={`${base} cursor-not-allowed text-muted-foreground/50 [&_img]:opacity-40 [&_img]:grayscale`}
      >
        <ServiceFavicon service={service} className='h-3.5 w-3.5' />
        {SERVICE_LABEL[service]}
      </span>
    );
  }
  return (
    <a
      href={url}
      target='_blank'
      rel='noopener noreferrer'
      className={`${base} text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground`}
    >
      <ServiceFavicon service={service} className='h-3.5 w-3.5' />
      {SERVICE_LABEL[service]}
    </a>
  );
}
