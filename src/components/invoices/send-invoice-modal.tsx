'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Send, Globe, User, Paperclip, X, ChevronDown, ChevronRight } from 'lucide-react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createClient } from '@/utils/supabase/client';
import { useUserContext } from '@/lib/user-context';
import {
  applyTemplateVars,
  buildTemplateVars,
} from '@/lib/invoice-email-template-vars';
import type { Database } from '@/lib/database.types';

type Template = Database['public']['Tables']['invoice_email_templates']['Row'];

interface SendInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  accountId: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  periodTo: string; // 정산 기간 종료일 — PDF 파일명에 사용
  totalAmount: number;
  billToCompany: string;
  fromCompany: string;
  onSent?: () => void;
}

export function SendInvoiceModal({
  isOpen,
  onClose,
  invoiceId,
  accountId,
  invoiceNo,
  invoiceDate,
  dueDate,
  periodTo,
  totalAmount,
  billToCompany,
  fromCompany,
  onSent,
}: SendInvoiceModalProps) {
  const { profile } = useUserContext();
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [signatureHtml, setSignatureHtml] = useState('');
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('default');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 인보이스 PDF 파일명 — API route 와 동일한 규칙 (정산 기간 종료일 기준)
  const invoicePdfFilename = useMemo(() => {
    const dateRaw = (periodTo || invoiceDate || '').replace(/-/g, '');
    const yymmdd = dateRaw.length >= 8 ? dateRaw.slice(2, 8) : dateRaw;
    const safe =
      (billToCompany || 'invoice')
        .replace(/[\\/:*?"<>|]/g, '')
        .trim() || 'invoice';
    return `${yymmdd}_invoice_${safe}.pdf`;
  }, [periodTo, invoiceDate, billToCompany]);

  // 변수 치환에 쓸 데이터
  const templateVars = useMemo(
    () =>
      buildTemplateVars({
        invoiceNo,
        invoiceDate,
        dueDate,
        totalAmount,
        billToCompany,
        fromCompany,
        fromName: profile?.display_name ?? '',
      }),
    [
      invoiceNo,
      invoiceDate,
      dueDate,
      totalAmount,
      billToCompany,
      fromCompany,
      profile?.display_name,
    ]
  );

  // 모달 열릴 때 광고주의 발송 기본값 + 템플릿 목록 + 사용자 기본 템플릿 + Gmail 서명 로드
  useEffect(() => {
    if (!isOpen) return;
    setLoadingDefaults(true);
    setAttachments([]);
    setSignatureOpen(false);
    setSignatureError(null);
    (async () => {
      try {
        const supabase = createClient();
        const [
          { data: account },
          { data: tpls },
          { data: userProfile },
          signatureRes,
        ] = await Promise.all([
          supabase
            .from('accounts')
            .select('invoice_email_to, invoice_email_cc, bill_to_email')
            .eq('id', accountId)
            .single(),
          supabase
            .from('invoice_email_templates')
            .select('*')
            .order('updated_at', { ascending: false }),
          profile?.id
            ? supabase
                .from('user_profiles')
                .select('default_invoice_template_id')
                .eq('id', profile.id)
                .single()
            : Promise.resolve({ data: null }),
          fetch('/api/gmail/signature')
            .then((r) => r.json())
            .catch(() => ({})),
        ]);

        // 받는사람: invoice_email_to 우선, 없으면 bill_to_email
        const defaultTo =
          (account?.invoice_email_to ?? '').trim() ||
          (account?.bill_to_email ?? '').trim() ||
          '';
        const defaultCc = (account?.invoice_email_cc ?? '').trim() || '';
        setTo(defaultTo);
        setCc(defaultCc);

        const templateList = (tpls ?? []) as Template[];
        setTemplates(templateList);

        // 사용자가 설정한 기본 템플릿 자동 선택
        const userDefaultId = userProfile?.default_invoice_template_id ?? null;
        const defaultTpl =
          (userDefaultId && templateList.find((t) => t.id === userDefaultId)) ||
          null;

        if (defaultTpl) {
          setSelectedTemplateId(defaultTpl.id);
          setSubject(applyTemplateVars(defaultTpl.subject, templateVars));
          setBody(applyTemplateVars(defaultTpl.body, templateVars));
        } else {
          // 기본 템플릿 없음 — 빈 값으로 시작
          setSelectedTemplateId('');
          setSubject('');
          setBody('');
        }

        // Gmail 서명 적용
        if (signatureRes?.error) {
          // API 에러 (scope 없음 등) — 에러 표시 + fallback
          setSignatureError(signatureRes.error as string);
          setSignatureHtml(
            `<div>${fromCompany
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')}</div>`
          );
        } else if (
          signatureRes &&
          typeof signatureRes.signature === 'string' &&
          signatureRes.signature.trim()
        ) {
          setSignatureHtml(signatureRes.signature);
        } else {
          // 정상 응답이지만 Gmail 에 등록된 서명 없음
          setSignatureError(
            'Gmail 설정에 등록된 서명이 없습니다. (회사명으로 발송)'
          );
          setSignatureHtml(
            `<div>${fromCompany
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')}</div>`
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류';
        toast.error(`기본값 로드 실패: ${msg}`);
      } finally {
        setLoadingDefaults(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, accountId, profile?.id]);

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setSubject(applyTemplateVars(tpl.subject, templateVars));
    setBody(applyTemplateVars(tpl.body, templateVars));
  };

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

      // FormData 로 추가 첨부파일까지 전송
      const formData = new FormData();
      formData.append('to', to);
      if (cc.trim()) formData.append('cc', cc);
      formData.append('subject', subject);
      formData.append('bodyHtml', bodyHtml);
      for (const f of attachments) {
        formData.append('files', f, f.name);
      }

      const res = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: 'POST',
        body: formData,
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
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden'>
        <DialogHeader>
          <DialogTitle>인보이스 이메일 발송</DialogTitle>
          <DialogDescription>
            인보이스 PDF 를 첨부해서 본인 Gmail 계정으로 발송합니다.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3 py-2'>
          <div className='space-y-1.5'>
            <Label htmlFor='send-template'>
              템플릿{' '}
              <span className='text-xs text-muted-foreground font-normal'>
                선택 시 제목/본문이 변수 적용되어 채워짐
              </span>
            </Label>
            {templates.length === 0 ? (
              <div className='rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground'>
                저장된 템플릿이 없습니다.{' '}
                <a
                  href='/email-templates'
                  className='underline hover:text-foreground'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  이메일 템플릿
                </a>{' '}
                페이지에서 템플릿을 만들고 별표를 눌러 기본값으로 지정할 수
                있어요.
              </div>
            ) : (
              <Select
                value={selectedTemplateId}
                onValueChange={handleSelectTemplate}
                disabled={loadingDefaults || submitting}
              >
                <SelectTrigger id='send-template'>
                  <SelectValue placeholder='템플릿 선택' />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className='flex items-center gap-2'>
                        {t.scope === 'shared' ? (
                          <Globe className='h-3.5 w-3.5 flex-shrink-0' />
                        ) : (
                          <User className='h-3.5 w-3.5 flex-shrink-0' />
                        )}
                        <span>{t.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

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
              <button
                type='button'
                onClick={() => setSignatureOpen((v) => !v)}
                className='flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors'
              >
                {signatureOpen ? (
                  <ChevronDown className='h-4 w-4' />
                ) : (
                  <ChevronRight className='h-4 w-4' />
                )}
                <span>서명 (Gmail)</span>
                <span className='text-xs text-muted-foreground font-normal'>
                  {signatureError
                    ? '⚠️ 가져오기 실패'
                    : '본인 Gmail 설정에서 자동 가져옴 — 미리보기'}
                </span>
              </button>
              {signatureOpen && (
                <>
                  {signatureError && (
                    <div className='rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 p-3 text-xs text-yellow-900 dark:text-yellow-200'>
                      {signatureError}
                      {signatureError.includes('권한') && (
                        <div className='mt-1 text-yellow-800 dark:text-yellow-300'>
                          로그아웃 → 재로그인 시 Gmail 설정 권한을 동의해주세요.
                        </div>
                      )}
                    </div>
                  )}
                  <div
                    className='rounded-md border bg-white dark:bg-muted/30 p-3 text-sm overflow-y-auto overflow-x-hidden min-h-24 max-h-96 max-w-full [&_img]:max-w-full [&_img]:h-auto [&_*]:max-w-full [&_table]:!w-auto'
                    dangerouslySetInnerHTML={{ __html: signatureHtml }}
                  />
                </>
              )}
            </div>
          )}

          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <Label>첨부파일</Label>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
              >
                <Paperclip className='h-3.5 w-3.5 mr-1.5' />
                파일 추가
              </Button>
              <input
                ref={fileInputRef}
                type='file'
                multiple
                className='hidden'
                onChange={(e) => {
                  const newFiles = Array.from(e.target.files ?? []);
                  if (newFiles.length > 0) {
                    setAttachments((prev) => [...prev, ...newFiles]);
                  }
                  // 같은 파일 다시 선택 가능하도록 reset
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
            </div>
            <div className='rounded-md border bg-muted/40 p-3 space-y-1.5 text-xs'>
              <div className='flex items-center justify-between text-muted-foreground gap-2'>
                <span className='flex items-center gap-1.5 truncate'>
                  <Paperclip className='h-3 w-3 flex-shrink-0' />
                  <span className='truncate'>{invoicePdfFilename}</span>
                </span>
                <span className='text-[10px] flex-shrink-0'>자동 첨부</span>
              </div>
              {attachments.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className='flex items-center justify-between gap-2'
                >
                  <span className='flex items-center gap-1.5 truncate'>
                    <Paperclip className='h-3 w-3 flex-shrink-0' />
                    <span className='truncate'>{file.name}</span>
                    <span className='text-[10px] text-muted-foreground flex-shrink-0'>
                      ({Math.ceil(file.size / 1024)} KB)
                    </span>
                  </span>
                  <button
                    type='button'
                    onClick={() =>
                      setAttachments((prev) =>
                        prev.filter((_, idx) => idx !== i)
                      )
                    }
                    className='text-muted-foreground hover:text-destructive flex-shrink-0'
                    disabled={submitting}
                  >
                    <X className='h-3.5 w-3.5' />
                  </button>
                </div>
              ))}
            </div>
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
