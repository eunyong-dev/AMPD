/**
 * 접근 권한 제어 컴포넌트
 */

'use client';

import { useUserContext } from '@/lib/user-context';
import { hasAccess } from '@/lib/permissions';
import { AlertTriangleIcon, ShieldXIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface AccessControlProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AccessControl({ children, fallback }: AccessControlProps) {
  const { profile, loading, error } = useUserContext();
  const router = useRouter();

  // 프로필 로딩 중일 때는 투명하게 처리 (깜빡임 방지)
  if (loading) {
    return null;
  }

  if (error) {
    return (
      <div className='flex items-center justify-center min-h-screen bg-background'>
        <div className='text-center max-w-md mx-auto p-6'>
          <div className='mb-6 flex justify-center'>
            <AlertTriangleIcon className='h-16 w-16 text-destructive' />
          </div>
          <h2 className='text-xl font-semibold mb-4'>Error Occurred</h2>
          <p className='text-muted-foreground mb-6'>{error}</p>
          <Button onClick={() => router.push('/campaigns')} className='w-full'>
            Go to Campaigns
          </Button>
        </div>
      </div>
    );
  }

  if (!hasAccess(profile?.role, profile?.is_active)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className='flex items-center justify-center min-h-screen bg-background'>
        <div className='text-center max-w-md mx-auto p-6'>
          <div className='mb-6 flex justify-center'>
            <ShieldXIcon className='h-16 w-16 text-destructive' />
          </div>
          <h2 className='text-xl font-semibold mb-4'>Access Denied</h2>
          <p className='text-muted-foreground mb-2'>
            {profile?.is_active === false
              ? 'Your account has been deactivated. '
              : "You don't have permission to access this page."}
          </p>
          <p className='text-sm text-muted-foreground'>
            Please contact your administrator for assistance.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
