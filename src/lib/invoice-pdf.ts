import {
  buildInvoiceHtml,
  type InvoiceTemplateData,
} from '@/lib/invoice-html-template';

/**
 * Puppeteer 실행 환경 분기:
 *  - Vercel / production: puppeteer-core + @sparticuz/chromium (서버리스용 경량 Chromium)
 *  - 로컬 dev: 전체 puppeteer (자동 다운로드된 Chrome)
 *
 * 두 패키지의 Browser 타입이 호환되므로 any 캐스팅으로 통일.
 */
type AnyBrowser = any;

/**
 * 브라우저 인스턴스 캐싱 — 매 요청마다 새로 띄우지 않도록.
 * 5분간 미사용 시 자동 종료해서 메모리 회수.
 * 서버리스에서는 콜드스타트마다 새 인스턴스지만, warm 한 동안엔 재사용 가능.
 */
let cachedBrowser: AnyBrowser = null;
let launching: Promise<AnyBrowser> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5분

function scheduleIdleClose() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    if (cachedBrowser && cachedBrowser.connected) {
      await cachedBrowser.close().catch(() => {});
      cachedBrowser = null;
    }
  }, IDLE_TIMEOUT_MS);
}

/**
 * 환경에 맞는 puppeteer launch 옵션 + 실행
 * Vercel (production) 에서는 @sparticuz/chromium 의 binary 와 args 사용,
 * 로컬에서는 자동 다운로드된 Chrome 사용.
 */
async function launchBrowser(): Promise<AnyBrowser> {
  const isServerless =
    !!process.env.VERCEL_ENV || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isServerless) {
    // 서버리스: puppeteer-core + @sparticuz/chromium
    const [{ default: chromium }, puppeteer] = await Promise.all([
      import('@sparticuz/chromium'),
      import('puppeteer-core'),
    ]);
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  // 로컬 dev: 전체 puppeteer 패키지 (자동 다운로드된 Chrome)
  const puppeteer = await import('puppeteer');
  return puppeteer.default.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
}

async function getBrowser(): Promise<AnyBrowser> {
  if (cachedBrowser && cachedBrowser.connected) {
    return cachedBrowser;
  }
  // 동시 요청 시 한 번만 launch
  if (launching) return launching;

  launching = launchBrowser()
    .then((b) => {
      cachedBrowser = b;
      // 프로세스 종료 시 정리
      b.on('disconnected', () => {
        cachedBrowser = null;
      });
      return b;
    })
    .finally(() => {
      launching = null;
    });

  return launching;
}

/**
 * 인보이스 데이터 → A4 PDF 버퍼 변환.
 * 헤드리스 브라우저로 HTML 렌더링 후 PDF 추출.
 */
export async function generateInvoicePdf(
  data: InvoiceTemplateData
): Promise<Buffer> {
  const html = buildInvoiceHtml(data);

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // domcontentloaded 면 충분 — 인라인 HTML 이고 외부 리소스 거의 없음
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    // 도장 이미지 등 외부 이미지 로드 대기 (있다면)
    await page.evaluate(async () => {
      const imgs = Array.from(document.images);
      await Promise.all(
        imgs.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        })
      );
    });

    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', right: '14mm', bottom: '20mm', left: '14mm' },
    });
    return Buffer.from(pdfBytes);
  } finally {
    await page.close().catch(() => {});
    // 마지막 요청 시간 기준으로 idle timer 갱신
    scheduleIdleClose();
  }
}
