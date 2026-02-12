'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperAdminAuthRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/super_admin/auth/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Redirecting to Super Admin Login...</p>
    </div>
  );
}
