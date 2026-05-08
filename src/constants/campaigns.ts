/**
 * 캠페인 도메인 상수
 */

export const CAMPAIGN_STATUS_OPTIONS = [
  { value: 'planning', label: 'Planning' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'holding', label: 'Holding' },
  { value: 'end', label: 'End' },
] as const;

export const CAMPAIGN_TYPE_OPTIONS = [{ value: 'CPI', label: 'CPI' }] as const;

// 데이터베이스 check constraint와 일치해야 함
export const MMP_OPTIONS = [
  { value: 'AppsFlyer', label: 'AppsFlyer' },
  { value: 'Adjust', label: 'Adjust' },
] as const;

export const REGION_OPTIONS = [
  { value: 'KR', label: 'Korea' },
  { value: 'JP', label: 'Japan' },
  { value: 'TW', label: 'Taiwan' },
  { value: 'US', label: 'United States' },
] as const;
