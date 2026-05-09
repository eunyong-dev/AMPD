import { NextResponse } from 'next/server';

import { createClient } from '@/utils/supabase/server';
import { generateInvoicePdf } from '@/lib/invoice-pdf';
import type { Database } from '@/lib/database.types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * 인보이스 PDF 를 직접 반환.
 * <iframe src="/api/invoices/[id]/pdf"> 로 페이지에 임베드 가능.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invoiceId } = await params;
  const supabase = await createClient();

  // 인증
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  type InvoiceRow = Database['public']['Tables']['invoices']['Row'];
  type SettlementRow = Database['public']['Tables']['settlements']['Row'];
  type SettlementLineRow =
    Database['public']['Tables']['settlement_lines']['Row'];
  type CompanyInfoRow = Database['public']['Tables']['company_info']['Row'];

  // 인보이스 + 정산 + 라인 + 회사정보 조회
  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();
  if (invErr || !invoice) {
    return NextResponse.json(
      { error: '인보이스를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  const { data: settlement } = await supabase
    .from('settlements')
    .select('*')
    .eq('id', invoice.settlement_id)
    .single();
  if (!settlement) {
    return NextResponse.json(
      { error: '정산서를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  const { data: lines } = await supabase
    .from('settlement_lines')
    .select('*')
    .eq('settlement_id', invoice.settlement_id)
    .order('sort_order', { ascending: true });

  const { data: company } = await supabase
    .from('company_info')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  // PDF 생성
  let pdfBuffer: Buffer;
  try {
    console.log('[invoice-pdf] 생성 시작', { invoiceId, lines: lines?.length });
    pdfBuffer = await generateInvoicePdf({
      invoice: invoice as InvoiceRow,
      settlement: settlement as SettlementRow,
      lines: (lines ?? []) as SettlementLineRow[],
      company: (company as CompanyInfoRow) ?? null,
    });
    console.log('[invoice-pdf] 생성 완료', { bytes: pdfBuffer.length });
  } catch (err) {
    console.error('[invoice-pdf] 생성 실패:', err);
    return NextResponse.json(
      {
        error: `PDF 생성 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`,
      },
      { status: 500 }
    );
  }

  // 파일명 — {YY}{MM}{DD}_invoice_{회사명}.pdf
  const dateRaw = (invoice.invoice_date ?? '').replace(/-/g, '');
  const yymmdd = dateRaw.length >= 8 ? dateRaw.slice(2, 8) : dateRaw;
  const companySafe =
    (invoice.bill_to_name ?? 'invoice')
      .replace(/[\\/:*?"<>|]/g, '')
      .trim() || 'invoice';
  const filename = `${yymmdd}_invoice_${companySafe}.pdf`;

  // Buffer → ArrayBuffer 변환해서 NextResponse 에 전달
  const arrayBuffer = pdfBuffer.buffer.slice(
    pdfBuffer.byteOffset,
    pdfBuffer.byteOffset + pdfBuffer.byteLength
  ) as ArrayBuffer;

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(pdfBuffer.length),
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
