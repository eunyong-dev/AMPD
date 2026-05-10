'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Check, RefreshCw, Eye, EyeOff, Code } from 'lucide-react';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUserContext } from '@/lib/user-context';
import { createClient } from '@/utils/supabase/client';

function generateApiKey(): string {
  // 32자리 hex (짧고 안전)
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return (
    'afk_' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

export function AppsFlyerApiKeyCard() {
  const { profile, refetch } = useUserContext();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [working, setWorking] = useState(false);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const bookmarkletRef = useRef<HTMLAnchorElement | null>(null);

  // profile 변경 시 동기화
  useEffect(() => {
    setApiKey(profile?.appsflyer_api_key ?? null);
  }, [profile?.appsflyer_api_key]);

  const baseUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.origin;
  }, []);

  // API 키 발급/재발급
  const handleGenerate = useCallback(async () => {
    if (!profile?.id) {
      toast.error('프로필 정보가 없습니다.');
      return;
    }
    setWorking(true);
    try {
      const newKey = generateApiKey();
      const supabase = createClient();
      const { error } = await supabase
        .from('user_profiles')
        .update({ appsflyer_api_key: newKey })
        .eq('id', profile.id);
      if (error) throw error;
      setApiKey(newKey);
      setRevealed(true);
      toast.success('API 키가 발급되었습니다.');
      await refetch();
    } catch (err) {
      toast.error(
        `발급 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`
      );
    } finally {
      setWorking(false);
    }
  }, [profile?.id, refetch]);

  const handleRevoke = useCallback(async () => {
    if (!profile?.id) return;
    setWorking(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('user_profiles')
        .update({ appsflyer_api_key: null })
        .eq('id', profile.id);
      if (error) throw error;
      setApiKey(null);
      setRevealed(false);
      toast.success('API 키가 폐기되었습니다.');
      await refetch();
    } catch (err) {
      toast.error(
        `폐기 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`
      );
    } finally {
      setWorking(false);
    }
  }, [profile?.id, refetch]);

  const handleCopy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(key);
      toast.success('클립보드에 복사되었습니다.');
      setTimeout(() => setCopiedItem(null), 1500);
    } catch {
      toast.error('복사 실패');
    }
  }, []);

  // 콘솔용 스크립트 — AMPD 캠페인 리스트 fetch + AppsFlyer 성과 데이터 수집
  const consoleScript = useMemo(() => {
    if (!apiKey || !baseUrl) return '';
    return `// AMPD → AppsFlyer 캠페인 성과 수집
(async () => {
  console.log('🚀 시작...');

  // 1. AMPD 에서 본인 담당 캠페인 리스트
  const ampdRes = await fetch('${baseUrl}/api/external/campaigns', {
    headers: { 'X-API-Key': '${apiKey}' }
  });
  if (!ampdRes.ok) {
    console.error('❌ AMPD API 실패:', ampdRes.status, await ampdRes.text());
    return;
  }
  const { campaigns } = await ampdRes.json();
  console.log(\`📋 AMPD 캠페인 \${campaigns.length}개\`);

  // 날짜 유틸
  const yyyymmdd = (d) => d.toISOString().slice(0, 10);
  const yesterday = yyyymmdd(new Date(Date.now() - 86400000));
  const minus30 = (dateStr) =>
    yyyymmdd(new Date(new Date(dateStr).getTime() - 30 * 86400000));

  // AppsFlyer 응답 → 짧은 컬럼명 매핑
  const fieldMap = {
    'date': 'date',
    'attributionSourceAppsflyerFiltersGranularityMetricIdInstallsPeriod': 'installs',
    'attributionSourceAppsflyerFiltersGranularityMetricIdInstallsUaPeriod': 'installs_ua',
    'filtersGranularityMetricIdClicksPeriod': 'clicks',
    'attributionSourceAppsflyerFiltersGranularityMetricIdEcpiPeriod': 'eCPI',
    'attributionSourceAppsflyerFiltersGranularityMetricIdConvRatePeriod': 'conv_rate',
    'aggregationTypeCumulativeAttributionSourceAppsflyerFiltersGranularityDaysMetricIdRevenuePeriod0': 'D0_revenue',
    'aggregationTypeCumulativeAttributionSourceAppsflyerFiltersGranularityDaysMetricIdRevenuePeriod1': 'D1_revenue',
    'aggregationTypeCumulativeAttributionSourceAppsflyerFiltersGranularityDaysMetricIdRevenuePeriod7': 'D7_revenue',
    'aggregationTypeCumulativeAttributionSourceAppsflyerFiltersGranularityDaysMetricIdRevenuePeriod14': 'D14_revenue',
    'aggregationTypeCumulativeAttributionSourceAppsflyerFiltersGranularityDaysMetricIdRevenuePeriod30': 'D30_revenue',
    'aggregationTypeCumulativeAttributionSourceAppsflyerFiltersGranularityDaysMetricIdRevenuePeriodLtv': 'LTV_revenue',
    'aggregationTypeCumulativeAttributionSourceAppsflyerFiltersGranularityDaysMetricIdRoasPeriodLtv': 'ROAS_LTV',
    'aggregationTypeCumulativeAttributionSourceAppsflyerFiltersGranularityDaysMetricIdRevenuePeriodActivity': 'total_revenue',
  };

  const buildPayload = (campaign, startDate, endDate) => ({
    'dates': { 'start': startDate, 'end': endDate },
    'filters': {
      country: [campaign.region],
      'app-id': [campaign.app_package_identifier]
    },
    'view-type': 'unified',
    'localization': {
      'timezone': campaign.timezone || 'UTC',
      'currency': 'USD'
    },
    'groupings': [{ 'dimension': 'date', 'limit': 31 }],
    'summations': ['totals'],
    'metrics': [
      { 'metric-id': 'installs-ua', 'attribution-source': 'appsflyer', 'filters': {}, 'granularity': '', 'category': 'core', 'period': '', 'platform-id': 'attributionSourceAppsflyerFiltersGranularityMetricIdInstallsUaPeriod' },
      { 'metric-id': 'ecpi', 'attribution-source': 'appsflyer', 'filters': {}, 'granularity': '', 'category': 'calculated', 'period': '', 'platform-id': 'attributionSourceAppsflyerFiltersGranularityMetricIdEcpiPeriod' },
      { 'metric-id': 'revenue', 'attribution-source': 'appsflyer', 'aggregation-type': 'cumulative', 'granularity': 'days', 'category': 'core', 'period': 'ltv', 'filters': {}, 'platform-id': 'aggregationTypeCumulativeAttributionSourceAppsflyerFiltersGranularityDaysMetricIdRevenuePeriodLtv' },
      { 'metric-id': 'roas', 'attribution-source': 'appsflyer', 'aggregation-type': 'cumulative', 'granularity': 'days', 'category': 'calculated', 'period': 'ltv', 'filters': {}, 'platform-id': 'aggregationTypeCumulativeAttributionSourceAppsflyerFiltersGranularityDaysMetricIdRoasPeriodLtv' },
      { 'metric-id': 'clicks', 'filters': {}, 'granularity': '', 'category': 'core', 'period': '', 'attribution-source': '', 'platform-id': 'filtersGranularityMetricIdClicksPeriod' },
      { 'metric-id': 'conv-rate', 'attribution-source': 'appsflyer', 'filters': {}, 'granularity': '', 'category': 'calculated', 'period': '', 'platform-id': 'attributionSourceAppsflyerFiltersGranularityMetricIdConvRatePeriod' },
      { 'metric-id': 'revenue', 'attribution-source': 'appsflyer', 'aggregation-type': 'cumulative', 'granularity': 'days', 'category': 'core', 'period': '0', 'filters': {}, 'platform-id': 'aggregationTypeCumulativeAttributionSourceAppsflyerFiltersGranularityDaysMetricIdRevenuePeriod0' },
      { 'metric-id': 'revenue', 'attribution-source': 'appsflyer', 'aggregation-type': 'cumulative', 'granularity': 'days', 'category': 'core', 'period': '1', 'filters': {}, 'platform-id': 'aggregationTypeCumulativeAttributionSourceAppsflyerFiltersGranularityDaysMetricIdRevenuePeriod1' },
      { 'metric-id': 'revenue', 'attribution-source': 'appsflyer', 'aggregation-type': 'cumulative', 'granularity': 'days', 'category': 'core', 'period': '7', 'filters': {}, 'platform-id': 'aggregationTypeCumulativeAttributionSourceAppsflyerFiltersGranularityDaysMetricIdRevenuePeriod7' },
      { 'metric-id': 'revenue', 'attribution-source': 'appsflyer', 'aggregation-type': 'cumulative', 'granularity': 'days', 'category': 'core', 'period': '14', 'filters': {}, 'platform-id': 'aggregationTypeCumulativeAttributionSourceAppsflyerFiltersGranularityDaysMetricIdRevenuePeriod14' },
      { 'metric-id': 'revenue', 'attribution-source': 'appsflyer', 'aggregation-type': 'cumulative', 'granularity': 'days', 'category': 'core', 'period': '30', 'filters': {}, 'platform-id': 'aggregationTypeCumulativeAttributionSourceAppsflyerFiltersGranularityDaysMetricIdRevenuePeriod30' },
      { 'metric-id': 'revenue', 'attribution-source': 'appsflyer', 'aggregation-type': 'cumulative', 'granularity': 'days', 'category': 'core', 'period': 'activity', 'filters': {}, 'platform-id': 'aggregationTypeCumulativeAttributionSourceAppsflyerFiltersGranularityDaysMetricIdRevenuePeriodActivity' },
      { 'metric-id': 'installs', 'attribution-source': 'appsflyer', 'filters': {}, 'granularity': '', 'category': 'core', 'period': '', 'sort-by': { 'order': 'desc', 'priority': 0 }, 'platform-id': 'attributionSourceAppsflyerFiltersGranularityMetricIdInstallsPeriod' }
    ],
    'format': 'json',
    'granularity': 'days',
    'implicit-sorting': true
  });

  // 2. 각 캠페인별 성과 fetch
  const results = [];
  for (const c of campaigns) {
    if (!c.app_package_identifier) {
      console.warn(\`⏭️  \${c.name} — 앱 패키지명 없음, 스킵\`);
      continue;
    }

    // 종료일: holding 이면 end_date, 아니면 어제
    const endDate =
      c.status === 'holding' && c.end_date ? c.end_date : yesterday;
    // 시작일: end-30일 vs 캠페인 start_date 중 늦은 쪽
    const start30 = minus30(endDate);
    const startDate =
      c.start_date && c.start_date > start30 ? c.start_date : start30;

    console.log(
      \`📊 \${c.name} (\${c.region} / \${c.timezone || 'UTC'}) — \${startDate} ~ \${endDate}\`
    );

    try {
      const r = await fetch(
        'https://hq1.appsflyer.com/platform/dashboard?widget=platform-widget:0',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(buildPayload(c, startDate, endDate)),
          credentials: 'include',
        }
      );
      if (!r.ok) {
        console.error(\`  ❌ \${c.name} HTTP \${r.status}\`);
        continue;
      }
      const data = await r.json();
      let rows = Array.isArray(data)
        ? data
        : data.data || data.results || null;
      if (!Array.isArray(rows)) {
        for (const k in data) {
          if (Array.isArray(data[k])) {
            rows = data[k];
            break;
          }
        }
      }
      const cleaned = (rows || []).map((row) => {
        const o = {};
        for (const k in row) {
          const nk = fieldMap[k] || k;
          let v = row[k];
          if (typeof v === 'number') v = Math.round(v * 100) / 100;
          o[nk] = v;
        }
        return o;
      });

      console.log(\`  → \${cleaned.length}일 데이터\`);
      console.table(cleaned);

      results.push({
        campaign: c.name,
        region: c.region,
        timezone: c.timezone || 'UTC',
        period: { start: startDate, end: endDate },
        sheet_url: c.sheet_url,
        rows: cleaned,
      });
    } catch (e) {
      console.error(\`  ❌ \${c.name} 에러:\`, e);
    }
  }

  window.ampdPerformance = results;
  console.log(\`\\n✅ 완료 — \${results.length}/\${campaigns.length} 캠페인\`);
  console.log('💡 window.ampdPerformance 에 전체 결과 저장');
})();`;
  }, [apiKey, baseUrl]);

  // 북마클릿 (한 줄 javascript: URL — 북마크바에 드래그)
  const bookmarklet = useMemo(() => {
    if (!consoleScript) return '';
    // IIFE 형식으로 그대로 인코딩 — 북마크 매니저에서 펼쳐서 봐도 동일
    return `javascript:${encodeURIComponent(consoleScript)}`;
  }, [consoleScript]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Code className='h-5 w-5' />
          AppsFlyer 연동 — API 키
        </CardTitle>
        <CardDescription>
          AppsFlyer 콘솔/북마클릿에서 AMPD 의 캠페인 데이터를 불러올 때 사용하는
          개인 키입니다. 외부에 공유하지 마세요.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {!apiKey ? (
          <div className='flex items-center gap-3'>
            <p className='text-sm text-muted-foreground flex-1'>
              아직 발급된 키가 없습니다.
            </p>
            <Button onClick={handleGenerate} disabled={working} size='sm'>
              <RefreshCw
                className={`h-4 w-4 mr-1.5 ${working ? 'animate-spin' : ''}`}
              />
              API 키 발급
            </Button>
          </div>
        ) : (
          <>
            {/* API 키 */}
            <div>
              <label className='text-xs font-semibold text-muted-foreground'>
                API 키
              </label>
              <div className='flex items-center gap-2 mt-1'>
                <code className='flex-1 px-3 py-2 bg-muted rounded-md font-mono text-sm break-all select-all'>
                  {revealed ? apiKey : '•'.repeat(apiKey.length)}
                </code>
                <Button
                  variant='outline'
                  size='icon'
                  onClick={() => setRevealed((v) => !v)}
                  title={revealed ? '숨기기' : '보기'}
                >
                  {revealed ? (
                    <EyeOff className='h-4 w-4' />
                  ) : (
                    <Eye className='h-4 w-4' />
                  )}
                </Button>
                <Button
                  variant='outline'
                  size='icon'
                  onClick={() => handleCopy(apiKey, 'key')}
                  title='복사'
                >
                  {copiedItem === 'key' ? (
                    <Check className='h-4 w-4 text-green-600' />
                  ) : (
                    <Copy className='h-4 w-4' />
                  )}
                </Button>
              </div>
            </div>

            {/* 북마클릿 (추천) */}
            <div className='rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2'>
              <div className='flex items-center justify-between gap-2'>
                <div>
                  <div className='text-sm font-semibold'>
                    북마클릿 (추천)
                  </div>
                  <p className='text-xs text-muted-foreground mt-0.5'>
                    아래 버튼을 <strong>북마크바로 드래그</strong> 해서
                    추가하세요. AppsFlyer 페이지에서 클릭하면 즉시 실행됩니다.
                  </p>
                </div>
              </div>
              <div className='flex items-center gap-2'>
                {/* React 가 javascript: href 를 막으므로 ref + setAttribute 로 우회 */}
                {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                <a
                  ref={(el) => {
                    bookmarkletRef.current = el;
                    if (el && bookmarklet) {
                      el.setAttribute('href', bookmarklet);
                    }
                  }}
                  className='inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-grab active:cursor-grabbing hover:opacity-90'
                  draggable
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info(
                      '클릭이 아닌 드래그로 북마크바에 추가하세요.'
                    );
                  }}
                >
                  <Code className='h-4 w-4' />
                  AMPD 캠페인 불러오기
                </a>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => handleCopy(bookmarklet, 'bookmarklet')}
                >
                  {copiedItem === 'bookmarklet' ? (
                    <>
                      <Check className='h-3.5 w-3.5 mr-1 text-green-600' />
                      복사됨
                    </>
                  ) : (
                    <>
                      <Copy className='h-3.5 w-3.5 mr-1' />
                      URL 복사
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* 콘솔용 스크립트 (대체) */}
            <details className='group'>
              <summary className='cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none flex items-center gap-1'>
                <span className='group-open:rotate-90 transition-transform'>
                  ▶
                </span>
                콘솔용 스크립트 (대체 방법)
              </summary>
              <div className='mt-2'>
                <div className='flex items-center justify-between mb-1'>
                  <span className='text-xs font-semibold text-muted-foreground'>
                    F12 콘솔에 붙여넣기
                  </span>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-6 px-2 text-xs'
                    onClick={() => handleCopy(consoleScript, 'script')}
                  >
                    {copiedItem === 'script' ? (
                      <>
                        <Check className='h-3 w-3 mr-1 text-green-600' />
                        복사됨
                      </>
                    ) : (
                      <>
                        <Copy className='h-3 w-3 mr-1' />
                        스크립트 복사
                      </>
                    )}
                  </Button>
                </div>
                <pre className='p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto max-h-48 leading-relaxed'>
                  {consoleScript}
                </pre>
                <p className='text-xs text-muted-foreground mt-1.5'>
                  AppsFlyer 페이지에서 개발자 도구(F12) → Console 탭에
                  붙여넣기 후 실행. 키가 콘솔에 노출되니 화면 공유 시 주의.
                </p>
              </div>
            </details>

            {/* 액션 */}
            <div className='flex items-center gap-2 pt-2 border-t'>
              <Button
                variant='outline'
                size='sm'
                onClick={handleGenerate}
                disabled={working}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1.5 ${working ? 'animate-spin' : ''}`}
                />
                재발급
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={handleRevoke}
                disabled={working}
                className='text-destructive hover:bg-destructive/10 hover:text-destructive'
              >
                폐기
              </Button>
              <p className='text-xs text-muted-foreground ml-auto'>
                재발급 시 기존 키는 즉시 무효화됩니다.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
