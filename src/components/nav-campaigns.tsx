'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { memo, useCallback } from 'react';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { NavMainProps } from '@/types';

interface ExtendedNavCampaignsProps extends NavMainProps {
  pendingUrl?: string | null;
  onItemClick?: (itemUrl: string) => void;
}

export const NavCampaigns = memo(function NavCampaigns({
  items,
  pendingUrl,
  onItemClick,
}: ExtendedNavCampaignsProps) {
  const pathname = usePathname();

  // 액티브 상태: pathname과 가장 길게 매칭되는 시블링 url 1개만 활성화.
  // (예: /campaigns/my 일 때 /campaigns 와 /campaigns/my 둘 다 활성되는 버그 방지)
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
      if (pendingUrl) return pendingUrl === itemUrl;
      return bestMatchUrl() === itemUrl;
    },
    [bestMatchUrl, pendingUrl]
  );

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Campaigns</SidebarGroupLabel>
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

