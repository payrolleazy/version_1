'use client';

import React from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import ActiveWorkflowsTable from '@/components/onboarding/ActiveWorkflowsTable';

export default function SuperAdminActiveWorkflowsPage() {
  const { session } = useSessionContext();
  if (!session) return <div className="min-h-screen flex items-center justify-center"><p>Loading session...</p></div>;
  return (
    <div className="p-8 bg-white rounded-lg shadow-md">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Active Workflows</h1>
      <ActiveWorkflowsTable basePath="/super_admin" />
    </div>
  );
}
