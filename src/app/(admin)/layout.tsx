'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, isAdmin } from '@/lib/auth-context';

/**
 * Admin layout - handles both auth and admin role checks
 * Redirects unauthenticated users to signin, non-admins to dashboard
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/signin');
    } else if (!isAdmin(user)) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  // Show nothing while loading or if not authenticated admin
  if (loading || !user || !isAdmin(user)) {
    return null;
  }

  return children;
}
