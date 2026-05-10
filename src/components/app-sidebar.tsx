'use client';

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Zap } from 'lucide-react';
import Link from 'next/link';

import { NavDocuments } from '@/components/nav-documents';
import { NavMain } from '@/components/nav-main';
import { NavCampaigns } from '@/components/nav-campaigns';
import { NavTools } from '@/components/nav-tools';
import { NavAdmin } from '@/components/nav-admin';
import { NavSecondary } from '@/components/nav-secondary';
import { NavUser } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { NAVIGATION_DATA } from '@/constants';
import { AppSidebarProps } from '@/types';
import { useUserContext } from '@/lib/user-context';

export function AppSidebar({ user, onSignOut, ...props }: AppSidebarProps) {
  const { profile } = useUserContext();
  const pathname = usePathname();
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  // Clear pending when route actually changes
  useEffect(() => {
    if (pendingUrl) setPendingUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // 사용자 데이터 메모이제이션
  const userData = useMemo(() => {
    if (profile) {
      return {
        name: profile.display_name || 'User',
        email: profile.email || '',
        avatar: profile.avatar_url || '',
        role: profile.role,
      };
    }

    if (user) {
      return {
        name:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'User',
        email: user.email || '',
        avatar:
          user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
        role: undefined,
      };
    }

    return NAVIGATION_DATA.user;
  }, [profile, user]);

  return (
    <Sidebar variant='floating' collapsible='offcanvas' {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className='data-[slot=sidebar-menu-button]:!p-1.5'
            >
              <Link href='/'>
                <div className='flex items-center justify-center bg-primary text-primary-foreground rounded-md p-1'>
                  <Zap className='h-4 w-4' />
                </div>
                <span className='text-lg font-semibold'>AMPD</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={NAVIGATION_DATA.navMain}
          pendingUrl={pendingUrl}
          onItemClick={setPendingUrl}
        />
        <NavCampaigns
          items={NAVIGATION_DATA.navCampaigns}
          pendingUrl={pendingUrl}
          onItemClick={setPendingUrl}
        />
        <NavTools
          items={NAVIGATION_DATA.navTools}
          pendingUrl={pendingUrl}
          onItemClick={setPendingUrl}
        />
        <NavDocuments items={NAVIGATION_DATA.documents} />
        <NavAdmin
          items={NAVIGATION_DATA.navAdmin}
          pendingUrl={pendingUrl}
          onItemClick={setPendingUrl}
        />
        <NavSecondary
          items={NAVIGATION_DATA.navSecondary}
          className='mt-auto'
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} onSignOut={onSignOut} />
      </SidebarFooter>
    </Sidebar>
  );
}
