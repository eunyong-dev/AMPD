/**
 * 캠페인/정산 라인 정렬 헬퍼
 *
 * 규칙:
 * 1) 베이스 이름 가나다순 (이름 끝의 _KR/_JP/_TW/_US suffix는 제거 후 비교)
 * 2) 같은 베이스 이름 내에서는 region 우선순위 KR > JP > TW > US > 기타
 */

export const REGION_PRIORITY: Record<string, number> = {
  KR: 0,
  JP: 1,
  TW: 2,
  US: 3,
};

export const stripRegionSuffix = (name: string): string => {
  const m = name.match(/_(KR|JP|TW|US)$/);
  return m ? name.slice(0, -m[0].length) : name;
};

const extractRegionFromName = (name: string): string | null => {
  const m = name.match(/_(KR|JP|TW|US)$/);
  return m ? m[1] : null;
};

const compareBaseName = (a: string, b: string): number =>
  stripRegionSuffix(a).localeCompare(stripRegionSuffix(b), 'ko-KR', {
    numeric: true,
    sensitivity: 'base',
  });

const compareRegion = (a: string | null | undefined, b: string | null | undefined) =>
  (REGION_PRIORITY[a ?? ''] ?? 99) - (REGION_PRIORITY[b ?? ''] ?? 99);

/**
 * 이름 + 옵션 region으로 정렬.
 * region이 없으면 이름만으로 비교.
 */
export function compareByNameAndRegion<
  T extends { name: string; region?: string | null }
>(a: T, b: T): number {
  const cmp = compareBaseName(a.name, b.name);
  if (cmp !== 0) return cmp;
  // region 필드가 없으면 name suffix에서 추출 (예: "_KR")
  const ra = a.region ?? extractRegionFromName(a.name);
  const rb = b.region ?? extractRegionFromName(b.name);
  return compareRegion(ra, rb);
}

/**
 * description(패키지명 등) + geo로 정렬.
 * 정산 라인 같은 데이터에 사용.
 */
export function compareByDescriptionAndGeo<
  T extends { description?: string | null; geo?: string | null }
>(a: T, b: T): number {
  const cmp = compareBaseName(a.description ?? '', b.description ?? '');
  if (cmp !== 0) return cmp;
  return compareRegion(a.geo, b.geo);
}
