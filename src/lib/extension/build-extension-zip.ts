import { strToU8, zipSync } from 'fflate';

/**
 * AMPD 시트 동기화 크롬 확장 프로그램(Manifest V3) zip 생성 — 브라우저에서 바로 만든다.
 *
 * - 팝업 버튼 2개(AppsFlyer / Adjust) → 현재 콘솔 탭에 북마클릿과 같은 스크립트를 주입(world: MAIN)
 *   → 페이지 안에서 실행되므로 로그인 세션·Origin 이 북마클릿과 동일 (AMPD external API 변경 불필요)
 * - 스크립트에는 사용자의 AMPD 주소·API 키가 들어 있음 (북마클릿과 동일) → zip 공유 금지
 * - 설치: chrome://extensions → 개발자 모드 → "압축해제된 확장 프로그램을 로드합니다"
 */

export const EXTENSION_FOLDER = 'ampd-sync-extension';
export const EXTENSION_VERSION = '1.0.1';

// AMPD external API 가 허용하는 콘솔 origin 과 맞춰야 함 (src/app/api/external/*)
const APPSFLYER_HOSTS = [
  'hq1.appsflyer.com',
  'hq.appsflyer.com',
  'www.appsflyer.com',
];
const ADJUST_HOSTS = [
  'suite.adjust.com',
  'dash.adjust.com',
  'automate.adjust.com',
  'www.adjust.com',
];

const ICON_SIZES = [16, 32, 48, 128] as const;

