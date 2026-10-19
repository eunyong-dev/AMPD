'use client';

import { LogOutIcon, MoreVerticalIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { UserRole } from '@/lib/permissions';

// 기본 아바타 생성 함수
function generateDefaultAvatar(email: string, displayName: string): string {
  const initial = displayName
    ? displayName.charAt(0).toUpperCase()
    : email.charAt(0).toUpperCase();

  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }

  // 해시를 사용하여 색상 생성 (더 밝은 색상 사용)
  const hue = Math.abs(hash) % 360;
  const saturation = 60 + (Math.abs(hash) % 20); // 60-80%
  const lightness = 50 + (Math.abs(hash) % 20); // 50-70%

  const params = new URLSearchParams({
    name: initial,
    size: '32',
    background: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    color: 'fff',
    bold: 'true',
    format: 'svg',
  });

  return `https://ui-avatars.com/api/?${params.toString()}`;
}

// 역할 배지 컴포넌트
function RoleBadge({ role }: { role: UserRole }) {
  const getRoleConfig = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return {
          label: 'Admin',
          variant: 'destructive' as const,
          className:
            'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        };
      case 'am':
        return {
          label: 'AM',
          variant: 'secondary' as const,
          className:
            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        };
      default:
        return {
          label: 'Unknown',
          variant: 'outline' as const,
          className:
            'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
        };
    }
  };

  const config = getRoleConfig(role);

  return (
    <Badge
      variant={config.variant}
      className={`text-[10px] px-1.5 py-0.5 h-4 ${config.className}`}
    >
      {config.label}
    </Badge>
  );
}

export function NavUser({
  user,
  onSignOut,
}: {
  user: {
    name?: string;
    email?: string;
    avatar?: string;
    role?: UserRole;
  };
  onSignOut?: () => void;
}) {
  const { isMobile } = useSidebar();
  const router = useRouter();

  // 아바타 URL 생성 (없으면 기본 아바타)
  const avatarUrl =
    user.avatar ||
    (user.email && user.name
      ? generateDefaultAvatar(user.email, user.name)
      : '');

  const handleSignOut = async () => {
    try {
      if (onSignOut) {
        await onSignOut();
      }
      // 로그아웃 후 캠페인 현황으로 (로그인 화면이 뜬다)
      router.push('/campaigns');
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <Avatar className='h-8 w-8 rounded-lg'>
                <AvatarImage src={avatarUrl} alt={user.name || 'User'} />
                <AvatarFallback className='rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold'>
                  {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className='grid flex-1 text-left text-sm leading-tight'>
                <div className='flex items-center gap-2'>
                  <span className='truncate font-medium'>
                    {user.name || 'User'}
                  </span>
                  {user.role && <RoleBadge role={user.role} />}
                </div>
                <span className='truncate text-xs text-muted-foreground'>
                  {user.email || 'No email'}
                </span>
              </div>
              <MoreVerticalIcon className='ml-auto size-4' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg'
            side={isMobile ? 'bottom' : 'right'}
            align='end'
            sideOffset={4}
          >
            <DropdownMenuLabel className='p-0 font-normal'>
              <div className='flex items-center gap-2 px-1 py-1.5 text-left text-sm'>
                <Avatar className='h-8 w-8 rounded-lg'>
                  <AvatarImage src={avatarUrl} alt={user.name || 'User'} />
                  <AvatarFallback className='rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold'>
                    {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className='grid flex-1 text-left text-sm leading-tight'>
                  <div className='flex items-center gap-2'>
                    <span className='truncate font-medium'>
                      {user.name || 'User'}
                    </span>
                    {user.role && <RoleBadge role={user.role} />}
                  </div>
                  <span className='truncate text-xs text-muted-foreground'>
                    {user.email || 'No email'}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
