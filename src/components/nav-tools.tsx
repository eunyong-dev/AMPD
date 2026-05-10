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

interface ExtendedNavToolsProps extends NavMainProps {
  pendingUrl?: string | null;
  onItemClick?: (itemUrl: string) => void;
}

export const NavTools = memo(function NavTools({
  items,
  pendingUrl,
  onItemClick,
}: ExtendedNavToolsProps) {
  const pathname = usePathname();

  const isActive = useCallback(
    (itemUrl: string) => {
      if (pendingUrl) return pendingUrl === itemUrl;
      if (itemUrl === pathname) return true;
      if (pathname.startsWith(itemUrl + '/')) return true;
      return false;
    },
    [pathname, pendingUrl]
  );

  if (items.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Tools</SidebarGroupLabel>
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
