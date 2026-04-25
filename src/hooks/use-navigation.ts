import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { NAVIGATION_DATA } from '@/constants';
import { NavItem } from '@/types';

/**
 * 현재 경로에 따라 활성 상태가 설정된 네비게이션 아이템들을 반환
 */
export function useNavigationItems() {
  const pathname = usePathname();

  return useMemo(() => {
    return NAVIGATION_DATA.navMain.map((item) => ({
      ...item,
      isActive: item.url === pathname,
    }));
  }, [pathname]);
}

/**
 * 현재 활성 메뉴 아이템을 반환
 */
export function useActiveMenuItem() {
  const pathname = usePathname();

  return useMemo(() => {
    return NAVIGATION_DATA.navMain.find((item) => item.url === pathname);
  }, [pathname]);
}

/**
 * 사이드바 상태를 관리하는 훅
 */
export function useSidebarState() {
  const pathname = usePathname();

  return useMemo(
    () => ({
      currentPath: pathname,
      isHome: pathname === '/',
    }),
    [pathname]
  );
}
