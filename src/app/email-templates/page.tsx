'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Globe, User, Code, Star } from 'lucide-react';
import { toast } from 'sonner';

import { AccessControl } from '@/components/access-control';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/sonner';
import { DeleteConfirmationDialog } from '@/components/common/delete-confirmation-dialog';
import { FilterTabs } from '@/components/common/filter-tabs';
import { VariableHighlightedField } from '@/components/common/variable-highlighted-field';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useUserContext } from '@/lib/user-context';
import { TEMPLATE_VARIABLES } from '@/lib/invoice-email-template-vars';
import type { Database } from '@/lib/database.types';

type Template = Database['public']['Tables']['invoice_email_templates']['Row'];

type Scope = 'personal' | 'shared' | 'all';

interface FormState {
  id?: string;
  name: string;
  subject: string;
  body: string;
  scope: 'personal' | 'shared';
}

const emptyForm: FormState = {
  name: '',
  subject: '',
  body: '',
  scope: 'personal',
};

export default function EmailTemplatesPage() {
  const { user } = useAuth();
  const { profile } = useUserContext();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeFilter, setScopeFilter] = useState<Scope>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // 글로벌 profile 의 default_invoice_template_id 를 로컬 상태로 관리
  // (refetch 시 AppLayout 전체가 다시 로딩 상태로 가는 깜빡임 방지)
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(
    null
  );

  // 최초 / profile 변경 시 로컬 상태 동기화
  useEffect(() => {
    setDefaultTemplateId(profile?.default_invoice_template_id ?? null);
  }, [profile?.default_invoice_template_id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('invoice_email_templates')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setTemplates((data ?? []) as Template[]);
    } catch (err) {
      toast.error(
        `템플릿 로드 실패: ${
          err instanceof Error ? err.message : '알 수 없는 오류'
        }`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (scopeFilter === 'all') return templates;
    return templates.filter((t) => t.scope === scopeFilter);
  }, [templates, scopeFilter]);

  const isMine = useCallback(
    (t: Template) => !!user?.id && t.created_by === user.id,
    [user?.id]
  );

  const openCreate = () => {
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (t: Template) => {
    setForm({
      id: t.id,
      name: t.name,
      subject: t.subject,
      body: t.body,
      scope: t.scope,
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) {
      toast.error('이름, 제목, 본문은 필수입니다.');
      return;
    }
    if (!user?.id) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      if (form.id) {
        // 수정
        const { error } = await supabase
          .from('invoice_email_templates')
          .update({
            name: form.name.trim(),
            subject: form.subject,
            body: form.body,
            scope: form.scope,
          })
          .eq('id', form.id);
        if (error) throw error;
        toast.success('템플릿이 수정되었습니다.');
      } else {
        // 생성
        const { error } = await supabase
          .from('invoice_email_templates')
          .insert({
            name: form.name.trim(),
            subject: form.subject,
            body: form.body,
            scope: form.scope,
            created_by: user.id,
          });
        if (error) throw error;
        toast.success('템플릿이 생성되었습니다.');
      }
      setShowForm(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(
        `저장 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetDefault = async (templateId: string) => {
    if (!profile?.id) return;
    const newValue =
      defaultTemplateId === templateId ? null : templateId; // 같은 거 누르면 해제
    // 낙관적 업데이트 — UI 즉시 반영
    setDefaultTemplateId(newValue);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('user_profiles')
        .update({ default_invoice_template_id: newValue })
        .eq('id', profile.id);
      if (error) throw error;
      toast.success(
        newValue
          ? '기본 템플릿으로 설정되었습니다.'
          : '기본 템플릿 설정이 해제되었습니다.'
      );
    } catch (err) {
      // 실패 시 롤백
      setDefaultTemplateId(defaultTemplateId);
      toast.error(
        `기본 설정 실패: ${
          err instanceof Error ? err.message : '알 수 없는 오류'
        }`
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('invoice_email_templates')
        .delete()
        .eq('id', deleteId);
      if (error) throw error;
      toast.success('템플릿이 삭제되었습니다.');
      setDeleteId(null);
      load();
    } catch (err) {
      toast.error(
        `삭제 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`
      );
    }
  };

  return (
    <AccessControl>
      <div className='space-y-4'>
        <div className='flex items-center justify-between gap-2'>
          <FilterTabs
            value={scopeFilter}
            onValueChange={setScopeFilter}
            options={[
              { value: 'all', label: '전체' },
              { value: 'personal', label: '개인' },
              { value: 'shared', label: '공유' },
            ]}
          />
          <Button onClick={openCreate} size='sm'>
            <Plus className='h-4 w-4 mr-1.5' />
            새 템플릿
          </Button>
        </div>

        {loading ? (
          <div className='grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className='h-32 w-full' />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className='py-12 text-center text-muted-foreground'>
              템플릿이 없습니다. 새 템플릿을 추가해주세요.
            </CardContent>
          </Card>
        ) : (
          <div className='grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
            {filtered.map((t) => {
              const isDefault = defaultTemplateId === t.id;
              return (
              <Card
                key={t.id}
                className={`flex flex-col ${
                  isDefault ? 'border-primary/50 ring-1 ring-primary/30' : ''
                }`}
              >
                <CardHeader className='pb-3'>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='flex-1 min-w-0'>
                      <CardTitle className='text-base flex items-center gap-2 flex-wrap'>
                        {t.name}
                        {t.scope === 'shared' ? (
                          <Badge variant='secondary' className='text-xs'>
                            <Globe className='h-3 w-3 mr-1' />
                            공유
                          </Badge>
                        ) : (
                          <Badge variant='outline' className='text-xs'>
                            <User className='h-3 w-3 mr-1' />
                            개인
                          </Badge>
                        )}
                        {isDefault && (
                          <Badge
                            variant='default'
                            className='text-xs bg-primary'
                          >
                            <Star className='h-3 w-3 mr-1 fill-current' />
                            기본
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className='mt-1 truncate'>
                        {t.subject}
                      </CardDescription>
                    </div>
                    <div className='flex gap-1 flex-shrink-0'>
                      <Button
                        variant='ghost'
                        size='icon'
                        className={`h-7 w-7 ${
                          isDefault
                            ? 'text-amber-500 hover:text-amber-600'
                            : 'text-muted-foreground hover:text-amber-500'
                        }`}
                        onClick={() => handleSetDefault(t.id)}
                        title={
                          isDefault
                            ? '기본 템플릿 해제'
                            : '기본 템플릿으로 설정'
                        }
                      >
                        <Star
                          className={`h-3.5 w-3.5 ${
                            isDefault ? 'fill-current' : ''
                          }`}
                        />
                      </Button>
                      {isMine(t) && (
                        <>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-7 w-7'
                            onClick={() => openEdit(t)}
                          >
                            <Pencil className='h-3.5 w-3.5' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive'
                            onClick={() => setDeleteId(t.id)}
                          >
                            <Trash2 className='h-3.5 w-3.5' />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className='pt-0 flex-1'>
                  <pre className='text-xs whitespace-pre-wrap font-sans text-muted-foreground line-clamp-5'>
                    {t.body}
                  </pre>
                </CardContent>
              </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 생성/수정 다이얼로그 */}
      <Dialog
        open={showForm}
        onOpenChange={(o) => !submitting && !o && setShowForm(false)}
      >
        <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {form.id ? '템플릿 수정' : '새 템플릿'}
            </DialogTitle>
            <DialogDescription>
              제목과 본문에 변수를 사용할 수 있습니다 (예: {'{invoiceNo}'}).
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-3 py-2'>
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1.5'>
                <Label htmlFor='tpl-name'>이름</Label>
                <Input
                  id='tpl-name'
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder='예: 영문 기본 인보이스'
                  autoComplete='off'
                />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='tpl-scope'>공개 범위</Label>
                <Select
                  value={form.scope}
                  onValueChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      scope: v as 'personal' | 'shared',
                    }))
                  }
                >
                  <SelectTrigger id='tpl-scope'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='personal'>
                      <div className='flex items-center gap-2'>
                        <User className='h-3.5 w-3.5' />
                        개인 (본인만)
                      </div>
                    </SelectItem>
                    <SelectItem value='shared'>
                      <div className='flex items-center gap-2'>
                        <Globe className='h-3.5 w-3.5' />
                        공유 (모두)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='tpl-subject'>제목</Label>
              <VariableHighlightedField
                id='tpl-subject'
                value={form.subject}
                onChange={(v) => setForm((p) => ({ ...p, subject: v }))}
                validVariables={TEMPLATE_VARIABLES.map((v) => v.key)}
                placeholder='[Invoice] {invoiceNo} — {fromCompany}'
              />
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='tpl-body'>본문</Label>
              <VariableHighlightedField
                id='tpl-body'
                value={form.body}
                onChange={(v) => setForm((p) => ({ ...p, body: v }))}
                validVariables={TEMPLATE_VARIABLES.map((v) => v.key)}
                multiline
                rows={10}
                placeholder={`Hi {billToCompany},\n\nPlease find attached the invoice {invoiceNo} dated {invoiceDate} for {totalAmount}.\n\nKindly process the payment by the due date indicated on the invoice.\n\nBest regards,\n{fromName}`}
              />
            </div>

            <div className='rounded-md border bg-muted/40 p-3 space-y-2'>
              <div className='flex items-center gap-1.5 text-xs font-semibold text-muted-foreground'>
                <Code className='h-3.5 w-3.5' />
                사용 가능한 변수
              </div>
              <div className='grid grid-cols-2 gap-1.5 text-xs'>
                {TEMPLATE_VARIABLES.map((v) => (
                  <div key={v.key} className='flex items-baseline gap-2'>
                    <code className='bg-background border rounded px-1.5 py-0.5 font-mono text-[11px]'>
                      {`{${v.key}}`}
                    </code>
                    <span className='text-muted-foreground'>{v.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowForm(false)}
              disabled={submitting}
            >
              취소
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '저장 중...' : form.id ? '수정' : '생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title='템플릿 삭제'
        description='이 템플릿을 삭제합니다. 되돌릴 수 없습니다.'
        confirmLabel='삭제'
        cancelLabel='취소'
      />

      <Toaster position='top-center' />
    </AccessControl>
  );
}
