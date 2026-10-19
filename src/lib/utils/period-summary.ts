/**
 * 캠페인 기간 아래 한 줄 요약 (내부 캠페인 표 · 공개 뷰어 공용)
 */
const DAY_MS = 86_400_000;
const toDay = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00`).getTime();

// 기간 아래 한 줄 요약 — 진행중: D+N · 종료 N일 전 / 끝남: N일 전 종료 / 계획: 시작 N일 전
export function periodSummary(
  startDate: string | null,
  endDate: string | null,
  status: string | null
): { text: string; progress: number | null } | null {
  if (!startDate || startDate.startsWith('1900')) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = today.getTime();
  const start = toDay(startDate);
  const end = endDate ? toDay(endDate) : null;
  if (status === 'ongoing') {
    const elapsed = Math.round((now - start) / DAY_MS);
    if (elapsed < 0) return { text: `시작 ${-elapsed}일 전`, progress: null };
    if (end === null) return { text: `D+${elapsed} · 종료일 미정`, progress: null };
    const left = Math.round((end - now) / DAY_MS);
    const total = Math.max(1, Math.round((end - start) / DAY_MS));
    return {
      text: left >= 0 ? `D+${elapsed} · 종료 ${left}일 전` : `D+${elapsed} · 종료일 지남`,
      progress: Math.min(100, Math.max(0, (elapsed / total) * 100)),
    };
  }
  if (status === 'planning') {
    const until = Math.round((start - now) / DAY_MS);
    return until > 0 ? { text: `시작 ${until}일 전`, progress: null } : null;
  }
  if (end !== null) {
    const ago = Math.round((now - end) / DAY_MS);
    return ago > 0 ? { text: `${ago}일 전 종료`, progress: null } : null;
  }
  return null;
}
