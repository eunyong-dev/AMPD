/**
 * 공통 에러 처리 유틸리티
 * 모든 에러 처리를 표준화하고 중앙에서 관리
 */

import { toast } from 'sonner';

/**
 * Supabase 에러 타입 정의
 */
export interface SupabaseError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

export interface ParsedError {
  type: 'network' | 'auth' | 'unknown';
  title: string;
  message: string;
  details?: string;
}

/**
 * Supabase 에러 객체에서 메시지 추출
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const err = error as any;
    
    // Supabase PostgREST 에러 구조 확인
    if (err.message && typeof err.message === 'string') {
      return err.message;
    }
    
    if (err.details && typeof err.details === 'string') {
      return err.details;
    }
    
    if (err.hint && typeof err.hint === 'string') {
      return err.hint;
    }
    
    if (err.code && typeof err.code === 'string') {
      return `Error code: ${err.code}`;
    }
  }

  if (typeof error === 'string') {
    return error;
  }

  return '예기치 못한 오류가 발생했습니다. 다시 시도해주세요.';
}

/**
 * Supabase 에러를 파싱하여 사용자 친화적인 메시지로 변환
 */
export function parseSupabaseError(error: any): ParsedError {
  // 네트워크 에러
  if (
    error?.message?.includes('network') ||
    error?.message?.includes('fetch') ||
    error?.code === 'NETWORK_ERROR'
  ) {
    return {
      type: 'network',
      title: '네트워크 오류',
      message: '인터넷 연결을 확인하고 다시 시도해주세요.',
      details: '네트워크 연결이 불안정할 수 있습니다.',
    };
  }

  // 인증 관련 에러
  if (
    error?.message?.includes('auth') ||
    error?.message?.includes('unauthorized') ||
    error?.code?.startsWith('auth_')
  ) {
    return {
      type: 'auth',
      title: '인증 오류',
      message: '로그인 중 문제가 발생했습니다.',
      details: '다시 로그인을 시도해주세요.',
    };
  }

  // 알 수 없는 에러
  return {
    type: 'unknown',
    title: '오류 발생',
    message: '예상치 못한 오류가 발생했습니다.',
    details: error?.message || '다시 시도해주세요.',
  };
}

/**
 * 에러 타입에 따른 아이콘 반환
 */
export function getErrorIcon(type: ParsedError['type']): string {
  switch (type) {
    case 'network':
      return '🌐';
    case 'auth':
      return '🔑';
    default:
      return '⚠️';
  }
}

/**
 * 에러 타입에 따른 색상 클래스 반환
 */
export function getErrorColorClass(type: ParsedError['type']): string {
  switch (type) {
    case 'network':
      return 'text-blue-800 bg-blue-50 border-blue-200';
    case 'auth':
      return 'text-red-800 bg-red-50 border-red-200';
    default:
      return 'text-gray-800 bg-gray-50 border-gray-200';
  }
}

/**
 * 에러를 안전하게 처리하고 사용자에게 알림
 */
export function handleError(error: unknown, defaultMessage?: string): void {
  const message = extractErrorMessage(error);
  const errorMessage = defaultMessage || message;
  
  toast.error(errorMessage);
}

/**
 * 성공 메시지 표시
 */
export function showSuccess(message: string): void {
  toast.success(message);
}

/**
 * 타입 안전한 에러 체크
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * 브라우저가 오프라인 상태인지 확인
 */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

/**
 * Supabase fetch 에러를 표준화된 방식으로 처리
 * - 오프라인 시: console.error를 띄우지 않음 (Next.js dev overlay 방지)
 * - 그 외: prefix와 함께 로깅 후 throw
 *
 * @param prefix 로그 접두사 (예: '캠페인 조회 오류')
 * @param error Supabase가 반환한 error 객체
 * @param userMessage 사용자에게 throw로 전달할 메시지 (기본: prefix와 동일)
 */
export function logSupabaseError(
  prefix: string,
  error: unknown,
  userMessage?: string
): never {
  if (isOffline()) {
    throw new Error('네트워크 연결을 확인해주세요.');
  }
  console.error(prefix, error);
  throw new Error(userMessage ?? prefix);
}

/**
 * Supabase 에러인지 확인
 */
export function isSupabaseError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  
  const err = error as any;
  return !!(
    err.code ||
    err.message ||
    err.details ||
    err.hint ||
    err.status
  );
}

