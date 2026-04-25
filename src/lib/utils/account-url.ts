/**
 * 어카운트 URL 헬퍼
 * UUID 노출을 피하기 위해 회사명을 URL slug로 사용한다.
 * 회사명에 공백/한글/특수문자가 있어도 안전하도록 encodeURIComponent 적용.
 */
export function accountUrl(company: string): string {
  return `/accounts/${encodeURIComponent(company)}`;
}
