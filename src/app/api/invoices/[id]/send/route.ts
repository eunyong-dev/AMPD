import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/utils/supabase/server';
import { generateInvoicePdf } from '@/lib/invoice-pdf';
import { parseEmails, sendViaGmail } from '@/lib/gmail-send';
import type { Database } from '@/lib/database.types';

// puppeteer 는 Node.js runtime 에서 실행
export const runtime = 'nodejs';
// PDF 렌더링 시간 고려 — 최대 60초
export const maxDuration = 60;

interface RequestBody {
  to: string; // 쉼표 구분
  cc?: string;
  subject: string;
  bodyHtml: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invoiceId } = await params;
  const body = (await request.json()) as RequestBody;

  if (!body.to?.trim() || !body.subject?.trim() || !body.bodyHtml) {
    return NextResponse.json(
      { error: 'to, subject, bodyHtml 은 필수입니다.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // 1. 인증 확인
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  // 2. Gmail access_token 확인 (provider_token)
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.provider_token;
  if (!accessToken) {
    return NextResponse.json(
      {
        error:
          'Gmail 발송 권한 토큰이 없습니다. 다시 로그인해서 Gmail 권한을 부여해주세요.',
      },
      { status: 403 }
    );
  }

  // 3. 인보이스 + 정산 + 라인 + 회사정보 조회
  type InvoiceRow = Database['public']['Tables']['invoices']['Row'];
  type SettlementRow = Database['public']['Tables']['settlements']['Row'];
  type SettlementLineRow =
    Database['public']['Tables']['settlement_lines']['Row'];
  type CompanyInfoRow = Database['public']['Tables']['company_info']['Row'];

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

  const { data: settlement, error: setErr } = await supabase
    .from('settlements')
    .select('*')
    .eq('id', invoice.settlement_id)
    .single();
  if (setErr || !settlement) {
    return NextResponse.json(
      { error: '정산서를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  const { data: lines, error: linesErr } = await supabase
    .from('settlement_lines')
    .select('*')
    .eq('settlement_id', invoice.settlement_id)
    .order('sort_order', { ascending: true });
  if (linesErr) {
    return NextResponse.json(
      { error: `정산 항목 조회 실패: ${linesErr.message}` },
      { status: 500 }
    );
  }

  const { data: company } = await supabase
    .from('company_info')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  // 4. 보내는 사람 이메일
  const fromEmail = user.email;
  if (!fromEmail) {
    return NextResponse.json(
      { error: '발송자 이메일을 확인할 수 없습니다.' },
      { status: 400 }
    );
  }

  // 5. HTML → PDF 변환
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateInvoicePdf({
      invoice: invoice as InvoiceRow,
      settlement: settlement as SettlementRow,
      lines: (lines ?? []) as SettlementLineRow[],
      company: (company as CompanyInfoRow) ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `PDF 생성 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`,
      },
      { status: 500 }
    );
  }

  // 6. 파일명 — {YY}{MM}{DD}_invoice_{회사명}.pdf
  const dateRaw = (invoice.invoice_date ?? '').replace(/-/g, '');
  const yymmdd = dateRaw.length >= 8 ? dateRaw.slice(2, 8) : dateRaw;
  const companySafe =
    (invoice.bill_to_name ?? 'invoice')
      .replace(/[\\/:*?"<>|]/g, '')
      .trim() || 'invoice';
  const filename = `${yymmdd}_invoice_${companySafe}.pdf`;

  // 7. Gmail API 발송
  const toList = parseEmails(body.to);
  const ccList = parseEmails(body.cc);
  if (toList.length === 0) {
    return NextResponse.json(
      { error: '받는사람이 비어있습니다.' },
      { status: 400 }
    );
  }

  let result;
  try {
    result = await sendViaGmail({
      accessToken,
      from: fromEmail,
      to: toList,
      cc: ccList.length > 0 ? ccList : undefined,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      attachments: [
        {
          filename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Gmail 발송 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`,
      },
      { status: 500 }
    );
  }

  // 8. 발송 이력 기록
  const { error: updErr } = await supabase
    .from('invoices')
    .update({
      sent_at: new Date().toISOString(),
      sent_to: toList.join(', '),
      sent_cc: ccList.length > 0 ? ccList.join(', ') : null,
      sent_subject: body.subject,
      sent_by: user.id,
      sent_message_id: result.messageId,
    })
    .eq('id', invoiceId);

  if (updErr) {
    // 발송은 성공했지만 기록은 실패 — 응답에 경고
    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      warning: `발송은 성공했으나 이력 기록 실패: ${updErr.message}`,
    });
  }

  return NextResponse.json({
    success: true,
    messageId: result.messageId,
  });
}
