// 날짜에 요일을 추가하는 함수
export function formatDateWithWeekday(value: any): string {
  if (value === null || value === undefined || value === '') return '-';

  const dateStr = String(value);
  // "2025.11.1" 형식을 파싱
  const match = dateStr.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (!match) return dateStr; // 형식이 맞지 않으면 원본 반환

  const [, year, month, day] = match;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

  // 요일 배열 (일요일부터)
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[date.getDay()];

  // 월과 일을 항상 2자리로 포맷팅하여 정렬 일관성 유지
  const formattedMonth = month.padStart(2, '0');
  const formattedDay = day.padStart(2, '0');
  const formattedDate = `${year}.${formattedMonth}.${formattedDay}`;

  return `${formattedDate} (${weekday})`;
}

// 날짜가 일요일인지 확인하는 함수
export function isSunday(value: any): boolean {
  if (value === null || value === undefined || value === '') return false;

  const dateStr = String(value);
  // 구분자: . - / 모두 지원
  const match = dateStr.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!match) return false;

  const [, year, month, day] = match;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

  // getDay()에서 0은 일요일
  return date.getDay() === 0;
}

// 매출 값을 소수점 둘째 자리까지만 표시하는 함수
export function formatSales(value: any): string {
  if (value === null || value === undefined || value === '') return '-';
  const numValue =
    typeof value === 'string' ? parseFloat(value) : Number(value);
  if (isNaN(numValue)) return String(value);
  return numValue.toFixed(2);
}

// 날짜 문자열을 Date 객체로 변환하는 함수
export function parseSheetDate(
  dateStr: string | null | undefined
): Date | null {
  if (!dateStr) return null;

  const str = String(dateStr);
  // 구분자: . - / 모두 지원
  // 예: "2025.11.1", "2025-11-12", "2025/11/01", "2026-04-09 (목)"
  const match = str.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  // 시간을 00:00:00으로 설정하여 날짜만 비교
  date.setHours(0, 0, 0, 0);
  return date;
}
