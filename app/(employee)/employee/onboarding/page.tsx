'use client';

import React, { useEffect, useRef } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import EmployeeOnboardingStatus from '@/components/onboarding/EmployeeOnboardingStatus';

export default function EmployeeOnboardingPage() {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const router = useRouter();
  const initialLoadComplete = useRef(false);

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push('/employee/auth/login');
    }
  }, [session, sessionLoading, router]);

  useEffect(() => {
    if (!sessionLoading && session) {
      initialLoadComplete.current = true;
    }
  }, [sessionLoading, session]);

  if (!initialLoadComplete.current && sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading session...</p>
      </div>
    );
  }

  if (initialLoadComplete.current && !sessionLoading && !session) {
    router.push('/employee/auth/login');
    return null;
  }

  return (
    <div className="p-8 bg-white rounded-lg shadow-md min-h-screen">
      <EmployeeOnboardingStatus />
    </div>
  );
}
