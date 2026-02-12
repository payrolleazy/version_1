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

export default function SuperAdminHierarchyDashboardPage() {
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const router = useRouter();

  const [metrics, setMetrics] = useState<Metrics>({});
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [maintenanceAction, setMaintenanceAction] = useState<string | null>(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const [metricsResult, healthResult] = await Promise.all([
        callPgFunction(HMS_GATEWAY_CONFIGS.METRICS_SUPER_ADMIN, {}, session.access_token),
        callPgFunction(HMS_GATEWAY_CONFIGS.HEALTH_CHECK_SUPER_ADMIN, {}, session.access_token),
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
    if (!isSessionLoading && !session) router.push('/super_admin/auth/login');
    if (session) fetchDashboardData();
  }, [session, isSessionLoading, router, fetchDashboardData]);

  const handleMaintenanceClick = (action: string) => {
    setMaintenanceAction(action);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmMaintenance = async () => {
    if (!session?.access_token || !maintenanceAction) return;
    setMaintenanceLoading(true);
    try {
      let configId = '';
      if (maintenanceAction === 'rebuild') {
        configId = HMS_GATEWAY_CONFIGS.MAINTENANCE_SUPER_ADMIN;
      } else if (maintenanceAction === 'backup') {
        configId = HMS_GATEWAY_CONFIGS.BACKUP;
      }

      const result = await callPgFunction(configId, {}, session.access_token);
      if (!result.success) {
        throw new Error(result.error || `Failed to execute ${maintenanceAction}`);
      }
      setIsConfirmModalOpen(false);
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
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Hierarchy Dashboard</h1>
            <p className="text-gray-600 mt-1">Monitor and maintain the organizational structure.</p>
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
            className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6"
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

          {/* Maintenance Controls */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-lg shadow-md border border-gray-200 p-6"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Maintenance Actions</h2>
            <p className="text-sm text-gray-500 mb-4">These actions affect the hierarchy data. Use with caution.</p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => handleMaintenanceClick('rebuild')}>
                Rebuild Org Chart Cache
              </Button>
              <Button variant="secondary" onClick={() => handleMaintenanceClick('backup')}>
                Create Backup
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {isConfirmModalOpen && (
        <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title="Confirm Maintenance Action">
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to <strong>{maintenanceAction === 'rebuild' ? 'rebuild the org chart cache' : 'create a backup'}</strong>?
              {maintenanceAction === 'rebuild' && <span className="block mt-2 text-sm text-amber-600">This will regenerate the entire organizational chart cache for the tenant.</span>}
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setIsConfirmModalOpen(false)}>Cancel</Button>
              <Button onClick={handleConfirmMaintenance} isLoading={maintenanceLoading}>
                Confirm
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </ErrorBoundary>
  );
}
