'use client';

import React from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import OnboardingEmailLog from '@/components/onboarding/OnboardingEmailLog';

export default function AdminEmailLogPage() {
  const { session } = useSessionContext();

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading session...</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-white rounded-lg shadow-md">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Email Log</h1>
      <OnboardingEmailLog />
    </div>
  );
}
