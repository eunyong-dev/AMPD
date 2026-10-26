/**
 * Tenjin 대시보드(dashboard.tenjin.com)용 시트 동기화 스크립트 — AppsFlyer / Adjust 콘솔 스크립트와 같은 흐름
 *
 * - 대시보드가 쓰는 내부 리포트 API(/reporting/v3/grouped_stats)를 로그인 세션 + CSRF 토큰으로 호출
 * - 광고 네트워크는 Playio(37686, Tenjin 공통 네트워크 ID) 로 고정, 나라는 캠페인 region
 * - 앱은 AMPD 게임 package_identifier ↔ Tenjin bundle_id 로 매칭 (현재 선택된 Tenjin 조직 안에서만 찾음)
 * - Tenjin 리포트는 UTC 기준 → 캠페인 타임존이 없어도 동기화
 * - revenue: 대시보드 "All Revenue (Ad Mediation + IAP + Subscriptions)" 컬럼 그대로 (광고주 확인 기준)
 *   = total_ad_mediation_revenue — 설치일 코호트가 아니라 그날 Playio 유저에게서 발생한 매출
 * - D0~D30 revenue: 설치일 코호트 누적, 광고 + IAP
 *   - 광고: grouped_stats 의 ad_mediation_revenue_Nd (광고 매출만 — IAP 안 들어감)
 *   - IAP: cohort API 의 iap_revenue (설치일 하루씩 조회, xday 별 누적값). grouped_stats 에는 IAP 가 ROAS 로만 있어서
 *     spend 가 아직 안 들어온 최근 며칠은 계산이 안 됨 → cohort API 사용
 */
