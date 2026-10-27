/**
 * 게임 장르 — 스토어 카테고리 기준 (구글 플레이 게임 카테고리 17종 + 앱스토어 전용 일부)
 * - 구글 플레이: JSON-LD applicationCategory (예: GAME_PUZZLE)
 * - 앱스토어: iTunes Lookup genres (예: ["Games", "Puzzle", "Casual"])
 */
export const GAME_GENRES = [
  'Action',
  'Adventure',
  'Arcade',
  'Board',
  'Card',
  'Casino',
  'Casual',
  'Educational',
  'Family',
  'Music',
  'Puzzle',
  'Racing',
  'Role Playing',
  'Simulation',
  'Sports',
  'Strategy',
  'Trivia',
  'Word',
] as const;

const PLAY_CATEGORY_TO_GENRE: Record<string, string> = {
  GAME_ACTION: 'Action',
  GAME_ADVENTURE: 'Adventure',
  GAME_ARCADE: 'Arcade',
  GAME_BOARD: 'Board',
  GAME_CARD: 'Card',
  GAME_CASINO: 'Casino',
  GAME_CASUAL: 'Casual',
  GAME_EDUCATIONAL: 'Educational',
  GAME_MUSIC: 'Music',
  GAME_PUZZLE: 'Puzzle',
  GAME_RACING: 'Racing',
  GAME_ROLE_PLAYING: 'Role Playing',
  GAME_SIMULATION: 'Simulation',
  GAME_SPORTS: 'Sports',
  GAME_STRATEGY: 'Strategy',
  GAME_TRIVIA: 'Trivia',
  GAME_WORD: 'Word',
};

/** 구글 플레이 카테고리 코드 → 장르 (게임이 아니면 null) */
export function playCategoryToGenre(code: string | null | undefined) {
  if (!code) return null;
  return PLAY_CATEGORY_TO_GENRE[code.trim().toUpperCase()] ?? null;
}

/** 앱스토어 genres → 장르 — "Games" 다음에 오는 첫 하위 장르 */
export function appleGenresToGenre(genres: unknown): string | null {
  if (!Array.isArray(genres) || !genres.includes('Games')) return null;
  const sub = genres.find(
    (g): g is string => typeof g === 'string' && g !== 'Games'
  );
  if (!sub) return null;
  // 앱스토어는 "Role-Playing" 처럼 표기가 조금 다름
  return sub === 'Role-Playing' ? 'Role Playing' : sub;
}
