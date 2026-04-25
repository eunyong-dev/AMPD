/**
 * 메인 유틸리티 함수 파일
 * 모든 유틸리티 함수를 중앙에서 관리하고 재export
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind CSS 클래스를 병합하고 중복을 제거
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 사용자 관련 유틸리티
export {
  formatUserName,
  formatUserEmail,
  getUserAvatarUrl,
  getDisplayName,
  getProfileAvatarUrl,
  getRoleDisplayName,
  getRoleColorClass,
} from './utils/user';

// 날짜 관련 유틸리티
export {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  isValidDateRange,
  isToday,
} from './utils/date';

// 숫자 관련 유틸리티
export {
  formatCurrency,
  formatPercentage,
  formatNumber,
  formatCompactNumber,
  isValidNumberRange,
  isPositiveNumber,
  isNegativeNumber,
  isZero,
} from './utils/number';

// 문자열 관련 유틸리티
export {
  slugify,
  toTitleCase,
  toCamelCase,
  toPascalCase,
  toKebabCase,
  toSnakeCase,
  truncateText,
  stripHtml,
  isValidEmail,
  isValidUrl,
} from './utils/string';

// 성능 최적화 관련 유틸리티
export {
  debounce,
  throttle,
  memoize,
  delay,
  requestAnimationFrameDelay,
  measureExecutionTime,
  measureAsyncExecutionTime,
} from './utils/performance';

// 에러 처리 관련 유틸리티
export {
  extractErrorMessage,
  parseSupabaseError,
  getErrorIcon,
  getErrorColorClass,
  handleError,
  showSuccess,
  isError,
  isSupabaseError,
  type SupabaseError,
  type ParsedError,
} from './utils/error-handler';
