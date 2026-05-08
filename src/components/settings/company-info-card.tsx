'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Building2, Save, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/utils/supabase/client';
import type { Database } from '@/lib/database.types';

const STAMP_BUCKET = 'company-assets';
const STAMP_PATH = 'stamps/company-stamp';

type CompanyInfoRow = Database['public']['Tables']['company_info']['Row'];

type FormState = {
  name: string;
  email: string;
  address: string;
  beneficiary_name: string;
  beneficiary_address: string;
  bank_name: string;
  bank_account_number: string;
  bank_swift_code: string;
  payment_method: string;
  bank_address: string;
  stamp_url: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  address: '',
  beneficiary_name: '',
  beneficiary_address: '',
  bank_name: '',
  bank_account_number: '',
  bank_swift_code: '',
  payment_method: '',
  bank_address: '',
  stamp_url: '',
};

export function CompanyInfoCard() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('company_info')
        .select('*')
        .eq('id', 1)
        .single();

      if (error) throw error;
      const row = data as CompanyInfoRow;
      setForm({
        name: row.name ?? '',
        email: row.email ?? '',
        address: row.address ?? '',
        beneficiary_name: row.beneficiary_name ?? '',
        beneficiary_address: row.beneficiary_address ?? '',
        bank_name: row.bank_name ?? '',
        bank_account_number: row.bank_account_number ?? '',
        bank_swift_code: row.bank_swift_code ?? '',
        payment_method: row.payment_method ?? '',
        bank_address: row.bank_address ?? '',
        stamp_url: row.stamp_url ?? '',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      toast.error(`회사 정보 불러오기 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleStampUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 검증
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
      toast.error('PNG, JPEG, WebP, SVG 파일만 업로드 가능합니다.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('5MB 이하 파일만 업로드 가능합니다.');
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      // 확장자 추출 + 타임스탬프 (캐시 무효화용)
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const filePath = `${STAMP_PATH}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(STAMP_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // public URL 생성
      const { data: urlData } = supabase.storage
        .from(STAMP_BUCKET)
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // company_info 즉시 업데이트
      const { error: updateError } = await supabase
        .from('company_info')
        .update({
          stamp_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);

      if (updateError) throw updateError;

      setForm((prev) => ({ ...prev, stamp_url: publicUrl }));
      toast.success('도장 이미지가 업로드되었습니다.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      toast.error(`도장 업로드 실패: ${msg}`);
    } finally {
      setUploading(false);
      // 동일 파일 재선택을 위해 input value 초기화
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleStampRemove = async () => {
    setUploading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('company_info')
        .update({
          stamp_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);
      if (error) throw error;
      setForm((prev) => ({ ...prev, stamp_url: '' }));
      toast.success('도장 이미지가 제거되었습니다.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      toast.error(`도장 제거 실패: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('company_info')
        .update({
          name: form.name,
          email: form.email,
          address: form.address,
          beneficiary_name: form.beneficiary_name,
          beneficiary_address: form.beneficiary_address,
          bank_name: form.bank_name,
          bank_account_number: form.bank_account_number,
          bank_swift_code: form.bank_swift_code,
          payment_method: form.payment_method,
          bank_address: form.bank_address,
          stamp_url: form.stamp_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);

      if (error) throw error;
      toast.success('회사 정보가 저장되었습니다.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      toast.error(`회사 정보 저장 실패: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Building2 className='h-5 w-5' />
          회사 정보 (FROM)
        </CardTitle>
        <CardDescription>
          인보이스 발행 시 FROM/Payment Information 영역에 사용됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className='space-y-3'>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className='h-10 w-full' />
            ))}
          </div>
        ) : (
          <div className='space-y-6'>
            <div className='space-y-2'>
              <Label htmlFor='ci-name'>회사명 (Name)</Label>
              <Input
                id='ci-name'
                value={form.name}
                onChange={handleChange('name')}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='ci-address'>회사 주소 (Address)</Label>
              <Input
                id='ci-address'
                value={form.address}
                onChange={handleChange('address')}
              />
              <p className='text-xs text-muted-foreground'>
                인보이스 FROM 영역의 이메일은 발행자(담당자)의 이메일이
                자동으로 들어갑니다.
              </p>
            </div>

            <div className='border-t pt-4 space-y-4'>
              <div className='text-sm font-semibold text-muted-foreground'>
                Payment Information
              </div>
              <div className='grid gap-4 md:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='ci-bn'>Beneficiary Name</Label>
                  <Input
                    id='ci-bn'
                    value={form.beneficiary_name}
                    onChange={handleChange('beneficiary_name')}
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='ci-ba'>Beneficiary Address</Label>
                  <Input
                    id='ci-ba'
                    value={form.beneficiary_address}
                    onChange={handleChange('beneficiary_address')}
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='ci-bank'>Bank Name</Label>
                  <Input
                    id='ci-bank'
                    value={form.bank_name}
                    onChange={handleChange('bank_name')}
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='ci-bacc'>Bank Account Number</Label>
                  <Input
                    id='ci-bacc'
                    value={form.bank_account_number}
                    onChange={handleChange('bank_account_number')}
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='ci-swift'>Bank Swift Code</Label>
                  <Input
                    id='ci-swift'
                    value={form.bank_swift_code}
                    onChange={handleChange('bank_swift_code')}
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='ci-pm'>Payment Method</Label>
                  <Input
                    id='ci-pm'
                    value={form.payment_method}
                    onChange={handleChange('payment_method')}
                  />
                </div>
                <div className='space-y-2 md:col-span-2'>
                  <Label htmlFor='ci-bankaddr'>Bank Address</Label>
                  <Input
                    id='ci-bankaddr'
                    value={form.bank_address}
                    onChange={handleChange('bank_address')}
                  />
                </div>
              </div>
            </div>

            <div className='border-t pt-4 space-y-2'>
              <Label>도장 이미지 (Stamp)</Label>
              <div className='flex items-center gap-4'>
                {form.stamp_url ? (
                  <div className='relative inline-block'>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.stamp_url}
                      alt='Stamp'
                      className='h-24 w-24 object-contain border rounded bg-white'
                    />
                  </div>
                ) : (
                  <div className='h-24 w-24 border border-dashed rounded flex items-center justify-center text-xs text-muted-foreground'>
                    없음
                  </div>
                )}
                <div className='space-y-2'>
                  <input
                    ref={fileInputRef}
                    type='file'
                    accept='image/png,image/jpeg,image/webp,image/svg+xml'
                    onChange={handleStampUpload}
                    disabled={uploading}
                    className='hidden'
                  />
                  <div className='flex gap-2'>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Upload className='h-4 w-4 mr-2' />
                      {uploading
                        ? '업로드 중...'
                        : form.stamp_url
                        ? '교체'
                        : '업로드'}
                    </Button>
                    {form.stamp_url && (
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={handleStampRemove}
                        disabled={uploading}
                      >
                        <X className='h-4 w-4 mr-2' />
                        제거
                      </Button>
                    )}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    PNG / JPEG / WebP / SVG, 최대 5MB
                  </p>
                </div>
              </div>
            </div>

            <div className='flex justify-end pt-2'>
              <Button onClick={handleSave} disabled={saving} size='sm'>
                <Save
                  className={`h-4 w-4 mr-2 ${saving ? 'animate-pulse' : ''}`}
                />
                {saving ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
