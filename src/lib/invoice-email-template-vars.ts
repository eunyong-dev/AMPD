/**
 * 인보이스 이메일 템플릿에서 사용 가능한 변수 시스템.
 * {variableName} 형식 → 실제 값으로 치환.
 */

export interface InvoiceEmailTemplateVars {
  invoiceNo: string;
  invoiceDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  totalAmount: string; // "$1,234.56"
  billToCompany: string;
  fromCompany: string;
  fromName: string; // 발송자(본인) 이름
  thisYear: string; // "2026" — 발송 시점 기준
  thisMonth: string; // "5" — 발송 시점 기준 (1~12, no padding)
  lastMonth: string; // "4" — 발송 시점 기준 (1~12, 1월이면 12)
}

/**
 * 사용 가능한 변수 목록 — UI 헬퍼 텍스트, 템플릿 작성기 안내용
 */
export const TEMPLATE_VARIABLES: {
  key: keyof InvoiceEmailTemplateVars;
  label: string;
  example: string;
}[] = [
  { key: 'invoiceNo', label: '인보이스 번호', example: 'GNA26050901-151' },
  { key: 'invoiceDate', label: '인보이스 발행일', example: '2026-05-09' },
  { key: 'dueDate', label: '지급 기한일', example: '2026-06-08' },
  { key: 'totalAmount', label: '총 금액', example: '$8,578.70' },
  { key: 'billToCompany', label: '광고주 회사명', example: 'SOHI PTE. LTD.' },
  { key: 'fromCompany', label: '본인 회사명', example: 'GNA COMPANY' },
  { key: 'fromName', label: '본인 이름', example: 'Moon' },
  { key: 'thisYear', label: '올해 (숫자)', example: '2026' },
  { key: 'thisMonth', label: '이번달 (숫자)', example: '5' },
  { key: 'lastMonth', label: '저번달 (숫자)', example: '4' },
];

/**
 * 템플릿 문자열에서 {varName} 을 실제 값으로 치환
 * 알 수 없는 변수는 그대로 두거나 빈 문자열로 처리
 */
export function applyTemplateVars(
  template: string,
  vars: InvoiceEmailTemplateVars
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key as keyof InvoiceEmailTemplateVars];
    return value !== undefined ? value : match;
  });
}

const formatCurrency = (n: number): string =>
  `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * 인보이스 데이터에서 템플릿 변수 객체 빌드
 */
export function buildTemplateVars(args: {
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  billToCompany: string;
  fromCompany: string;
  fromName: string;
}): InvoiceEmailTemplateVars {
  // 발송 시점 기준 — 올해/이번달/저번달
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1; // 1~12
  const lastMonth = thisMonth === 1 ? 12 : thisMonth - 1;

  return {
    invoiceNo: args.invoiceNo,
    invoiceDate: args.invoiceDate,
    dueDate: args.dueDate,
    totalAmount: formatCurrency(args.totalAmount),
    billToCompany: args.billToCompany,
    fromCompany: args.fromCompany,
    fromName: args.fromName,
    thisYear: String(thisYear),
    thisMonth: String(thisMonth),
    lastMonth: String(lastMonth),
  };
}
