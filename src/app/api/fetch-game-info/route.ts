import { NextRequest, NextResponse } from 'next/server';

interface GameInfo {
  game_name?: string;
  package_identifier?: string;
  logo_url?: string;
}

// 서버 메모리 캐시 — 같은 store URL 반복 스크래핑 방지.
// 게임 메타(이름/아이콘/번들ID)는 거의 변하지 않으므로 24시간 TTL이면 충분.
// dev 서버 재시작 또는 serverless 인스턴스 재기동 시 자연스럽게 cold start.
type CacheEntry = { data: GameInfo; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 24 * 60 * 60 * 1000;
// 진행 중인 동일 URL 요청 중복 fetch 방지
const inflight = new Map<string, Promise<GameInfo>>();

const getCached = (url: string): GameInfo | null => {
  const hit = cache.get(url);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(url);
    return null;
  }
  return hit.data;
};

const setCached = (url: string, data: GameInfo) => {
  cache.set(url, { data, expiresAt: Date.now() + TTL_MS });
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, noCache } = body as { url?: string; noCache?: boolean };

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // 1) 캐시 hit — 즉시 반환 (noCache=true면 캐시 무시 + 기존 항목 삭제)
    if (noCache) {
      cache.delete(url);
    } else {
      const cached = getCached(url);
      if (cached) {
        return NextResponse.json({ data: cached });
      }
    }

    // 2) 같은 URL의 in-flight 요청이 있으면 그걸 await (dedup)
    const ongoing = inflight.get(url);
    if (ongoing) {
      const data = await ongoing;
      return NextResponse.json({ data });
    }

    // 3) 새로 스크래핑 — 진행 중 등록
    const promise = scrapeGameInfo(url).finally(() => {
      inflight.delete(url);
    });
    inflight.set(url, promise);
    const data = await promise;
    setCached(url, data);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('게임 정보 가져오기 오류:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game information' },
      { status: 500 }
    );
  }
}

async function scrapeGameInfo(url: string): Promise<GameInfo> {
  const gameInfo: GameInfo = {};
  await scrapeImpl(url, gameInfo);
  return gameInfo;
}

