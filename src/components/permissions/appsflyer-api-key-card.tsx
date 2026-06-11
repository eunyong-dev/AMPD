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
  const appsflyerBookmarkletRef = useRef<HTMLAnchorElement | null>(null);
  const adjustBookmarkletRef = useRef<HTMLAnchorElement | null>(null);

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

  // ────────────────────────────────────────────────────────────
  // AppsFlyer 콘솔용 스크립트
  // ────────────────────────────────────────────────────────────
  const appsflyerConsoleScript = useMemo(() => {
    if (!apiKey || !baseUrl) return '';
    return `// AMPD 시트 동기화 — AppsFlyer
(async () => {
  // ========== 진행상황 UI ==========
  const existing = document.getElementById('__ampd_sync_ui');
  if (existing) existing.remove();
  const ui = document.createElement('div');
  ui.id = '__ampd_sync_ui';
  ui.style.cssText = 'position:fixed;bottom:20px;right:20px;width:380px;background:#0f172a;color:#e2e8f0;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.4);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;z-index:2147483647;overflow:hidden;font-size:13px;';
  ui.innerHTML = '<div style="padding:14px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #1e293b;font-weight:600;"><span id="__ampd_spinner" style="display:inline-block;width:14px;height:14px;border:2px solid #3b82f6;border-top-color:transparent;border-radius:50%;animation:__ampd_spin 0.8s linear infinite;"></span><span style="flex:1;">AMPD 시트 동기화 (AppsFlyer)</span><button id="__ampd_close" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:18px;line-height:1;padding:0;">×</button></div><div id="__ampd_status" style="padding:12px 16px;color:#cbd5e1;line-height:1.5;">시작합니다...</div><div id="__ampd_log" style="max-height:200px;overflow-y:auto;padding:0 16px 12px;font-size:11px;line-height:1.6;color:#94a3b8;"></div>';
  document.body.appendChild(ui);
  const styleTag = document.createElement('style');
  styleTag.textContent = '@keyframes __ampd_spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(styleTag);
  const setStatus = (text, color) => {
    const el = document.getElementById('__ampd_status');
    if (el) {
      el.textContent = text;
      if (color) el.style.color = color;
    }
  };
  const addLog = (text, color) => {
    const el = document.getElementById('__ampd_log');
    if (!el) return;
    const line = document.createElement('div');
    line.textContent = text;
    if (color) line.style.color = color;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  };
  const stopSpinner = (success) => {
    const sp = document.getElementById('__ampd_spinner');
    if (sp) {
      sp.style.animation = '';
      sp.style.border = '0';
      sp.style.background = success ? '#22c55e' : '#ef4444';
      sp.style.borderRadius = '50%';
    }
  };
  document.getElementById('__ampd_close')?.addEventListener('click', () => ui.remove());

  console.log('🚀 시작...');

  // 1. AMPD 에서 본인 담당 캠페인 리스트
  setStatus('AMPD 캠페인 리스트 로드 중...');
  const ampdRes = await fetch('${baseUrl}/api/external/campaigns', {
    headers: { 'X-API-Key': '${apiKey}' }
  });
  if (!ampdRes.ok) {
    console.error('❌ AMPD API 실패:', ampdRes.status, await ampdRes.text());
    setStatus('❌ AMPD API 호출 실패', '#fca5a5');
    stopSpinner(false);
    return;
  }
  const { campaigns } = await ampdRes.json();
  console.log(\`📋 AMPD 캠페인 \${campaigns.length}개\`);
  addLog(\`📋 캠페인 \${campaigns.length}개 발견\`);

  // 날짜 유틸 — 캠페인 타임존 기준
  const yyyymmddInTz = (date, tz) => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
    } catch {
      // 잘못된 타임존이면 UTC fallback
      return date.toISOString().slice(0, 10);
    }
  };
  // 해당 타임존 기준 오늘 (YYYY-MM-DD)
  const todayInTz = (tz) => yyyymmddInTz(new Date(), tz);
  // 주어진 YYYY-MM-DD 에서 N일 전
  const minusDays = (dateStr, n) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - n);
    return dt.toISOString().slice(0, 10);
  };
  // 가져올 범위: endDate 포함 40일 (endDate - 39일 ~ endDate)
  const RANGE_DAYS = 40;

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
    'groupings': [{ 'dimension': 'date', 'limit': 41 }],
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
  const skippedList = []; // {name, missing: []} — 마지막에 요약용
  let processed = 0;
  let totalMatched = 0;
  let totalFilled = 0;
  let totalAppended = 0;

  for (const c of campaigns) {
    processed++;

    // 필수 필드 체크 — 누락된 거 한 번에 모아서 보고
    const missing = [];
    if (!c.app_package_identifier) missing.push('Package/Bundle ID');
    if (!c.timezone) missing.push('타임존');
    if (!c.sheet_url) missing.push('Daily Report URL');
    if (missing.length > 0) {
      skippedList.push({ name: c.name, missing });
      console.warn(\`⏭️ \${c.name} — 누락: \${missing.join(', ')}\`);
      addLog(
        \`⏭️ [\${processed}/\${campaigns.length}] \${c.name} — 누락: \${missing.join(', ')}\`,
        '#fbbf24'
      );
      continue;
    }

    // 종료일: holding/end 상태면 end_date, 아니면 한국시간 기준 오늘 (모든 캠페인 동일)
    const isClosed = c.status === 'holding' || c.status === 'end';
    const endDate =
      isClosed && c.end_date ? c.end_date : todayInTz('Asia/Seoul');
    // 시작일: endDate - 39일 (40일 포함) vs 캠페인 start_date 중 늦은 쪽
    const rangeStart = minusDays(endDate, RANGE_DAYS - 1);
    const startDate =
      c.start_date && c.start_date > rangeStart ? c.start_date : rangeStart;

    console.log(
      \`📊 \${c.name} (\${c.region} / \${c.timezone}) — \${startDate} ~ \${endDate}\`
    );
    setStatus(\`▶ [\${processed}/\${campaigns.length}] \${c.name}\`);

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
        addLog(\`❌ \${c.name} — AppsFlyer HTTP \${r.status}\`, '#fca5a5');
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

      // 시트에 적재 — 위에서 sheet_url 누락 캠페인은 이미 스킵됨
      // quota(분당 읽기 한도) 초과 시 대기 후 재시도 (될 때까지 최대 5회)
      if (cleaned.length > 0) {
        let syncData = null;
        let syncOk = false;
        for (let attempt = 1; attempt <= 5; attempt++) {
          try {
            const syncRes = await fetch('${baseUrl}/api/external/sync-sheet', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-API-Key': '${apiKey}',
              },
              body: JSON.stringify({ sheet_url: c.sheet_url, rows: cleaned }),
            });
            syncData = await syncRes.json();
            if (syncRes.ok) {
              syncOk = true;
              break;
            }
            const isQuota =
              syncRes.status === 429 ||
              /quota|read requests|rate limit/i.test(syncData.error || '');
            if (isQuota && attempt < 5) {
              const waitMs = 10000 * attempt; // 10s,20s,30s,40s
              addLog(
                \`  ⏳ \${c.name} — 시트 quota 초과, \${waitMs / 1000}초 후 재시도 (\${attempt}/4)\`,
                '#fbbf24'
              );
              await new Promise((r) => setTimeout(r, waitMs));
              continue;
            }
            break; // quota 외 에러는 중단
          } catch (syncErr) {
            console.error('  ❌ 시트 적재 오류:', syncErr);
            if (attempt < 5) {
              await new Promise((r) => setTimeout(r, 5000));
              continue;
            }
          }
        }
        if (syncOk && syncData) {
          console.log(
            \`  📥 시트 [\${syncData.sheet_title}] — 매칭 \${syncData.matched} / 신규 \${syncData.filled} / 추가 \${syncData.appended}\`
          );
          addLog(
            \`✅ \${c.name} — 매칭 \${syncData.matched}, 신규 \${syncData.filled}\${syncData.appended ? ', 추가 ' + syncData.appended : ''}\`,
            '#86efac'
          );
          totalMatched += syncData.matched;
          totalFilled += syncData.filled;
          totalAppended += syncData.appended;
          if (syncData.warnings && syncData.warnings.length > 0) {
            syncData.warnings.forEach((w) => {
              console.warn(\`  ⚠️ \${w}\`);
              addLog(\`  ⚠️ \${w}\`, '#fbbf24');
            });
          }
        } else {
          addLog(
            \`  ❌ 시트 적재 실패: \${(syncData && syncData.error) || '알 수 없음'}\`,
            '#fca5a5'
          );
        }
      }

      results.push({
        campaign: c.name,
        region: c.region,
        timezone: c.timezone,
        period: { start: startDate, end: endDate },
        sheet_url: c.sheet_url,
        rows: cleaned,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(\`  ❌ \${c.name} 에러:\`, e);
      addLog(\`❌ \${c.name} — \${msg}\`, '#fca5a5');
    }
  }

  window.ampdPerformance = results;
  window.ampdSkipped = skippedList;
  console.log(\`\\n✅ 완료 — 성공 \${results.length} / 스킵 \${skippedList.length} / 전체 \${campaigns.length}\`);
  if (skippedList.length > 0) {
    console.warn('⚠️ 스킵된 캠페인:');
    console.table(skippedList.map((s) => ({ 캠페인: s.name, 누락된_필드: s.missing.join(', ') })));
  }
  console.log('💡 window.ampdPerformance 에 전체 결과 저장');

  // 스킵 요약 — 로그 영역에 별도 섹션
  if (skippedList.length > 0) {
    addLog(' ', undefined);
    addLog(\`━━━━━━━━━━ 스킵 요약 (\${skippedList.length}) ━━━━━━━━━━\`, '#fbbf24');
    // 누락 필드 별 그룹핑
    const byReason = {};
    for (const s of skippedList) {
      for (const m of s.missing) {
        if (!byReason[m]) byReason[m] = [];
        byReason[m].push(s.name);
      }
    }
    for (const reason in byReason) {
      addLog(\`• \${reason} 누락 (\${byReason[reason].length}):\`, '#fbbf24');
      for (const name of byReason[reason]) {
        addLog(\`   - \${name}\`, '#fde68a');
      }
    }
  }

  setStatus(
    \`✅ 완료 — 성공 \${results.length} / 스킵 \${skippedList.length} / 전체 \${campaigns.length} (매칭 \${totalMatched} / 신규 \${totalFilled}\${totalAppended ? ' / 추가 ' + totalAppended : ''})\`,
    skippedList.length > 0 ? '#fbbf24' : '#86efac'
  );
  stopSpinner(true);
  // 자동 닫지 않음 — 사용자가 × 버튼으로 직접 닫음
})();`;
  }, [apiKey, baseUrl]);

  // ────────────────────────────────────────────────────────────
  // Adjust 콘솔용 스크립트 — automate.adjust.com 호출
  // ────────────────────────────────────────────────────────────
  const adjustConsoleScript = useMemo(() => {
    if (!apiKey || !baseUrl) return '';
    return `// AMPD 시트 동기화 — Adjust
(async () => {
  // ========== 진행상황 UI ==========
  const existing = document.getElementById('__ampd_sync_ui');
  if (existing) existing.remove();
  const ui = document.createElement('div');
  ui.id = '__ampd_sync_ui';
  ui.style.cssText = 'position:fixed;bottom:20px;right:20px;width:380px;background:#0f172a;color:#e2e8f0;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.4);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;z-index:2147483647;overflow:hidden;font-size:13px;';
  ui.innerHTML = '<div style="padding:14px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #1e293b;font-weight:600;"><span id="__ampd_spinner" style="display:inline-block;width:14px;height:14px;border:2px solid #a78bfa;border-top-color:transparent;border-radius:50%;animation:__ampd_spin 0.8s linear infinite;"></span><span style="flex:1;">AMPD 시트 동기화 (Adjust)</span><button id="__ampd_close" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:18px;line-height:1;padding:0;">×</button></div><div id="__ampd_status" style="padding:12px 16px;color:#cbd5e1;line-height:1.5;">시작합니다...</div><div id="__ampd_log" style="max-height:200px;overflow-y:auto;padding:0 16px 12px;font-size:11px;line-height:1.6;color:#94a3b8;"></div>';
  document.body.appendChild(ui);
  const styleTag = document.createElement('style');
  styleTag.textContent = '@keyframes __ampd_spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(styleTag);
  const setStatus = (text, color) => {
    const el = document.getElementById('__ampd_status');
    if (el) {
      el.textContent = text;
      if (color) el.style.color = color;
    }
  };
  const addLog = (text, color) => {
    const el = document.getElementById('__ampd_log');
    if (!el) return;
    const line = document.createElement('div');
    line.textContent = text;
    if (color) line.style.color = color;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  };
  const stopSpinner = (success) => {
    const sp = document.getElementById('__ampd_spinner');
    if (sp) {
      sp.style.animation = '';
      sp.style.border = '0';
      sp.style.background = success ? '#22c55e' : '#ef4444';
      sp.style.borderRadius = '50%';
    }
  };
  document.getElementById('__ampd_close')?.addEventListener('click', () => ui.remove());

  console.log('🚀 시작 (Adjust)...');

  // 1. AMPD 에서 본인 담당 캠페인 (Adjust 전용) 리스트
  setStatus('AMPD 캠페인 리스트 로드 중...');
  const ampdRes = await fetch('${baseUrl}/api/external/campaigns', {
    headers: { 'X-API-Key': '${apiKey}' }
  });
  if (!ampdRes.ok) {
    console.error('❌ AMPD API 실패:', ampdRes.status, await ampdRes.text());
    setStatus('❌ AMPD API 호출 실패', '#fca5a5');
    stopSpinner(false);
    return;
  }
  const { campaigns } = await ampdRes.json();
  console.log(\`📋 Adjust 캠페인 \${campaigns.length}개\`);
  addLog(\`📋 캠페인 \${campaigns.length}개 발견\`);

  // 날짜 유틸 — 타임존 기준
  const yyyymmddInTz = (date, tz) => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
    } catch {
      return date.toISOString().slice(0, 10);
    }
  };
  // 해당 타임존 기준 오늘 (YYYY-MM-DD)
  const todayInTz = (tz) => yyyymmddInTz(new Date(), tz);
  // 주어진 YYYY-MM-DD 에서 N일 전
  const minusDays = (dateStr, n) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - n);
    return dt.toISOString().slice(0, 10);
  };
  // 가져올 범위: endDate 포함 40일 (endDate - 39일 ~ endDate)
  const RANGE_DAYS = 40;

  // 타임존 (IANA) → UTC offset 문자열 '+09:00'
  const tzToUtcOffset = (tz) => {
    if (!tz) return '+00:00';
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'longOffset',
      });
      const parts = formatter.formatToParts(new Date());
      const tzName = parts.find((p) => p.type === 'timeZoneName')?.value || '';
      // 'GMT+9' / 'GMT+09:00' / 'GMT-05:00' / 'GMT'
      if (tzName === 'GMT' || tzName === 'UTC') return '+00:00';
      const m = tzName.match(/GMT([+-])(\\d{1,2})(?::?(\\d{2}))?/);
      if (!m) return '+00:00';
      const sign = m[1];
      const hh = m[2].padStart(2, '0');
      const mm = (m[3] || '00').padStart(2, '0');
      return \`\${sign}\${hh}:\${mm}\`;
    } catch {
      return '+00:00';
    }
  };

  // Adjust 응답 → AMPD/시트 컬럼명으로 매핑
  // sync-sheet 의 FIELD_TO_HEADER 가 AppsFlyer 키 사용 → 동일하게 맞춤
  const mapAdjustRow = (row) => {
    const get = (k) => {
      const v = row[k];
      if (v === null || v === undefined || v === '') return null;
      if (typeof v === 'number') return Math.round(v * 100) / 100;
      const n = Number(v);
      return Number.isFinite(n) ? Math.round(n * 100) / 100 : v;
    };
    return {
      date: row.day,
      installs: get('installs'),
      // attribution_clicks (광고 클릭) — 일반 clicks 보다 더 정확
      clicks: get('attribution_clicks') ?? get('clicks'),
      // cohort_all_revenue (광고+IAP 코호트 합계) → LTV_revenue
      LTV_revenue: get('cohort_all_revenue'),
      D0_revenue: get('all_revenue_total_d0'),
      D1_revenue: get('all_revenue_total_d1'),
      D7_revenue: get('all_revenue_total_d7'),
      D14_revenue: get('all_revenue_total_d14'),
      D30_revenue: get('all_revenue_total_d30'),
    };
  };

  // 1.5. Adjust 어카운트 준비 — 직접 switch 방식
  // - 현재 어카운트 ID 조회 (마지막에 복원용)
  // - switchAccount / fetchPackageMap 헬퍼 정의
  setStatus('Adjust 어카운트 정보 확인 중...');

  // 현재 어카운트 ID 조회 — 여러 후보 endpoint 시도 (Adjust 가 경로 자주 바꿈)
  let originalAccountId = null;
  const currentAccountUrls = [
    'https://api.adjust.com/accounts/current_account',
    'https://api.adjust.com/api/v3/current_account',
    'https://api.adjust.com/dashboard/api/current_account',
    'https://api.adjust.com/dashboard/api/current_user',
  ];
  for (const url of currentAccountUrls) {
    try {
      const r = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (r.ok) {
        const d = await r.json();
        originalAccountId =
          d.account?.id ||
          d.id ||
          d.account_id ||
          d.current_account?.id ||
          d.user?.account_id ||
          d.user?.account?.id ||
          null;
        if (originalAccountId) {
          console.log(\`🔍 현재 어카운트 감지: \${originalAccountId} (\${url})\`);
          break;
        }
      }
    } catch (e) {
      // 다음 URL 시도
    }
  }
  if (!originalAccountId) {
    console.warn(
      '⚠️ 현재 어카운트 ID 감지 실패 — 종료 후 복원 안됨 (수동 전환 필요)'
    );
  }

  // 어카운트 전환 헬퍼
  const switchAccount = async (accountId) => {
    try {
      const r = await fetch('https://api.adjust.com/accounts/accounts/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ account_id: accountId, skip_redirect: true }),
      });
      return r.ok;
    } catch (e) {
      return false;
    }
  };

  // 현재 어카운트의 apps → package_id → app_token 매핑 빌드
  // cache-bust 파라미터로 브라우저/CDN 캐시 회피 (switch 직후 stale 응답 방지)
  const fetchPackageMap = async () => {
    try {
      const r = await fetch(
        \`https://api.adjust.com/dashboard/api/apps?ctv=false&_t=\${Date.now()}\`,
        {
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
        }
      );
      if (!r.ok) return null;
      const d = await r.json();
      const map = new Map();
      const tokens = new Set();
      for (const a of d.apps || []) {
        const token = a.app_token || a.token;
        if (!token) continue;
        tokens.add(token);
        const platforms = a.platforms || {};
        for (const platKey in platforms) {
          const plat = platforms[platKey];
          if (plat && plat.app_id) map.set(String(plat.app_id), token);
        }
        if (a.default_store_app_id) {
          map.set(String(a.default_store_app_id), token);
        }
      }
      return { map, tokens };
    } catch (e) {
      return null;
    }
  };

  // 2. 사전 검증: 필수 필드 누락 캠페인 분리 (timezone / sheet_url / package / adjust_account_id)
  const results = [];
  const skippedList = []; // {name, missing: []} — 마지막에 요약용
  let totalMatched = 0;
  let totalFilled = 0;
  let totalAppended = 0;
  let processedCount = 0;

  const validCampaigns = [];
  for (const c of campaigns) {
    const missing = [];
    if (!c.timezone) missing.push('타임존');
    if (!c.sheet_url) missing.push('Daily Report URL');
    if (!c.app_package_identifier) {
      missing.push('Package Identifier');
    }
    if (!c.adjust_account_id) {
      missing.push('Adjust Account ID (광고주 설정)');
    }
    if (missing.length > 0) {
      skippedList.push({ name: c.name, missing });
      addLog(
        \`⏭️ \${c.name} — 누락: \${missing.join(', ')}\`,
        '#fbbf24'
      );
    } else {
      validCampaigns.push(c);
    }
  }

  // 3. adjust_account_id 별로 캠페인 그룹핑
  // 같은 Adjust 어카운트의 캠페인끼리 묶어서 switch 한 번에 모두 sync
  const groups = new Map(); // adjustAccountId → { campaigns: [], company: '' }
  for (const c of validCampaigns) {
    const key = c.adjust_account_id;
    if (!groups.has(key)) {
      groups.set(key, {
        campaigns: [],
        company: c.account_company || \`Adjust \${key}\`,
      });
    }
    groups.get(key).campaigns.push(c);
  }

  const totalValid = validCampaigns.length;
  console.log(\`🏢 \${groups.size}개 Adjust 어카운트로 직접 sync — 총 \${totalValid}개 캠페인\`);
  addLog(
    \`🏢 \${groups.size}개 Adjust 어카운트로 직접 sync — 총 \${totalValid}개 캠페인\`,
    '#a5b4fc'
  );

  // 4. 그룹별 처리 — adjust_account_id 로 직접 switch → sync
  let groupIdx = 0;
  for (const [adjustAccountId, group] of groups) {
    groupIdx++;
    const groupCampaigns = group.campaigns;
    const company = group.company;

    setStatus(
      \`[\${groupIdx}/\${groups.size}] \${company} (Adjust \${adjustAccountId}) — \${groupCampaigns.length}개\`
    );

    // 어카운트 전환 + /apps 매핑 빌드 (재시도 로직 포함)
    // 엣지 케이스: 시작 어카운트로 돌아가는 switch 의 경우 Adjust 가 stale 데이터
    // 반환할 수 있음 (예: 시작 SHIMMER → Hello Games → SHIMMER 돌아옴).
    // 이를 위해 switch + /apps 를 최대 3번 시도하며, 매칭 캠페인이 있을 때까지 재시도.
    const expectedPackages = groupCampaigns
      .map((c) => c.app_package_identifier)
      .filter(Boolean);

    let packageToToken = null;
    let accessibleTokens = null;
    let switchOk = false;

    for (let attempt = 1; attempt <= 3; attempt++) {
      const switched = await switchAccount(adjustAccountId);
      if (!switched) {
        // switch 자체 실패 — 재시도 의미 없음
        break;
      }
      switchOk = true;
      // 세션 쿠키가 안정될 시간 — 재시도마다 길게 (안전 마진)
      await new Promise((r) => setTimeout(r, 300 + attempt * 200));

      const mapResult = await fetchPackageMap();
      if (!mapResult || mapResult.map.size === 0) {
        console.warn(
          \`⚠️ \${company} (attempt \${attempt}/3) — /apps 비어있음, 재시도\`
        );
        continue;
      }

      // 매칭되는 패키지가 하나라도 있는지 확인
      const hasMatch = expectedPackages.some((p) => mapResult.map.has(p));
      if (hasMatch || expectedPackages.length === 0) {
        packageToToken = mapResult.map;
        accessibleTokens = mapResult.tokens;
        if (attempt > 1) {
          console.log(\`✓ \${company} — \${attempt}번째 시도에 매칭 성공\`);
        }
        break;
      }

      console.warn(
        \`⚠️ \${company} (attempt \${attempt}/3) — 매칭 패키지 없음 (apps \${mapResult.map.size}개), 재시도\`
      );
    }

    if (!switchOk) {
      console.error(\`❌ \${company} (Adjust \${adjustAccountId}) — 전환 실패\`);
      addLog(
        \`❌ \${company} — Adjust 어카운트 \${adjustAccountId} 전환 실패\`,
        '#fca5a5'
      );
      for (const c of groupCampaigns) {
        skippedList.push({
          name: c.name,
          missing: [\`Adjust 어카운트 전환 실패 (id: \${adjustAccountId})\`],
        });
      }
      continue;
    }

    if (!packageToToken) {
      addLog(
        \`⚠️ \${company} — 이 어카운트에 매칭 앱 없음 (3회 재시도 모두 실패)\`,
        '#fbbf24'
      );
      for (const c of groupCampaigns) {
        skippedList.push({
          name: c.name,
          missing: [
            \`Adjust 어카운트 \${adjustAccountId} 에 매칭 앱 없음 (account_id 확인 필요)\`,
          ],
        });
      }
      continue;
    }

    addLog(
      \`📂 \${company} (Adjust \${adjustAccountId}) — \${groupCampaigns.length}개 캠페인 처리\`,
      '#a5b4fc'
    );

    for (const c of groupCampaigns) {
      processedCount++;

      // 토큰 결정: package_identifier → Adjust /apps 응답에서 자동 매핑
      let resolvedToken = null;
      if (c.app_package_identifier) {
        resolvedToken = packageToToken.get(c.app_package_identifier) || null;
      }
      if (!resolvedToken) {
        skippedList.push({
          name: c.name,
          missing: [
            \`이 Adjust 어카운트에서 \${c.app_package_identifier} 매칭 실패\`,
          ],
        });
        addLog(
          \`⏭️ \${c.name} — 매칭 앱 없음 (\${company})\`,
          '#94a3b8'
        );
        continue;
      }

      // 종료일: holding/end 상태면 end_date, 아니면 한국시간 기준 오늘 (모든 캠페인 동일)
    const isClosed = c.status === 'holding' || c.status === 'end';
    const endDate =
      isClosed && c.end_date ? c.end_date : todayInTz('Asia/Seoul');
    // 시작일: endDate - 39일 (40일 포함) vs 캠페인 start_date 중 늦은 쪽
    const rangeStart = minusDays(endDate, RANGE_DAYS - 1);
    const startDate =
      c.start_date && c.start_date > rangeStart ? c.start_date : rangeStart;

    const utcOffset = tzToUtcOffset(c.timezone);
    const countryLower = (c.region || '').toLowerCase();

    console.log(
      \`📊 \${c.name} (\${c.region} / \${c.timezone} \${utcOffset}) [token: \${resolvedToken}] — \${startDate} ~ \${endDate}\`
    );
    setStatus(\`▶ [\${processedCount}/\${totalValid}] \${company} — \${c.name}\`);

    // Adjust automate API 파라미터
    // 주의: app_token__in / country_code__in 등 __in 계열은 JSON 문자열 형식
    //       ("token" 처럼 따옴표 필요) — Adjust UI 가 그렇게 호출함
    const params = new URLSearchParams();
    params.set('app_token__in', \`"\${resolvedToken}"\`);
    if (countryLower) params.set('country_code__in', \`"\${countryLower}"\`);
    params.set('date_period', \`\${startDate}:\${endDate}\`);
    params.set('utc_offset', utcOffset);
    params.set('dimensions', 'day');
    params.set('metrics', [
      'installs',
      'attribution_clicks',
      'cohort_all_revenue',
      'all_revenue_total_d0',
      'all_revenue_total_d1',
      'all_revenue_total_d7',
      'all_revenue_total_d14',
      'all_revenue_total_d30',
    ].join(','));
    // Adjust UI 저장 리포트에 항상 포함되는 default 들 — 빼면 일부 캠페인 토큰 검증 실패
    params.set('attribution_source', 'dynamic');
    params.set('attribution_type', 'all');
    params.set('reattributed', 'all');
    params.set('sandbox', 'false');
    params.set('cohort_maturity', 'immature');
    params.set('ad_spend_mode', 'network');
    // ad_revenue_sources 값 있으면만 포함
    if (c.adjust_ad_revenue_sources) {
      params.set('ad_revenue_sources', c.adjust_ad_revenue_sources);
    }

    try {
      const r = await fetch(
        \`https://automate.adjust.com/reports-service/report?\${params.toString()}\`,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'include',
        }
      );
      if (!r.ok) {
        const errText = await r.text().catch(() => '');
        console.error(\`  ❌ \${c.name} HTTP \${r.status} — \${errText.slice(0, 200)}\`);
        // 400 + Invalid app tokens → 2가지 케이스 가능:
        //   (a) 정말로 다른 어카운트 소속 (token 이 현재 어카운트에 없음)
        //   (b) 이 region/country 에 해당 app 의 데이터가 없음 (Adjust 가 이걸 invalid 로 응답함)
        // 메시지로 구분 어려우니 둘 다 가능성 안내
        if (r.status === 400 && /invalid app tokens/i.test(errText)) {
          skippedList.push({
            name: c.name,
            missing: [
              \`Adjust 데이터 없음 또는 토큰 접근 불가 (region: \${c.region})\`,
            ],
          });
          addLog(
            \`⏭️ \${c.name} — 이 region 에 데이터 없음 (또는 token 접근 불가)\`,
            '#94a3b8'
          );
        } else {
          skippedList.push({
            name: c.name,
            missing: [\`Adjust API 에러 (HTTP \${r.status})\`],
          });
          addLog(\`❌ \${c.name} — Adjust HTTP \${r.status}\`, '#fca5a5');
        }
        continue;
      }
      const data = await r.json();
      let rows = Array.isArray(data)
        ? data
        : data.rows || data.data || data.results || null;
      if (!Array.isArray(rows)) {
        for (const k in data) {
          if (Array.isArray(data[k])) {
            rows = data[k];
            break;
          }
        }
      }
      const cleaned = (rows || [])
        .map(mapAdjustRow)
        .filter((row) => row.date && /^\\d{4}-\\d{2}-\\d{2}$/.test(row.date));

      console.log(\`  → \${cleaned.length}일 데이터\`);
      console.table(cleaned);

      // 시트에 적재 — 위에서 sheet_url 누락 캠페인은 이미 스킵됨
      // quota(분당 읽기 한도) 초과 시 대기 후 재시도 (될 때까지 최대 5회)
      if (cleaned.length > 0) {
        let syncData = null;
        let syncOk = false;
        for (let attempt = 1; attempt <= 5; attempt++) {
          try {
            const syncRes = await fetch('${baseUrl}/api/external/sync-sheet', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-API-Key': '${apiKey}',
              },
              body: JSON.stringify({ sheet_url: c.sheet_url, rows: cleaned }),
            });
            syncData = await syncRes.json();
            if (syncRes.ok) {
              syncOk = true;
              break;
            }
            const isQuota =
              syncRes.status === 429 ||
              /quota|read requests|rate limit/i.test(syncData.error || '');
            if (isQuota && attempt < 5) {
              const waitMs = 10000 * attempt; // 10s,20s,30s,40s
              addLog(
                \`  ⏳ \${c.name} — 시트 quota 초과, \${waitMs / 1000}초 후 재시도 (\${attempt}/4)\`,
                '#fbbf24'
              );
              await new Promise((r) => setTimeout(r, waitMs));
              continue;
            }
            break; // quota 외 에러는 중단
          } catch (syncErr) {
            console.error('  ❌ 시트 적재 오류:', syncErr);
            if (attempt < 5) {
              await new Promise((r) => setTimeout(r, 5000));
              continue;
            }
          }
        }
        if (syncOk && syncData) {
          console.log(
            \`  📥 시트 [\${syncData.sheet_title}] — 매칭 \${syncData.matched} / 신규 \${syncData.filled} / 추가 \${syncData.appended}\`
          );
          addLog(
            \`✅ \${c.name} — 매칭 \${syncData.matched}, 신규 \${syncData.filled}\${syncData.appended ? ', 추가 ' + syncData.appended : ''}\`,
            '#86efac'
          );
          totalMatched += syncData.matched;
          totalFilled += syncData.filled;
          totalAppended += syncData.appended;
          if (syncData.warnings && syncData.warnings.length > 0) {
            syncData.warnings.forEach((w) => {
              console.warn(\`  ⚠️ \${w}\`);
              addLog(\`  ⚠️ \${w}\`, '#fbbf24');
            });
          }
        } else {
          addLog(
            \`  ❌ 시트 적재 실패: \${(syncData && syncData.error) || '알 수 없음'}\`,
            '#fca5a5'
          );
        }
      }

      results.push({
        campaign: c.name,
        region: c.region,
        timezone: c.timezone,
        period: { start: startDate, end: endDate },
        sheet_url: c.sheet_url,
        rows: cleaned,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(\`  ❌ \${c.name} 에러:\`, e);
      addLog(\`❌ \${c.name} — \${msg}\`, '#fca5a5');
      skippedList.push({
        name: c.name,
        missing: [\`네트워크/JS 에러: \${msg.slice(0, 80)}\`],
      });
    }
    // 캠페인 간 small delay — Adjust API rate limit 회피 + 세션 안정성
    await new Promise((r) => setTimeout(r, 150));
    } // end: for (const c of groupCampaigns) — 이 그룹의 캠페인 처리 종료
  } // end: for (const [adjustAccountId, group] of groups) — 그룹 순회 종료

  // 4. 원래 활성 어카운트로 복원
  if (originalAccountId) {
    setStatus('원래 Adjust 어카운트로 복원 중...');
    const restored = await switchAccount(originalAccountId);
    if (restored) {
      console.log(\`🔙 원래 어카운트로 복원 (id: \${originalAccountId})\`);
      addLog(\`🔙 원래 Adjust 어카운트로 복원\`, '#a5b4fc');
    } else {
      addLog(\`⚠️ 어카운트 복원 실패 — 수동 전환 필요\`, '#fbbf24');
    }
  }

  window.ampdPerformance = results;
  window.ampdSkipped = skippedList;
  console.log(\`\\n✅ 완료 — 성공 \${results.length} / 스킵 \${skippedList.length} / 전체 \${campaigns.length}\`);
  if (skippedList.length > 0) {
    console.warn('⚠️ 스킵된 캠페인:');
    console.table(skippedList.map((s) => ({ 캠페인: s.name, 누락된_필드: s.missing.join(', ') })));
  }

  // 스킵 요약 — 로그 영역에 별도 섹션
  if (skippedList.length > 0) {
    addLog(' ', undefined);
    addLog(\`━━━━━━━━━━ 스킵 요약 (\${skippedList.length}) ━━━━━━━━━━\`, '#fbbf24');
    // 누락 필드 별 그룹핑
    const byReason = {};
    for (const s of skippedList) {
      for (const m of s.missing) {
        if (!byReason[m]) byReason[m] = [];
        byReason[m].push(s.name);
      }
    }
    for (const reason in byReason) {
      addLog(\`• \${reason} 누락 (\${byReason[reason].length}):\`, '#fbbf24');
      for (const name of byReason[reason]) {
        addLog(\`   - \${name}\`, '#fde68a');
      }
    }
  }

  setStatus(
    \`✅ 완료 — 성공 \${results.length} / 스킵 \${skippedList.length} / 전체 \${campaigns.length} (매칭 \${totalMatched} / 신규 \${totalFilled}\${totalAppended ? ' / 추가 ' + totalAppended : ''})\`,
    skippedList.length > 0 ? '#fbbf24' : '#86efac'
  );
  stopSpinner(true);
})();`;
  }, [apiKey, baseUrl]);

  // 북마클릿 (javascript: URL — 북마크바에 드래그)
  const appsflyerBookmarklet = useMemo(
    () =>
      appsflyerConsoleScript
        ? `javascript:${encodeURIComponent(appsflyerConsoleScript)}`
        : '',
    [appsflyerConsoleScript]
  );
  const adjustBookmarklet = useMemo(
    () =>
      adjustConsoleScript
        ? `javascript:${encodeURIComponent(adjustConsoleScript)}`
        : '',
    [adjustConsoleScript]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Code className='h-5 w-5' />
          MMP 연동 — API 키
        </CardTitle>
        <CardDescription>
          AppsFlyer / Adjust 콘솔에서 AMPD 의 캠페인 데이터를 불러올 때 사용하는
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
                className={`h-4 w-4 ${working ? 'animate-spin' : ''}`}
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

            {/* AppsFlyer 북마클릿 */}
            <div className='rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2'>
              <div>
                <div className='text-sm font-semibold'>
                  AppsFlyer 북마클릿
                </div>
                <p className='text-xs text-muted-foreground mt-0.5'>
                  버튼을 <strong>북마크바로 드래그</strong> 해서 추가하세요.
                  AppsFlyer 페이지(hq1.appsflyer.com)에서 클릭하면 실행됩니다.
                </p>
              </div>
              <div className='flex items-center gap-2'>
                {/* React 가 javascript: href 를 막으므로 ref + setAttribute 로 우회 */}
                {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                <a
                  ref={(el) => {
                    appsflyerBookmarkletRef.current = el;
                    if (el && appsflyerBookmarklet) {
                      el.setAttribute('href', appsflyerBookmarklet);
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
                  AMPD — AppsFlyer 동기화
                </a>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() =>
                    handleCopy(appsflyerBookmarklet, 'af-bookmarklet')
                  }
                >
                  {copiedItem === 'af-bookmarklet' ? (
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

            {/* Adjust 북마클릿 */}
            <div className='rounded-md border border-violet-300/40 bg-violet-500/5 p-3 space-y-2 dark:border-violet-400/30'>
              <div>
                <div className='text-sm font-semibold'>Adjust 북마클릿</div>
                <p className='text-xs text-muted-foreground mt-0.5'>
                  버튼을 <strong>북마크바로 드래그</strong> 해서 추가하세요.
                  Adjust 페이지(suite.adjust.com)에 로그인된 상태에서 클릭하면
                  실행됩니다.
                </p>
              </div>
              <div className='flex items-center gap-2'>
                {/* React 가 javascript: href 를 막으므로 ref + setAttribute 로 우회 */}
                {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                <a
                  ref={(el) => {
                    adjustBookmarkletRef.current = el;
                    if (el && adjustBookmarklet) {
                      el.setAttribute('href', adjustBookmarklet);
                    }
                  }}
                  className='inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-violet-600 text-white text-sm font-medium cursor-grab active:cursor-grabbing hover:opacity-90'
                  draggable
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info(
                      '클릭이 아닌 드래그로 북마크바에 추가하세요.'
                    );
                  }}
                >
                  <Code className='h-4 w-4' />
                  AMPD — Adjust 동기화
                </a>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() =>
                    handleCopy(adjustBookmarklet, 'adj-bookmarklet')
                  }
                >
                  {copiedItem === 'adj-bookmarklet' ? (
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
              <div className='mt-2 space-y-3'>
                <div>
                  <div className='flex items-center justify-between mb-1'>
                    <span className='text-xs font-semibold text-muted-foreground'>
                      AppsFlyer — F12 콘솔에 붙여넣기
                    </span>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-6 px-2 text-xs'
                      onClick={() =>
                        handleCopy(appsflyerConsoleScript, 'af-script')
                      }
                    >
                      {copiedItem === 'af-script' ? (
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
                  <pre className='p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto max-h-40 leading-relaxed'>
                    {appsflyerConsoleScript}
                  </pre>
                </div>
                <div>
                  <div className='flex items-center justify-between mb-1'>
                    <span className='text-xs font-semibold text-muted-foreground'>
                      Adjust — F12 콘솔에 붙여넣기
                    </span>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-6 px-2 text-xs'
                      onClick={() => handleCopy(adjustConsoleScript, 'adj-script')}
                    >
                      {copiedItem === 'adj-script' ? (
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
                  <pre className='p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto max-h-40 leading-relaxed'>
                    {adjustConsoleScript}
                  </pre>
                </div>
                <p className='text-xs text-muted-foreground'>
                  각 MMP 페이지에서 개발자 도구(F12) → Console 탭에 붙여넣기
                  후 실행. 키가 콘솔에 노출되니 화면 공유 시 주의.
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
                  className={`h-4 w-4 ${working ? 'animate-spin' : ''}`}
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