export interface ExtensionBuildInput {
  /** AMPD 주소 (예: https://amkit.vercel.app) — 팝업의 "AMPD" 링크용 */
  baseUrl: string;
  /** 북마클릿과 같은 콘솔 스크립트 (AMPD 주소·API 키 포함) */
  appsflyerScript: string;
  adjustScript: string;
  /** 크기별 PNG (없으면 크롬 기본 아이콘) */
  icons?: Partial<Record<(typeof ICON_SIZES)[number], Uint8Array>>;
  builtAt?: Date;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function manifestJson(input: ExtensionBuildInput) {
  const date = (input.builtAt ?? new Date()).toISOString().slice(0, 10);
  const iconMap = Object.fromEntries(
    ICON_SIZES.filter((s) => input.icons?.[s]).map((s) => [
      String(s),
      `icons/icon${s}.png`,
    ])
  );
  const hasIcons = Object.keys(iconMap).length > 0;
  return JSON.stringify(
    {
      manifest_version: 3,
      name: 'AMPD 시트 동기화',
      version: EXTENSION_VERSION,
      version_name: `${EXTENSION_VERSION} (${date})`,
      description:
        'AppsFlyer / Adjust 콘솔에서 AMPD 캠페인 리포트 시트로 데이터를 동기화합니다.',
      action: {
        default_popup: 'popup.html',
        default_title: 'AMPD 시트 동기화',
        ...(hasIcons && { default_icon: iconMap }),
      },
      ...(hasIcons && { icons: iconMap }),
      permissions: ['activeTab', 'scripting'],
      host_permissions: [...APPSFLYER_HOSTS, ...ADJUST_HOSTS].map(
        (h) => `https://${h}/*`
      ),
    },
    null,
    2
  );
}

function popupHtml(baseUrl: string) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>AMPD 시트 동기화</title>
<style>
  body { width: 280px; margin: 0; padding: 14px; font: 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; }
  h1 { font-size: 14px; margin: 0 0 4px; }
  p { margin: 0 0 12px; color: #64748b; line-height: 1.5; }
  button { display: block; width: 100%; height: 36px; margin-bottom: 8px; border: 0; border-radius: 10px; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }
  #btn-appsflyer { background: #2563eb; }
  #btn-adjust { background: #7c3aed; }
  button:disabled { background: #e2e8f0; color: #94a3b8; cursor: not-allowed; }
  .foot { margin-top: 4px; font-size: 11px; color: #94a3b8; }
  .foot a { color: #64748b; }
</style>
</head>
<body>
  <h1>AMPD 시트 동기화</h1>
  <p id="status">확인 중...</p>
  <button id="btn-appsflyer" disabled>AppsFlyer 동기화</button>
  <button id="btn-adjust" disabled>Adjust 동기화</button>
  <div class="foot">v${EXTENSION_VERSION} · <a href="${escapeHtml(
    `${baseUrl}/permissions`
  )}" target="_blank" rel="noopener">AMPD에서 다시 받기</a></div>
  <script src="popup.js"></script>
</body>
</html>
`;
}

function popupJs() {
  const targets = {
    appsflyer: {
      label: 'AppsFlyer',
      hosts: APPSFLYER_HOSTS,
      file: 'inject/appsflyer.js',
    },
    adjust: { label: 'Adjust', hosts: ADJUST_HOSTS, file: 'inject/adjust.js' },
  };
  return `// AMPD 시트 동기화 — 팝업
const TARGETS = ${JSON.stringify(targets, null, 2)};

const $ = (id) => document.getElementById(id);

async function run(tabId, target) {
  try {
    // 북마클릿과 같은 스크립트를 페이지 안(MAIN world)에서 실행 — 진행 상황은 페이지 오른쪽 아래 패널에 표시
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [target.file],
      world: 'MAIN',
    });
    window.close();
  } catch (e) {
    $('status').textContent = '실행 실패: ' + (e && e.message ? e.message : e);
  }
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = '';
  try {
    host = new URL(tab && tab.url ? tab.url : '').hostname;
  } catch (e) {
    host = '';
  }
  let current = null;
  for (const [key, target] of Object.entries(TARGETS)) {
    const btn = $('btn-' + key);
    const ok = target.hosts.includes(host);
    btn.disabled = !ok;
    if (ok) current = target;
    btn.addEventListener('click', () => run(tab.id, target));
  }
  $('status').textContent = current
    ? current.label + ' 콘솔에서 동기화를 시작할 수 있어요.'
    : 'AppsFlyer 또는 Adjust 콘솔 탭에서 눌러주세요.';
}

init();
`;
}

function readmeTxt() {
  return `AMPD 시트 동기화 — 크롬 확장 프로그램 v${EXTENSION_VERSION}

[설치]
1. 이 폴더(${EXTENSION_FOLDER})를 원하는 위치에 둡니다. (지우면 확장 프로그램도 동작하지 않아요)
2. 크롬 주소창에 chrome://extensions 입력 → 오른쪽 위 "개발자 모드" 켜기
3. "압축해제된 확장 프로그램을 로드합니다" → 이 폴더 선택
4. 툴바의 퍼즐 아이콘에서 "AMPD 시트 동기화"를 고정(핀)

[사용]
AppsFlyer / Adjust 콘솔 탭에서 툴바 아이콘 → 동기화 버튼
진행 상황은 페이지 오른쪽 아래 패널에 표시됩니다. (북마클릿과 동일)

[주의]
- 이 폴더에는 내 AMPD API 키가 들어 있습니다. 다른 사람과 공유하지 마세요.
- 키를 재발급하거나 AMPD 스크립트가 바뀌면 AMPD 권한 페이지에서 다시 받아
  이 폴더에 덮어쓴 뒤, chrome://extensions 에서 새로고침(↻)을 누르세요.
`;
}

/** 확장 프로그램 zip (폴더 1개: ampd-sync-extension/) */
export function buildExtensionZip(input: ExtensionBuildInput): Uint8Array {
  const dir = `${EXTENSION_FOLDER}/`;
  const files: Record<string, Uint8Array> = {
    [`${dir}manifest.json`]: strToU8(manifestJson(input)),
    [`${dir}popup.html`]: strToU8(popupHtml(input.baseUrl)),
    [`${dir}popup.js`]: strToU8(popupJs()),
    [`${dir}inject/appsflyer.js`]: strToU8(input.appsflyerScript),
    [`${dir}inject/adjust.js`]: strToU8(input.adjustScript),
    [`${dir}README.txt`]: strToU8(readmeTxt()),
  };
  for (const size of ICON_SIZES) {
    const png = input.icons?.[size];
    if (png) files[`${dir}icons/icon${size}.png`] = png;
  }
  return zipSync(files, { level: 6 });
}

/** 확장 프로그램 아이콘 (캔버스로 생성 — 진행 패널과 같은 남색 바탕 + "A") */
export async function renderExtensionIcons(): Promise<
  Partial<Record<(typeof ICON_SIZES)[number], Uint8Array>>
> {
  const out: Partial<Record<(typeof ICON_SIZES)[number], Uint8Array>> = {};
  for (const size of ICON_SIZES) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    // 둥근 사각형 바탕
    const r = size * 0.22;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(size, 0, size, size, r);
    ctx.arcTo(size, size, 0, size, r);
    ctx.arcTo(0, size, 0, 0, r);
    ctx.arcTo(0, 0, size, 0, r);
    ctx.closePath();
    ctx.fill();
    // "A"
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(
      size * 0.62
    )}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', size / 2, size / 2 + size * 0.04);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    );
    if (blob) out[size] = new Uint8Array(await blob.arrayBuffer());
  }
  return out;
}
