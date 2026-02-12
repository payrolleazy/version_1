'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import Modal from '@/components/Modal';
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

export default function AdminHierarchyDashboardPage() {
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const router = useRouter();

  const [metrics, setMetrics] = useState<Metrics>({});
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Maintenance state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [maintenanceAction, setMaintenanceAction] = useState<'rebuild' | 'backup' | null>(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const [metricsResult, healthResult] = await Promise.all([
        callPgFunction(HMS_GATEWAY_CONFIGS.METRICS, {}, session.access_token),
        callPgFunction(HMS_GATEWAY_CONFIGS.HEALTH_CHECK, {}, session.access_token),
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
    if (!isSessionLoading && !session) router.push('/admin/auth/login');
    if (session) fetchDashboardData();
  }, [session, isSessionLoading, router, fetchDashboardData]);

  const handleMaintenanceAction = (action: 'rebuild' | 'backup') => {
    setMaintenanceAction(action);
    setIsConfirmOpen(true);
  };

  const executeMaintenanceAction = async () => {
    if (!session?.access_token || !maintenanceAction) return;
    setMaintenanceLoading(true);
    try {
      const configId = maintenanceAction === 'rebuild'
        ? HMS_GATEWAY_CONFIGS.MAINTENANCE
        : HMS_GATEWAY_CONFIGS.BACKUP;
      const payload = maintenanceAction === 'rebuild'
        ? { operation: 'rebuild_cache' }
        : {};
      const result = await callPgFunction(configId, payload, session.access_token);
      if (!result.success) throw new Error(result.error || `Failed to ${maintenanceAction}.`);
      setIsConfirmOpen(false);
      await fetchDashboardData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setMaintenanceLoading(false);
    }
  };

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
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Hierarchy Dashboard</h1>
              <p className="text-gray-600 mt-1">Monitor organizational structure health and perform maintenance.</p>
            </div>
            <Button variant="secondary" onClick={fetchDashboardData}>Refresh</Button>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

            {/* Maintenance Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-lg shadow-md border border-gray-200 p-6"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Maintenance Actions</h2>
              <p className="text-sm text-gray-600 mb-4">Perform maintenance operations on the hierarchy data.</p>
              <div className="space-y-3">
                <button
                  onClick={() => handleMaintenanceAction('rebuild')}
                  className="w-full flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Rebuild Org Chart Cache</p>
                    <p className="text-xs text-gray-500">Regenerate the pre-computed org chart from live data.</p>
                  </div>
                </button>
                <button
                  onClick={() => handleMaintenanceAction('backup')}
                  className="w-full flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Create Backup</p>
                    <p className="text-xs text-gray-500">Create a snapshot of the current hierarchy state.</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {isConfirmOpen && (
        <Modal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} title={maintenanceAction === 'rebuild' ? 'Rebuild Org Chart Cache' : 'Create Backup'}>
          <div className="space-y-4">
            <p className="text-gray-600">
              {maintenanceAction === 'rebuild'
                ? 'This will regenerate the pre-computed org chart cache from live data. Existing cache will be replaced.'
                : 'This will create a snapshot of the current hierarchy state.'}
            </p>
            <p className="text-sm text-amber-600">Are you sure you want to proceed?</p>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setIsConfirmOpen(false)}>Cancel</Button>
              <Button onClick={executeMaintenanceAction} isLoading={maintenanceLoading}>
                Confirm
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </ErrorBoundary>
  );
}
