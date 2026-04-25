'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { memo, useCallback } from 'react';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { NavMainProps } from '@/types';

interface ExtendedNavMainProps extends NavMainProps {
  pendingUrl?: string | null;
  onItemClick?: (itemUrl: string) => void;
}

export const NavMain = memo(function NavMain({ items, pendingUrl, onItemClick }: ExtendedNavMainProps) {
  const pathname = usePathname();

  // 액티브 상태: 시블링 url 중 pathname과 가장 길게 매칭되는 1개만 활성화.
  // (prefix 충돌하는 메뉴 두 개가 동시에 활성되는 버그 방지)
  const bestMatchUrl = useCallback(() => {
    const candidates = items
      .map((it) => it.url)
      .filter(
        (url) => pathname === url || pathname.startsWith(url + '/')
      )
      .sort((a, b) => b.length - a.length);
    return candidates[0] ?? null;
  }, [items, pathname]);

  const isActive = useCallback(
    (itemUrl: string) => {
      // Optimistic highlight while navigating
      if (pendingUrl) return pendingUrl === itemUrl;
      return bestMatchUrl() === itemUrl;
    },
    [bestMatchUrl, pendingUrl]
  );

  return (
    <SidebarGroup>
      <SidebarGroupContent className='flex flex-col gap-2'>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={isActive(item.url)}
              >
                <Link
                  href={item.url}
                  className='flex items-center gap-2'
                  onClick={() => onItemClick?.(item.url)}
                >
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
});
