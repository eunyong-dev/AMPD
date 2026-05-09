'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Send } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/utils/supabase/client';

interface SendInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  accountId: string;
  invoiceNo: string;
  invoiceDate: string;
  totalAmount: number;
  billToCompany: string;
  fromCompany: string;
  onSent?: () => void;
}

const formatCurrency = (n: number) =>
  `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function SendInvoiceModal({
  isOpen,
  onClose,
  invoiceId,
  accountId,
  invoiceNo,
  invoiceDate,
  totalAmount,
  billToCompany,
  fromCompany,
  onSent,
}: SendInvoiceModalProps) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [signatureHtml, setSignatureHtml] = useState('');
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 모달 열릴 때 광고주의 발송 기본값 + 메일 템플릿 + Gmail 서명 로드
  useEffect(() => {
    if (!isOpen) return;
    setLoadingDefaults(true);
    (async () => {
      try {
        const supabase = createClient();
        const [{ data: account }, signatureRes] = await Promise.all([
          supabase
            .from('accounts')
            .select('invoice_email_to, invoice_email_cc, bill_to_email')
            .eq('id', accountId)
            .single(),
          fetch('/api/gmail/signature').then((r) => r.json()).catch(() => ({})),
        ]);

        // 받는사람: invoice_email_to 우선, 없으면 bill_to_email
        const defaultTo =
          (account?.invoice_email_to ?? '').trim() ||
          (account?.bill_to_email ?? '').trim() ||
          '';
        const defaultCc = (account?.invoice_email_cc ?? '').trim() || '';
        setTo(defaultTo);
        setCc(defaultCc);

        // 제목 템플릿
        const defaultSubject = `[Invoice] ${invoiceNo} — ${fromCompany}`;
        setSubject(defaultSubject);

        // 본문 템플릿 (서명은 별도로 HTML 로 추가됨)
        const defaultBody = `Hi ${billToCompany},

Please find attached the invoice ${invoiceNo} dated ${invoiceDate} for ${formatCurrency(
          totalAmount
        )}.

Kindly process the payment by the due date indicated on the invoice.
If you have any questions, please reply to this email.

Best regards,`;
        setBody(defaultBody);

        // Gmail 서명 적용 (없으면 회사명 fallback)
        if (signatureRes && typeof signatureRes.signature === 'string' && signatureRes.signature.trim()) {
          setSignatureHtml(signatureRes.signature);
        } else {
          setSignatureHtml(
            `<div>${fromCompany.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류';
        toast.error(`기본값 로드 실패: ${msg}`);
      } finally {
        setLoadingDefaults(false);
      }
    })();
  }, [isOpen, accountId, invoiceNo, invoiceDate, totalAmount, billToCompany, fromCompany]);

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast.error('받는사람, 제목, 본문은 필수입니다.');
      return;
    }

    setSubmitting(true);
    try {
      // 본문을 HTML로 변환 (줄바꿈 → <br/>) + Gmail 서명 HTML 추가
      const bodyTextHtml = body
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br />');

      const bodyHtml = signatureHtml
        ? `${bodyTextHtml}<br /><br />${signatureHtml}`
        : bodyTextHtml;

      const res = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          cc: cc.trim() || undefined,
          subject,
          bodyHtml,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '발송 실패');
      }

      if (data.warning) {
        toast.warning(data.warning);
      } else {
        toast.success('인보이스가 발송되었습니다.');
      }

      onSent?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      toast.error(`발송 실패: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !submitting && !o && onClose()}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>인보이스 이메일 발송</DialogTitle>
          <DialogDescription>
            인보이스 PDF 를 첨부해서 본인 Gmail 계정으로 발송합니다.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3 py-2'>
          <div className='space-y-1.5'>
            <Label htmlFor='send-to'>
              받는사람 (To){' '}
              <span className='text-xs text-muted-foreground font-normal'>
                쉼표로 여러 명
              </span>
            </Label>
            <Input
              id='send-to'
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder='billing@example.com'
              disabled={loadingDefaults || submitting}
              autoComplete='off'
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='send-cc'>
              참조 (CC){' '}
              <span className='text-xs text-muted-foreground font-normal'>
                쉼표로 여러 명
              </span>
            </Label>
            <Input
              id='send-cc'
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder='manager@example.com'
              disabled={loadingDefaults || submitting}
              autoComplete='off'
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='send-subject'>제목</Label>
            <Input
              id='send-subject'
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={loadingDefaults || submitting}
              autoComplete='off'
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='send-body'>본문</Label>
            <Textarea
              id='send-body'
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              disabled={loadingDefaults || submitting}
              className='font-mono text-sm'
            />
          </div>

          {signatureHtml && (
            <div className='space-y-1.5'>
              <Label className='flex items-center gap-2'>
                서명 (Gmail)
                <span className='text-xs text-muted-foreground font-normal'>
                  본인 Gmail 설정에서 자동 가져옴
                </span>
              </Label>
              <div
                className='rounded-md border bg-muted/30 p-3 text-sm overflow-auto max-h-40'
                dangerouslySetInnerHTML={{ __html: signatureHtml }}
              />
            </div>
          )}

          <div className='rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground'>
            📎 첨부파일: 인보이스 PDF 가 자동으로 첨부됩니다.
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button
            onClick={handleSend}
            disabled={submitting || loadingDefaults}
          >
            <Send className='h-4 w-4 mr-1.5' />
            {submitting ? '발송 중...' : '발송'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
