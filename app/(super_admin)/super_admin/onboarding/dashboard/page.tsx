'use client';

import React from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import OnboardingDashboard from '@/components/onboarding/OnboardingDashboard';

export default function SuperAdminOnboardingDashboardPage() {
  const { session } = useSessionContext();
  if (!session) return <div className="min-h-screen flex items-center justify-center"><p>Loading session...</p></div>;
  return (
    <div className="p-8 bg-white rounded-lg shadow-md">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Onboarding Dashboard</h1>
      <OnboardingDashboard />
    </div>
  );
}
