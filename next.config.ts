import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 서버리스 함수 번들에서 제외 — Vercel 에서는 @sparticuz/chromium 의 binary 사용
  // puppeteer 풀 패키지는 로컬 dev 에서만 동적 import 됨
  serverExternalPackages: [
    'puppeteer',
    'puppeteer-core',
    '@sparticuz/chromium',
  ],
  images: {
    remotePatterns: [
      // 기본 아바타 (이메일/이름 기반)
      { protocol: 'https', hostname: 'ui-avatars.com' },
      // Google OAuth 사용자 아바타
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      // Apple App Store 게임 아이콘 (iTunes API artworkUrl*)
      { protocol: 'https', hostname: 'is1-ssl.mzstatic.com' },
      { protocol: 'https', hostname: 'is2-ssl.mzstatic.com' },
      { protocol: 'https', hostname: 'is3-ssl.mzstatic.com' },
      { protocol: 'https', hostname: 'is4-ssl.mzstatic.com' },
      { protocol: 'https', hostname: 'is5-ssl.mzstatic.com' },
      // Google Play 게임 아이콘
      { protocol: 'https', hostname: 'play-lh.googleusercontent.com' },
      // Supabase Storage (사용자 업로드 이미지가 있을 경우)
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
    ],
  },
};
export default nextConfig;
