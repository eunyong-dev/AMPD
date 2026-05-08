/**
 * 테이블 셀에 `data-copy="raw값"` 을 달아두면, 사용자가 셀 영역을 복사할 때
 * 화면에 보이는 포맷된 텍스트(예: "$ 187.20") 대신 raw 값(예: "187.20")이
 * 클립보드에 들어가도록 복사 이벤트를 가로챈다.
 *
 * 다중 셀 선택 시 셀 사이는 탭(\t), 행 사이는 개행(\n)으로 결합 — 스프레드시트 붙여넣기 호환.
 *
 * 사용:
 *   const ref = useRef<HTMLTableElement>(null);
 *   useRawCopy(ref);
 *   <Table ref={ref}>...</Table>
 *   <TableCell data-copy={String(rawNumber)}>{formatted}</TableCell>
 */

import { useEffect, type RefObject } from 'react';

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
      const selectedRows: string[] = [];

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

        if (anySelected) selectedRows.push(cellTexts.join('\t'));
      }

      if (selectedRows.length === 0) return;

      e.preventDefault();
      e.clipboardData?.setData('text/plain', selectedRows.join('\n'));
    };

    document.addEventListener('copy', handler);
    return () => document.removeEventListener('copy', handler);
  }, [ref]);
}
