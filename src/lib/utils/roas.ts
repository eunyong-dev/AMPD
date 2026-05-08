import * as React from 'react';

// ROAS 계열 컬럼 판별 (ROAS, D0 ROAS, D7 ROAS ...)
export const isRoasColumn = (header: string) =>
  header.toLowerCase().includes('roas');

// "130.20%" / "0.6502" 같은 문자열을 0.0~∞ 비율로 파싱
export const parseRoasPercent = (val: unknown): number | null => {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (!str || str === '-') return null;
  const hasPercent = str.endsWith('%');
  const cleaned = str.replace(/[$,\s]/g, '').replace(/%$/, '');
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  return hasPercent ? n / 100 : n;
};

// ROAS 값에 따른 배경색: 0% → 투명, 100% 이상 → 가장 진한 녹색
export const roasBgStyle = (
  val: unknown
): React.CSSProperties | undefined => {
  const num = parseRoasPercent(val);
  if (num === null || num <= 0) return undefined;
  const opacity = Math.min(num, 1) * 0.6;
  return { backgroundColor: `rgba(34, 197, 94, ${opacity})` };
};
