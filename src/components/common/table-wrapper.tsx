'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * 테이블 래퍼 컴포넌트 - 공통 스타일링 적용
 */
interface TableWrapperProps {
  children: React.ReactNode;
  className?: string;
  enableHorizontalScroll?: boolean;
  /**
   * true: 부모 영역 높이만큼 채우고 내부에서 스크롤 (sticky 헤더 동작).
   *       부모가 명시적 높이/flex-1 등으로 높이를 가져야 효과적.
   * false (기본): 콘텐츠 높이만큼만 차지 (가로 스크롤만).
   */
  fillHeight?: boolean;
}

export function TableWrapper({
  children,
  className,
  enableHorizontalScroll = true,
  fillHeight = false,
}: TableWrapperProps) {
  if (fillHeight) {
    // sticky header 가 동작하려면 스크롤 컨테이너가 헤더의 직계 조상이어야 함.
    // min-w-0 으로 flex item 이 자식 폭만큼 늘어나지 않도록 막아 페이지 가로
    // 스크롤 방지 (테이블 자체는 inner overflow-auto 로 가로 스크롤).
    return (
      <div
        className={cn(
          'w-full min-w-0 overflow-hidden rounded-xl border flex flex-col min-h-0',
          className
        )}
      >
        <div className='flex-1 min-w-0 min-h-0 overflow-auto'>{children}</div>
      </div>
    );
  }
  return (
    <div className={cn('w-full overflow-hidden rounded-xl border', className)}>
      {enableHorizontalScroll ? (
        <div className='overflow-x-auto'>{children}</div>
      ) : (
        children
      )}
    </div>
  );
}

/**
 * 테이블 스타일 상수
 */
export const TABLE_STYLES = {
  // [&_tr]:border-b-2 : 헤더 행 하단 경계선을 굵게 (스크롤 시 body 와 시각 분리)
  // border-border : 기본 border 보다 한 톤 진한 색상
  header:
    'sticky top-0 z-20 bg-muted [&_tr]:border-b-2 [&_tr]:border-border [&_th]:py-2 [&_th]:px-2 [&_th]:h-9',
  body: '[&_td]:py-2 [&_td]:px-2',
  table: 'tableLayout: fixed, width: 100%',
} as const;

/**
 * 기본 테이블 레이아웃 컴포넌트
 */
interface BaseTableProps {
  children: React.ReactNode;
  headerContent: React.ReactNode;
  bodyContent: React.ReactNode;
  className?: string;
  enableHorizontalScroll?: boolean;
}

export function BaseTable({
  headerContent,
  bodyContent,
  className,
  enableHorizontalScroll = true,
}: BaseTableProps) {
  return (
    <TableWrapper
      className={className}
      enableHorizontalScroll={enableHorizontalScroll}
    >
      <Table style={{ tableLayout: 'fixed', width: '100%' }}>
        <TableHeader className={TABLE_STYLES.header}>
          <TableRow>{headerContent}</TableRow>
        </TableHeader>
        <TableBody className={TABLE_STYLES.body}>{bodyContent}</TableBody>
      </Table>
    </TableWrapper>
  );
}

