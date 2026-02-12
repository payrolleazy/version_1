'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { LoadingState, ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { callPgFunction } from '@/lib/useGateway';
import { HMS_GATEWAY_CONFIGS } from '@/lib/constants';

interface Metrics {
  total_positions?: number;
  filled_positions?: number;
  vacant_positions?: number;
  max_depth?: number;
  avg_direct_reports?: number;
  [key: string]: any;
}

interface HealthStatus {
  status?: 'healthy' | 'warning' | 'critical';
  message?: string;
  checks?: any[];
  [key: string]: any;
}

export default function MasterAdminHierarchyDashboardPage() {
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const router = useRouter();

  const [metrics, setMetrics] = useState<Metrics>({});
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const [metricsResult, healthResult] = await Promise.all([
        callPgFunction(HMS_GATEWAY_CONFIGS.METRICS_MASTER_ADMIN, {}, session.access_token),
        callPgFunction(HMS_GATEWAY_CONFIGS.HEALTH_CHECK_MASTER_ADMIN, {}, session.access_token),
      ]);

      if (metricsResult.success) {
        setMetrics(metricsResult.data?.data || metricsResult.data || {});
      }
      if (healthResult.success) {
        setHealthStatus(healthResult.data?.data || healthResult.data || {});
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!isSessionLoading && !session) router.push('/master_admin/auth/login');
    if (session) fetchDashboardData();
  }, [session, isSessionLoading, router, fetchDashboardData]);

  if (isSessionLoading || loading) return <LoadingState message="Loading hierarchy dashboard..." />;

  const statCards = [
    { label: 'Total Positions', value: metrics.total_positions ?? '-', color: 'from-blue-500 to-blue-600' },
    { label: 'Filled Positions', value: metrics.filled_positions ?? '-', color: 'from-green-500 to-green-600' },
    { label: 'Vacant Positions', value: metrics.vacant_positions ?? '-', color: 'from-amber-500 to-amber-600' },
    { label: 'Max Depth', value: metrics.max_depth ?? '-', color: 'from-purple-500 to-purple-600' },
  ];

  const healthColor = healthStatus.status === 'healthy' ? 'bg-green-100 text-green-800 border-green-200'
    : healthStatus.status === 'warning' ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
    : healthStatus.status === 'critical' ? 'bg-red-100 text-red-800 border-red-200'
    : 'bg-gray-100 text-gray-800 border-gray-200';

  return (
    <ErrorBoundary>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Hierarchy Dashboard</h1>
            <p className="text-gray-600 mt-1">Overview of the organizational structure health and metrics.</p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>
          )}

          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {statCards.map((card, index) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-gradient-to-r ${card.color} rounded-lg shadow-md p-6 text-white`}
              >
                <p className="text-sm opacity-80">{card.label}</p>
                <p className="text-3xl font-bold mt-1">{card.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Health Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-lg shadow-md border border-gray-200 p-6"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">System Health</h2>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${healthColor}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${
                healthStatus.status === 'healthy' ? 'bg-green-500'
                : healthStatus.status === 'warning' ? 'bg-yellow-500'
                : healthStatus.status === 'critical' ? 'bg-red-500'
                : 'bg-gray-500'
              }`} />
              <span className="font-medium capitalize">{healthStatus.status || 'Unknown'}</span>
            </div>
            {healthStatus.message && (
              <p className="mt-3 text-sm text-gray-600">{healthStatus.message}</p>
            )}
            {healthStatus.checks && healthStatus.checks.length > 0 && (
              <div className="mt-4 space-y-2">
                {healthStatus.checks.map((check: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full ${check.passed ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-gray-700">{check.name || check.check}: {check.passed ? 'Passed' : 'Failed'}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