// 외부 fetch 전용 헬퍼 — AbortController로 timeout 강제
async function timedFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = 10_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function scrapeImpl(url: string, gameInfo: GameInfo): Promise<void> {
  // 기존 스크래핑 로직을 별도 함수로 분리 — POST 핸들러는 캐싱만 담당
  try {

    // App Store URL 처리
    if (url.includes('apps.apple.com')) {
      try {
        // App Store URL에서 정보 추출
        const response = await timedFetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }

        const html = await response.text();

        // 1. iTunes API를 먼저 시도 (App ID가 있는 경우) - 가장 안정적
        // App Store URL에서 App ID 추출 - 여러 패턴 시도
        let appId: string | null = null;

        // 패턴 1: /id123456 형식
        const match1 = url.match(/\/id(\d+)/);
        if (match1 && match1[1]) {
          appId = match1[1];
        }

        // 패턴 2: ?id=123456 형식
        if (!appId) {
          const match2 = url.match(/[?&]id=(\d+)/);
          if (match2 && match2[1]) {
            appId = match2[1];
          }
        }

        // 패턴 3: /app/id123456 형식
        if (!appId) {
          const match3 = url.match(/\/app\/id(\d+)/);
          if (match3 && match3[1]) {
            appId = match3[1];
          }
        }

        if (appId) {
          try {
            // URL에서 country code 추출 (예: /jp/app/... → jp)
            // iTunes Lookup API는 country 파라미터로 region별 localized 데이터 반환
            const countryMatch = url.match(/apps\.apple\.com\/([a-z]{2})\//i);
            const country = countryMatch?.[1]?.toLowerCase();
            const itunesUrl = country
              ? `https://itunes.apple.com/lookup?id=${appId}&country=${country}`
              : `https://itunes.apple.com/lookup?id=${appId}`;
            const itunesResponse = await timedFetch(itunesUrl, {}, 8_000);

            if (itunesResponse.ok) {
              const itunesData = await itunesResponse.json();

              if (itunesData.results && itunesData.results.length > 0) {
                const appData = itunesData.results[0];

                // 게임명 가져오기
                if (appData.trackName && !gameInfo.game_name) {
                  gameInfo.game_name = appData.trackName;
                }

                // Bundle ID 가져오기
                if (appData.bundleId && !gameInfo.package_identifier) {
                  gameInfo.package_identifier = appData.bundleId;
                }

                // 로고 URL 가져오기
                if (!gameInfo.logo_url) {
                  if (appData.artworkUrl512) {
                    gameInfo.logo_url = appData.artworkUrl512;
                  } else if (appData.artworkUrl100) {
                    gameInfo.logo_url = appData.artworkUrl100;
                  } else if (appData.artworkUrl60) {
                    gameInfo.logo_url = appData.artworkUrl60;
                  }
                }
              }
            }
          } catch (e) {
            // iTunes API 호출 실패 시 무시
            console.error('iTunes API 호출 중 오류:', e);
          }
        }

        // 2. JSON-LD 스키마에서 정보 추출 시도 (iTunes API에서 가져오지 못한 정보만)
        const jsonLdMatches = html.match(
          /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
        );
        if (jsonLdMatches) {
          for (const jsonLdMatch of jsonLdMatches) {
            try {
              const jsonContent = jsonLdMatch.match(
                /<script[^>]*>([\s\S]*?)<\/script>/i
              );
              if (jsonContent && jsonContent[1]) {
                const jsonLd = JSON.parse(jsonContent[1]);
                if (jsonLd.name && !gameInfo.game_name) {
                  gameInfo.game_name = jsonLd.name;
                }
                if (jsonLd.image && !gameInfo.logo_url) {
                  gameInfo.logo_url = Array.isArray(jsonLd.image)
                    ? jsonLd.image[0]
                    : jsonLd.image;
                }
              }
            } catch (e) {
              // JSON 파싱 실패 시 계속 진행
            }
          }
        }

        // 게임명 추출 - 여러 패턴 시도 (JSON-LD에서 가져오지 못한 경우)
        if (!gameInfo.game_name) {
          let nameMatch = html.match(
            /<h1[^>]*class="[^"]*product-header__title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i
          );
          if (!nameMatch) {
            nameMatch = html.match(
              /<h1[^>]*data-test="product-title"[^>]*>([\s\S]*?)<\/h1>/i
            );
          }
          if (!nameMatch) {
            nameMatch = html.match(
              /<h1[^>]*class="[^"]*product-header__title[^"]*"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i
            );
          }
          if (!nameMatch) {
            nameMatch = html.match(
              /<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i
            );
          }
          if (!nameMatch) {
            nameMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          }
          if (nameMatch) {
            // HTML 태그 제거
            let gameName = nameMatch[1]
              .replace(/<[^>]+>/g, '')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/&apos;/g, "'")
              .trim();
            // " - App Store" 같은 접미사 제거
            gameName = gameName
              .replace(/\s*[-–—]\s*App\s*Store.*$/i, '')
              .trim();
            if (gameName) {
              gameInfo.game_name = gameName;
            }
          }
        }

        // Bundle ID 추출 - 여러 방법 시도
        if (!gameInfo.package_identifier) {
          // 1. HTML의 data 속성에서 찾기
          const dataBundleIdMatch = html.match(/data-bundle-id="([^"]+)"/i);
          if (dataBundleIdMatch && dataBundleIdMatch[1]) {
            gameInfo.package_identifier = dataBundleIdMatch[1];
          }

          // 2. HTML 내의 스크립트 태그에서 Bundle ID 찾기
          if (!gameInfo.package_identifier) {
            const scriptMatches = html.match(
              /<script[^>]*>([\s\S]*?)<\/script>/gi
            );
            if (scriptMatches) {
              for (const scriptContent of scriptMatches) {
                let bundleIdMatch = scriptContent.match(
                  /bundleId["\s:=]+"([^"]+)"/i
                );
                if (!bundleIdMatch) {
                  bundleIdMatch = scriptContent.match(
                    /bundle-id["\s:=]+"([^"]+)"/i
                  );
                }
                if (!bundleIdMatch) {
                  bundleIdMatch = scriptContent.match(
                    /bundleIdentifier["\s:=]+"([^"]+)"/i
                  );
                }
                if (bundleIdMatch && bundleIdMatch[1]) {
                  gameInfo.package_identifier = bundleIdMatch[1];
                  break;
                }
              }
            }
          }

          // 3. JSON 내에서 Bundle ID 찾기
          if (!gameInfo.package_identifier) {
            const jsonMatches = html.match(/"bundleId"\s*:\s*"([^"]+)"/i);
            if (jsonMatches && jsonMatches[1]) {
              gameInfo.package_identifier = jsonMatches[1];
            }
          }
        }

        // 로고 이미지 추출 - 여러 패턴 시도
        if (!gameInfo.logo_url) {
          // og:image 메타 태그에서 추출
          let logoMatch = html.match(
            /<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i
          );
          if (!logoMatch) {
            logoMatch = html.match(
              /<meta[^>]*name="og:image"[^>]*content="([^"]+)"/i
            );
          }
          if (!logoMatch) {
            // product-header__artwork 이미지 추출 시도
            logoMatch = html.match(
              /<picture[^>]*class="[^"]*product-header__artwork[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i
            );
          }
          if (!logoMatch) {
            // 일반적인 앱 아이콘 이미지 추출
            logoMatch = html.match(
              /<img[^>]*class="[^"]*product-header__icon[^"]*"[^>]*src="([^"]+)"/i
            );
          }
          if (!logoMatch) {
            // srcset에서 추출 시도
            const srcsetMatch = html.match(/<img[^>]*srcset="([^"]+)"[^>]*>/i);
            if (srcsetMatch && srcsetMatch[1]) {
              // srcset에서 첫 번째 URL 추출
              const srcsetUrl = srcsetMatch[1]
                .split(',')[0]
                .trim()
                .split(' ')[0];
              logoMatch = srcsetMatch;
              logoMatch[1] = srcsetUrl;
            }
          }
          if (logoMatch && logoMatch[1]) {
            let logoUrl = logoMatch[1];
            // 상대 경로를 절대 경로로 변환
            if (logoUrl.startsWith('//')) {
              logoUrl = 'https:' + logoUrl;
            } else if (logoUrl.startsWith('/')) {
              const urlObj = new URL(url);
              logoUrl = urlObj.origin + logoUrl;
            }
            gameInfo.logo_url = logoUrl;
          }
        }
      } catch (error) {
        console.error('App Store 스크래핑 오류:', error);
      }
    }
    // Google Play URL 처리
    else if (url.includes('play.google.com')) {
      try {
        const response = await timedFetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }

        const html = await response.text();

        // JSON-LD 스키마에서 정보 추출 시도
        const jsonLdMatch = html.match(
          /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i
        );
        if (jsonLdMatch) {
          try {
            const jsonLd = JSON.parse(jsonLdMatch[1]);
            if (jsonLd.name) {
              gameInfo.game_name = jsonLd.name;
            }
            if (jsonLd.image) {
              gameInfo.logo_url = Array.isArray(jsonLd.image)
                ? jsonLd.image[0]
                : jsonLd.image;
            }
          } catch (e) {
            // JSON 파싱 실패 시 계속 진행
          }
        }

        // 게임명 추출 - 여러 패턴 시도 (JSON-LD에서 가져오지 못한 경우)
        if (!gameInfo.game_name) {
          let nameMatch = html.match(
            /<h1[^>]*itemprop="name"[^>]*>([\s\S]*?)<\/h1>/i
          );
          if (!nameMatch) {
            nameMatch = html.match(
              /<h1[^>]*class="[^"]*Fd93Bb[^"]*"[^>]*>([\s\S]*?)<\/h1>/i
            );
          }
          if (!nameMatch) {
            nameMatch = html.match(
              /<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i
            );
          }
          if (!nameMatch) {
            nameMatch = html.match(
              /<meta[^>]*name="title"[^>]*content="([^"]+)"/i
            );
          }
          if (!nameMatch) {
            nameMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          }
          if (nameMatch) {
            // HTML 태그 제거
            let gameName = nameMatch[1]
              .replace(/<[^>]+>/g, '')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/&apos;/g, "'")
              .trim();
            // " - Google Play" 같은 접미사 제거
            gameName = gameName
              .replace(/\s*[-–—]\s*Google\s*Play.*$/i, '')
              .trim();
            if (gameName) {
              gameInfo.game_name = gameName;
            }
          }
        }

        // Package Name 추출 (URL에서)
        if (!gameInfo.package_identifier) {
          const packageMatch = url.match(/[?&]id=([^&]+)/);
          if (packageMatch && packageMatch[1]) {
            gameInfo.package_identifier = decodeURIComponent(packageMatch[1]);
          }
        }

        // 로고 이미지 추출 - 여러 패턴 시도
        if (!gameInfo.logo_url) {
          // og:image 메타 태그에서 추출
          let logoMatch = html.match(
            /<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i
          );
          if (!logoMatch) {
            logoMatch = html.match(
              /<meta[^>]*name="og:image"[^>]*content="([^"]+)"/i
            );
          }
          if (!logoMatch) {
            // Google Play 앱 아이콘 이미지 추출
            logoMatch = html.match(
              /<img[^>]*alt="[^"]*icon[^"]*"[^>]*src="([^"]+)"/i
            );
          }
          if (!logoMatch) {
            // 일반적인 앱 아이콘 클래스 추출
            logoMatch = html.match(
              /<img[^>]*class="[^"]*T75of[^"]*"[^>]*src="([^"]+)"/i
            );
          }
          if (!logoMatch) {
            // srcset에서 추출 시도
            const srcsetMatch = html.match(/<img[^>]*srcset="([^"]+)"[^>]*>/i);
            if (srcsetMatch && srcsetMatch[1]) {
              // srcset에서 첫 번째 URL 추출
              const srcsetUrl = srcsetMatch[1]
                .split(',')[0]
                .trim()
                .split(' ')[0];
              logoMatch = srcsetMatch;
              logoMatch[1] = srcsetUrl;
            }
          }
          if (logoMatch && logoMatch[1]) {
            let logoUrl = logoMatch[1];
            // 상대 경로를 절대 경로로 변환
            if (logoUrl.startsWith('//')) {
              logoUrl = 'https:' + logoUrl;
            } else if (logoUrl.startsWith('/')) {
              const urlObj = new URL(url);
              logoUrl = urlObj.origin + logoUrl;
            }
            gameInfo.logo_url = logoUrl;
          }
        }
      } catch (error) {
        console.error('Google Play 스크래핑 오류:', error);
      }
    }
  } catch (error) {
    console.error('게임 정보 스크래핑 오류:', error);
    // 부분적으로 채워진 gameInfo라도 반환 (caller가 캐시함)
  }
}
