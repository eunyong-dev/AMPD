/**
 * 서버 사이드에서 인보이스 HTML을 빌드해 puppeteer로 PDF 변환할 때 사용.
 * 클라이언트 React 인보이스 페이지와 시각적으로 동일한 결과를 만든다.
 */

import type { Database } from '@/lib/database.types';

type InvoiceRow = Database['public']['Tables']['invoices']['Row'];
type SettlementRow = Database['public']['Tables']['settlements']['Row'];
type SettlementLineRow =
  Database['public']['Tables']['settlement_lines']['Row'];
type CompanyInfoRow = Database['public']['Tables']['company_info']['Row'];

export interface InvoiceTemplateData {
  invoice: InvoiceRow;
  settlement: SettlementRow;
  lines: SettlementLineRow[];
  company: CompanyInfoRow | null;
}

const formatAmount = (n: number) =>
  `$ ${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatRate = (n: number) =>
  `$ ${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;

const escapeHtml = (s: string | null | undefined): string => {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const MIN_ROWS = 12;

export function buildInvoiceHtml(data: InvoiceTemplateData): string {
  const { invoice, settlement, lines, company } = data;
  const total = lines.reduce((sum, l) => sum + Number(l.amount ?? 0), 0);
  const emptyRows = Math.max(0, MIN_ROWS - lines.length);

  const linesHtml = lines
    .map(
      (l) => `
        <tr>
          <td>${escapeHtml(l.description)}</td>
          <td>${escapeHtml(l.model)}</td>
          <td class="num right">${formatRate(Number(l.rate))}</td>
          <td>${escapeHtml(l.geo)}</td>
          <td class="num nowrap">${escapeHtml(l.duration_from)} ~ ${escapeHtml(
            l.duration_to
          )}</td>
          <td class="num right">${l.quantity.toLocaleString()}</td>
          <td class="num right">${formatAmount(Number(l.amount))}</td>
        </tr>
      `
    )
    .join('');

  const emptyRowsHtml = Array.from({ length: emptyRows })
    .map(
      () => `
        <tr class="empty">
          <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td>
        </tr>
      `
    )
    .join('');

  const totalAmount = settlement.total_amount
    ? Number(settlement.total_amount)
    : total;

  const stampImg = company?.stamp_url
    ? `<div class="stamp"><img src="${escapeHtml(
        company.stamp_url
      )}" alt="Stamp" /></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>Invoice ${escapeHtml(invoice.invoice_no)}</title>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: white;
    color: #000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
    font-size: 12px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .invoice-page {
    width: 100%;
  }
  h1 { font-size: 36px; font-weight: 800; letter-spacing: -0.02em; margin: 0; }
  .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
  .info-table { font-size: 13px; border-collapse: collapse; }
  .info-table td { padding: 2px 0; }
  .info-table td.label { font-weight: 600; padding-right: 12px; vertical-align: top; }
  .info-table td.value { font-family: monospace; }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  .section-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: #4b5563; margin-bottom: 4px;
  }
  .section-line {
    border-top: 2px solid #000; padding-top: 8px;
  }
  .section-name { font-weight: 600; font-size: 13px; margin-bottom: 2px; }
  .section-text { font-size: 11px; margin-bottom: 2px; }

  .detail-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .detail-table thead tr { background: #f3f4f6; border-top: 2px solid #000; border-bottom: 2px solid #000; }
  .detail-table th { text-align: left; padding: 8px; font-weight: 600; }
  .detail-table th.right { text-align: right; }
  .detail-table tbody tr { border-bottom: 1px solid #e5e7eb; }
  .detail-table td { padding: 6px 8px; }
  .detail-table td.num { font-variant-numeric: tabular-nums; }
  .detail-table td.right { text-align: right; }
  .detail-table td.nowrap { white-space: nowrap; }
  .detail-table tr.empty td { color: transparent; }

  .total-wrap { display: flex; justify-content: flex-end; align-items: center; padding-right: 40px; margin-bottom: 40px; }
  .total-stack { display: inline-flex; align-items: center; }
  .total-box {
    border: 2px solid #000; padding: 12px; min-width: 260px;
  }
  .total-box .row { display: flex; align-items: baseline; gap: 12px; }
  .total-label { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; }
  .total-amount { flex: 1; text-align: center; font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .stamp { margin-left: -64px; position: relative; z-index: 10; }
  .stamp img { height: 80px; width: 80px; object-fit: contain; opacity: 0.9; }

  .pay-section { border-top: 2px solid #000; padding-top: 12px; }
  .pay-table { font-size: 11px; width: 100%; border-collapse: collapse; }
  .pay-table tr { border-bottom: 1px solid #e5e7eb; }
  .pay-table tr:last-child { border-bottom: none; }
  .pay-table td.label { font-weight: 600; white-space: nowrap; padding: 4px 12px 4px 0; width: 200px; vertical-align: top; }
  .pay-table td.value { padding: 4px 0; }
  @page { size: A4; }
</style>
</head>
<body>
<div class="invoice-page">
  <div class="top">
    <h1>INVOICE</h1>
    <table class="info-table">
      <tr><td class="label">Invoice No</td><td class="value">${escapeHtml(
        invoice.invoice_no
      )}</td></tr>
      <tr><td class="label">Invoice Date</td><td class="value">${escapeHtml(
        invoice.invoice_date
      )}</td></tr>
      <tr><td class="label">Due Date</td><td class="value">${escapeHtml(
        invoice.due_date
      )}</td></tr>
    </table>
  </div>

  <div class="grid-2">
    <div>
      <div class="section-label">From</div>
      <div class="section-line">
        <div class="section-name">${escapeHtml(company?.name) || '—'}</div>
        ${
          invoice.from_email
            ? `<div class="section-text">${escapeHtml(invoice.from_email)}</div>`
            : ''
        }
        ${
          company?.address
            ? `<div class="section-text">${escapeHtml(company.address)}</div>`
            : ''
        }
      </div>
    </div>
    <div>
      <div class="section-label">Bill To</div>
      <div class="section-line">
        <div class="section-name">${escapeHtml(invoice.bill_to_name) || '—'}</div>
        ${
          invoice.bill_to_email
            ? `<div class="section-text">${escapeHtml(
                invoice.bill_to_email
              )}</div>`
            : ''
        }
        ${
          invoice.bill_to_address
            ? `<div class="section-text">${escapeHtml(
                invoice.bill_to_address
              )}</div>`
            : ''
        }
      </div>
    </div>
  </div>

  <div style="margin-bottom: 16px;">
    <div class="section-label">Detail</div>
    <table class="detail-table">
      <thead>
        <tr>
          <th>DESCRIPTION</th>
          <th>Model</th>
          <th class="right">Rate</th>
          <th>GEO</th>
          <th>Duration</th>
          <th class="right">Quantity</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${linesHtml}
        ${emptyRowsHtml}
      </tbody>
    </table>
  </div>

  <div class="total-wrap">
    <div class="total-stack">
      <div class="total-box">
        <div class="row">
          <div class="total-label">TOTAL</div>
          <div class="total-amount">${formatAmount(totalAmount)}</div>
        </div>
      </div>
      ${stampImg}
    </div>
  </div>

  <div class="pay-section">
    <div class="section-label" style="margin-bottom: 8px;">Payment Information</div>
    <table class="pay-table">
      <tr><td class="label">Beneficiary Name</td><td class="value">${
        escapeHtml(company?.beneficiary_name) || '—'
      }</td></tr>
      <tr><td class="label">Beneficiary Address</td><td class="value">${
        escapeHtml(company?.beneficiary_address) || '—'
      }</td></tr>
      <tr><td class="label">Bank Name</td><td class="value">${
        escapeHtml(company?.bank_name) || '—'
      }</td></tr>
      <tr><td class="label">Bank Account Number</td><td class="value">${
        escapeHtml(company?.bank_account_number) || '—'
      }</td></tr>
      <tr><td class="label">Bank Swift Code</td><td class="value">${
        escapeHtml(company?.bank_swift_code) || '—'
      }</td></tr>
      <tr><td class="label">Payment Method</td><td class="value">${
        escapeHtml(company?.payment_method) || '—'
      }</td></tr>
      <tr><td class="label">Bank Address</td><td class="value">${
        escapeHtml(company?.bank_address) || '—'
      }</td></tr>
    </table>
  </div>
</div>
</body>
</html>
  `;
}