export function buildTenjinConsoleScript(baseUrl: string, apiKey: string) {
  return `// AMPD 시트 동기화 — Tenjin
(async () => {
  // ========== 진행상황 UI ==========
  const existing = document.getElementById('__ampd_sync_ui');
  if (existing) existing.remove();
  const ui = document.createElement('div');
  ui.id = '__ampd_sync_ui';
  ui.style.cssText = 'position:fixed;bottom:20px;right:20px;width:380px;background:#0f172a;color:#e2e8f0;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.4);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;z-index:2147483647;overflow:hidden;font-size:13px;';
  ui.innerHTML = '<div style="padding:14px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #1e293b;font-weight:600;"><span id="__ampd_spinner" style="display:inline-block;width:14px;height:14px;border:2px solid #3b82f6;border-top-color:transparent;border-radius:50%;animation:__ampd_spin 0.8s linear infinite;"></span><span style="flex:1;">AMPD 시트 동기화 (Tenjin)</span><button id="__ampd_close" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:18px;line-height:1;padding:0;">×</button></div><div id="__ampd_status" style="padding:12px 16px;color:#cbd5e1;line-height:1.5;">시작합니다...</div><div id="__ampd_log" style="max-height:200px;overflow-y:auto;padding:0 16px 12px;font-size:11px;line-height:1.6;color:#94a3b8;"></div>';
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

  if (location.hostname !== 'dashboard.tenjin.com') {
    setStatus('❌ Tenjin 대시보드(dashboard.tenjin.com)에서 실행해주세요.', '#fca5a5');
    stopSpinner(false);
    return;
  }
  // 대시보드 내부 API 호출용 CSRF 토큰 (로그인 페이지 등에는 없음)
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
  if (!csrf) {
    setStatus('❌ Tenjin 로그인 상태를 확인해주세요. (CSRF 토큰 없음)', '#fca5a5');
    stopSpinner(false);
    return;
  }

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

  // 날짜 유틸 — Tenjin 은 UTC 기준
  const todayUtc = () => new Date().toISOString().slice(0, 10);
  const minusDays = (dateStr, n) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - n);
    return dt.toISOString().slice(0, 10);
  };
  // 가져올 범위: endDate 포함 40일 (endDate - 39일 ~ endDate)
  const RANGE_DAYS = 40;

  // Playio — Tenjin 공통 광고 네트워크 ID (조직이 달라도 같음)
  const PLAYIO_AD_NETWORK_ID = '37686';

  // Tenjin 지표 → 시트 동기화 필드
  // - revenue: 대시보드 All Revenue (Ad Mediation + IAP + Subscriptions) — IAP 이미 포함
  // - D0~D30: 광고 매출 설치일 코호트 누적 — IAP 는 아래 cohort API 로 더함
  const metricMap = {
    tracked_installs: 'installs',
    tracked_clicks: 'clicks',
    total_ad_mediation_revenue: 'LTV_revenue',
    ad_mediation_revenue_0d: 'D0_revenue',
    ad_mediation_revenue_1d: 'D1_revenue',
    ad_mediation_revenue_7d: 'D7_revenue',
    ad_mediation_revenue_14d: 'D14_revenue',
    ad_mediation_revenue_30d: 'D30_revenue',
  };

  // 시트 필드 → 며칠째까지의 누적인지 (IAP 합산용)
  const revenueDays = {
    D0_revenue: 0,
    D1_revenue: 1,
    D7_revenue: 7,
    D14_revenue: 14,
    D30_revenue: 30,
  };

  // 설치일 하루의 IAP 코호트 매출 → { xday: 누적 매출 } (Playio · 캠페인 나라 · 앱)
  const fetchIapCohort = async (campaign, date, appIds) => {
    const params = new URLSearchParams({
      start_date: date,
      end_date: date,
      granularity: 'daily',
      group_by: 'app_id',
      metrics: 'iap_revenue',
    });
    params.append('ad_network_ids[]', PLAYIO_AD_NETWORK_ID);
    params.append('countries[]', campaign.region);
    const r = await fetch('/reporting/v3/cohort?' + params.toString(), {
      headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf },
      credentials: 'include',
    });
    if (!r.ok) throw new Error('Tenjin cohort HTTP ' + r.status);
    const data = await r.json();
    const byXday = {};
    for (const row of data.data || []) {
      if (!appIds.has(row.app_id)) continue;
      const v = Number(row.iap_revenue);
      if (Number.isFinite(v)) byXday[row.xday] = (byXday[row.xday] || 0) + v;
    }
    return byXday;
  };
  // xday 별 누적값에서 N일째까지의 누적 (그 날 행이 없으면 직전 값)
  const iapUpTo = (byXday, n) => {
    let v = 0;
    for (const x in byXday) {
      if (Number(x) <= n) v = Math.max(v, byXday[x]);
    }
    return v;
  };

  const buildPayload = (campaign, startDate, endDate) => ({
    ad_network_ids: [PLAYIO_AD_NETWORK_ID],
    app_ids: [],
    countries: [campaign.region],
    start_date: startDate,
    end_date: endDate,
    granularity: 'daily',
    group_by: 'app_id',
    metrics: Object.keys(metricMap).join(','),
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

    // 필수 필드 체크 — 누락된 거 한 번에 모아서 보고 (Tenjin 은 UTC 고정이라 타임존은 안 봄)
    const missing = [];
    if (!c.app_package_identifier) missing.push('Package/Bundle ID');
    if (!c.region) missing.push('국가');
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

    // 종료일: holding/end 상태면 end_date, 아니면 UTC 기준 오늘
    const isClosed = c.status === 'holding' || c.status === 'end';
    const endDate = isClosed && c.end_date ? c.end_date : todayUtc();
    // 시작일: endDate - 39일 (40일 포함) vs 캠페인 start_date 중 늦은 쪽
    const rangeStart = minusDays(endDate, RANGE_DAYS - 1);
    const startDate =
      c.start_date && c.start_date > rangeStart ? c.start_date : rangeStart;

    console.log(\`📊 \${c.name} (\${c.region} / UTC) — \${startDate} ~ \${endDate}\`);
    setStatus(\`▶ [\${processed}/\${campaigns.length}] \${c.name}\`);

    try {
      const r = await fetch('/reporting/v3/grouped_stats', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrf,
        },
        body: JSON.stringify(buildPayload(c, startDate, endDate)),
        credentials: 'include',
      });
      if (!r.ok) {
        console.error(\`  ❌ \${c.name} HTTP \${r.status}\`);
        addLog(\`❌ \${c.name} — Tenjin HTTP \${r.status}\`, '#fca5a5');
        continue;
      }
      const data = await r.json();
      const pkg = String(c.app_package_identifier).trim().toLowerCase();
      const appRows = (data.data || []).filter(
        (row) => String(row.bundle_id || '').trim().toLowerCase() === pkg
      );
      if (appRows.length === 0) {
        // 앱이 다른 Tenjin 조직에 있거나, 기간 안에 Playio 데이터가 없는 경우
        addLog(
          \`⚠️ \${c.name} — 현재 Tenjin 조직에서 \${c.app_package_identifier} 의 Playio 데이터 없음 (조직 전환 확인)\`,
          '#fbbf24'
        );
        continue;
      }

      // 같은 bundle_id 앱이 여러 개(플랫폼별 등)면 날짜별로 합산
      const appIds = new Set(appRows.map((row) => row.app_id));
      if (appIds.size > 1) {
        addLog(\`  ⚠️ \${c.name} — 같은 Bundle ID 앱 \${appIds.size}개 합산\`, '#fbbf24');
      }
      const byDate = {};
      for (const row of appRows) {
        const o = byDate[row.date] || (byDate[row.date] = { date: row.date });
        for (const k in metricMap) {
          const v = Number(row[k]);
          if (Number.isFinite(v)) o[metricMap[k]] = (o[metricMap[k]] || 0) + v;
        }
      }
      // IAP 코호트 매출 더하기 — 설치일마다 1번씩, 4개씩 동시에
      const dates = Object.keys(byDate);
      const iapFailed = [];
      for (let i = 0; i < dates.length; i += 4) {
        await Promise.all(
          dates.slice(i, i + 4).map(async (date) => {
            try {
              const byXday = await fetchIapCohort(c, date, appIds);
              const o = byDate[date];
              for (const k in revenueDays) {
                o[k] = (o[k] || 0) + iapUpTo(byXday, revenueDays[k]);
              }
            } catch (e) {
              iapFailed.push(date);
              console.warn(\`  ⚠️ \${c.name} \${date} IAP 조회 실패:\`, e);
            }
          })
        );
      }
      // IAP 를 못 가져온 날은 매출이 덜 잡히므로 시트에 안 씀
      if (iapFailed.length > 0) {
        for (const date of iapFailed) delete byDate[date];
        addLog(\`  ⚠️ \${c.name} — IAP 조회 실패 \${iapFailed.length}일은 건너뜀 (다시 실행해주세요)\`, '#fbbf24');
      }

      const cleaned = Object.values(byDate)
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((o) => {
          for (const k in o) {
            if (typeof o[k] === 'number') o[k] = Math.round(o[k] * 100) / 100;
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
              await new Promise((res) => setTimeout(res, waitMs));
              continue;
            }
            break; // quota 외 에러는 중단
          } catch (syncErr) {
            console.error('  ❌ 시트 적재 오류:', syncErr);
            if (attempt < 5) {
              await new Promise((res) => setTimeout(res, 5000));
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
        timezone: 'UTC',
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
})();`;
}
