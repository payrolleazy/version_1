'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import { LoadingState, ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { callPgFunction } from '@/lib/useGateway';
import { HMS_GATEWAY_CONFIGS } from '@/lib/constants';
import OrgChartTree from '@/components/hierarchy/OrgChartTree';

export default function EmployeeOrgChartPage() {
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const router = useRouter();

  const [orgData, setOrgData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchOrgChart = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await callPgFunction(
        HMS_GATEWAY_CONFIGS.ORG_CHART_EMPLOYEE,
        {},
        session.access_token
      );
      if (result.success) {
        const chartData = result.data?.data || result.data || [];
        setOrgData(Array.isArray(chartData) ? chartData : []);
      } else {
        throw new Error(result.error || 'Failed to fetch org chart');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!isSessionLoading && !session) router.push('/employee/auth/login');
    if (session) fetchOrgChart();
  }, [session, isSessionLoading, router, fetchOrgChart]);

  if (isSessionLoading) return <LoadingState message="Initializing session..." />;

  return (
    <ErrorBoundary>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Organization Chart</h1>
              <p className="text-gray-600 mt-1">Explore the organizational hierarchy.</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>
          )}

          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="mb-4">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by position, name, department..."
              />
            </div>

            {loading ? (
              <LoadingState message="Loading organization chart..." />
            ) : (
              <OrgChartTree
                data={orgData}
                readOnly={true}
                searchQuery={searchQuery}
              />
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
