/**
 * 테이블 셀에 `data-copy="raw값"` 을 달아두면, 사용자가 셀 영역을 복사할 때
 * 화면에 보이는 포맷된 텍스트(예: "$ 187.20") 대신 raw 값(예: "187.20")이
 * 클립보드에 들어가도록 복사 이벤트를 가로챈다.
 *
 * 두 가지 MIME type을 모두 set:
 *   - text/plain: 탭/개행 구분 (스프레드시트 호환)
 *   - text/html: <table> 구조 — Google Sheets가 숫자를 더 안정적으로
 *     인식하고 destination 셀의 서식($, 천단위 등)을 자동 적용
 *
 * 사용:
 *   const ref = useRef<HTMLTableElement>(null);
 *   useRawCopy(ref);
 *   <Table ref={ref}>...</Table>
 *   <TableCell data-copy={String(rawNumber)}>{formatted}</TableCell>
 */

import { useEffect, type RefObject } from 'react';

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// 문자열이 숫자(소수/정수)로 파싱 가능한지 — 통화기호/콤마는 미리 제거된 raw 값 가정
const isNumericString = (s: string): boolean => {
  if (s === '' || s == null) return false;
  // 음수, 소수, 지수 표기 모두 허용. 단순 숫자만 인식.
  return /^-?\d+(\.\d+)?$/.test(s.trim());
};

/**
 * Google Sheets는 data-sheets-value JSON 속성으로 type을 받으면
 * destination 셀의 number/currency 서식을 자동 적용한다.
 *   { "1": 3, "3": <number> } → number 타입
 *   { "1": 2, "2": "<text>" } → string 타입
 */
const buildCellHtml = (cell: string): string => {
  const escaped = escapeHtml(cell);
  if (isNumericString(cell)) {
    const num = Number(cell);
    const meta = JSON.stringify({ '1': 3, '3': num });
    return `<td data-sheets-value='${escapeHtml(meta)}'>${escaped}</td>`;
  }
  const meta = JSON.stringify({ '1': 2, '2': cell });
  return `<td data-sheets-value='${escapeHtml(meta)}'>${escaped}</td>`;
};

const buildHtmlTable = (rows: string[][]): string => {
  const trs = rows
    .map((cells) => `<tr>${cells.map(buildCellHtml).join('')}</tr>`)
    .join('');
  return `<table>${trs}</table>`;
};

export function useRawCopy(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const root = ref.current;
      if (!root) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !sel.toString()) return;

      // 선택 영역이 우리 테이블 안에 있는지 확인
      const anchor = sel.anchorNode;
      if (!anchor || !root.contains(anchor)) return;

      const rows = Array.from(root.querySelectorAll('tr'));
      const matrix: string[][] = [];

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td, th'));
        const cellTexts: string[] = [];
        let anySelected = false;

        for (const cell of cells) {
          if (sel.containsNode(cell, true)) {
            anySelected = true;
            const raw = cell.getAttribute('data-copy');
            cellTexts.push(
              raw ?? (cell.textContent?.replace(/\s+/g, ' ').trim() || '')
            );
          }
        }

        if (anySelected) matrix.push(cellTexts);
      }

      if (matrix.length === 0) return;

      e.preventDefault();
      const tsv = matrix.map((row) => row.join('\t')).join('\n');
      e.clipboardData?.setData('text/plain', tsv);
      e.clipboardData?.setData('text/html', buildHtmlTable(matrix));
    };

    document.addEventListener('copy', handler);
    return () => document.removeEventListener('copy', handler);
  }, [ref]);
}
