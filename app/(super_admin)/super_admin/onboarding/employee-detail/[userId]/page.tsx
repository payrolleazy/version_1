'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useSessionContext } from '@supabase/auth-helpers-react';
import EmployeeOnboardingDetail from '@/components/onboarding/EmployeeOnboardingDetail';

export default function SuperAdminEmployeeDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { session } = useSessionContext();
  if (!session) return <div className="min-h-screen flex items-center justify-center"><p>Loading session...</p></div>;
  return (
    <div className="p-8 bg-white rounded-lg shadow-md">
      <EmployeeOnboardingDetail userId={userId} />
    </div>
  );
}
