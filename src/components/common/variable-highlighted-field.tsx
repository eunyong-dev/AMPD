'use client';

import { useId, useMemo, useRef, useCallback } from 'react';

interface VariableHighlightedFieldProps {
  value: string;
  onChange: (value: string) => void;
  validVariables: readonly string[]; // 유효한 변수 키 목록
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * {variableName} 패턴을 감지해서 입력 필드 위에 색상 칩처럼 표시.
 * - 유효한 변수 → 파란색
 * - 알 수 없는 변수 → 빨간색
 * 텍스트 자체는 투명하고 오버레이가 보이게 하는 방식.
 *
 * 정렬을 맞추려면 textarea/input 과 overlay 가 정확히 동일한 박스 모델을 가져야 함:
 * - 같은 padding, border, font, line-height, font-size
 * - 같은 white-space / word-wrap 처리
 * - 스크롤 위치 동기화 (textarea 가 스크롤될 때 overlay 도 같이 이동)
 */
export function VariableHighlightedField({
  value,
  onChange,
  validVariables,
  multiline = false,
  rows = 10,
  placeholder,
  disabled,
  id,
  className,
}: VariableHighlightedFieldProps) {
  const uid = useId();
  const inputId = id ?? uid;
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const segments = useMemo(() => {
    const parts = value.split(/(\{\w+\})/g);
    return parts.map((part, i) => {
      const m = part.match(/^\{(\w+)\}$/);
      if (m) {
        const isValid = validVariables.includes(m[1]);
        return {
          key: `${i}-${part}`,
          text: part,
          type: isValid ? ('valid' as const) : ('invalid' as const),
        };
      }
      return { key: `${i}`, text: part, type: 'text' as const };
    });
  }, [value, validVariables]);

  // textarea/input 의 스크롤 위치를 overlay 에 동기화
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      const target = e.currentTarget;
      if (overlayRef.current) {
        overlayRef.current.scrollTop = target.scrollTop;
        overlayRef.current.scrollLeft = target.scrollLeft;
      }
    },
    []
  );

  // 박스 모델 — textarea/input/overlay 모두 동일하게 적용해야 정렬 맞음
  const boxClass = multiline
    ? 'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono leading-5 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
    : 'block h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm leading-7 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className={`relative ${className ?? ''}`}>
      {/* 오버레이 — 텍스트는 투명하고 변수 강조만 보이도록 */}
      <div
        ref={overlayRef}
        aria-hidden
        className={`${boxClass} absolute inset-0 border-transparent shadow-none text-transparent overflow-hidden`}
        style={{
          whiteSpace: multiline ? 'pre-wrap' : 'pre',
          wordBreak: multiline ? 'break-word' : 'normal',
          overflowWrap: multiline ? 'break-word' : 'normal',
          pointerEvents: 'none',
        }}
      >
        {segments.map((seg) => {
          if (seg.type === 'text') {
            return (
              <span key={seg.key} className='text-foreground'>
                {seg.text}
              </span>
            );
          }
          if (seg.type === 'valid') {
            return (
              <span
                key={seg.key}
                className='rounded bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
              >
                {seg.text}
              </span>
            );
          }
          return (
            <span
              key={seg.key}
              className='rounded bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300'
            >
              {seg.text}
            </span>
          );
        })}
        {/* 줄 끝 빈 라인 보존 */}
        {multiline && value.endsWith('\n') && <span>&nbsp;</span>}
      </div>

      {multiline ? (
        <textarea
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          rows={rows}
          placeholder={placeholder}
          disabled={disabled}
          className={`${boxClass} relative bg-transparent text-transparent caret-foreground selection:bg-primary/30`}
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            resize: 'vertical',
          }}
          spellCheck={false}
          autoComplete='off'
        />
      ) : (
        <input
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          placeholder={placeholder}
          disabled={disabled}
          className={`${boxClass} relative bg-transparent text-transparent caret-foreground selection:bg-primary/30`}
          spellCheck={false}
          autoComplete='off'
        />
      )}
    </div>
  );
}
