'use client';

import Modal from '@/components/Modal';
import { useEffect, useState, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Loader from '@/components/ui/Loader';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================

interface DashboardStats {
  total_active_members: number;
  total_establishments: number;
  open_anomalies: number;
  current_month_total_contribution: number;
  employees_with_ceiling_override: number;
  employees_with_employer_excess: number;
}

interface RecentBatch {
  id: number;
  batch_code: string;
  payroll_period: string;
  status: string;
  progress_percentage: number;
  total_employees: number;
  processed_employees: number;
  anomalies_detected: number;
  created_at: string;
}

interface CriticalAnomaly {
  id: number;
  user_id: string;
  payroll_period: string;
  anomaly_type: string;
  severity: string;
  anomaly_description: string;
  detected_at: string;
}

interface SystemHealth {
    status: string;
    checks: {
      missing_partitions: boolean;
      healed_stale_locks: number;
      quarantined_failed_batches: number;
      pending_batches: number;
      unresolved_critical_anomalies: number;
      overdue_challans: number;
    };
    auto_fixes_applied: boolean;
    recommendations: string[];
    timestamp: string;
}


// ============================================================================
// 2. CONFIGURATION CONSTANTS (Gateway IDs from pf_frontend_prompt.txt)
// ============================================================================

const CONFIGS = {
  // PF Dashboard
  READ_DASHBOARD_STATS: '16c03167-ddb3-49d7-b339-7335dae5309f',
  READ_RECENT_BATCHES: '0d07cdf7-4f38-4c08-a530-c63caf97d4f5',
  READ_CRITICAL_ANOMALIES: '643c5c14-b299-41b4-8545-6a407faaa748',
  SYSTEM_HEALTH_CHECK: 'wcm-pf-health-check',
};


// ============================================================================
// 3. HELPER: GENERIC API CALLER
// ============================================================================
async function callGateway(endpoint: string, payload: any, token: string) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ ...payload, accessToken: token }),
  });
  const result = await response.json();
  if (!response.ok || (result.hasOwnProperty('success') && !result.success)) {
    throw new Error(result.message || result.error || 'API Request Failed');
  }
  return result;
}


// ============================================================================
// 4. MAIN PAGE COMPONENT
// ============================================================================

export default function PfDashboardPage() {
  const [session, setSession] = useState<any>(null);
  
  // --- State ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [batches, setBatches] = useState<RecentBatch[]>([]);
  const [anomalies, setAnomalies] = useState<CriticalAnomaly[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);

  // State for Manual PF Computation Modal
  const [showManualBatchModal, setShowManualBatchModal] = useState(false);
  const [payrollPeriod, setPayrollPeriod] = useState('');
  const [establishmentId, setEstablishmentId] = useState('');
  const [employeeCodesInput, setEmployeeCodesInput] = useState(''); // Comma-separated or newline-separated employee codes
  const [includeAllActive, setIncludeAllActive] = useState(false);
  const [manualBatchReason, setManualBatchReason] = useState('');
  const [manualBatchLoading, setManualBatchLoading] = useState(false);
  const [manualBatchError, setManualBatchError] = useState<string | null>(null);
  const [manualBatchSuccessMessage, setManualBatchSuccessMessage] = useState<string | null>(null);


  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
  }, []);

  // ==========================
  // DATA FETCHING METHODS
  // ==========================

  const fetchData = useCallback(async (isPolling = false) => {
    if (!session?.access_token) return;
    if (!isPolling) setLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [statsRes, batchesRes, anomaliesRes] = await Promise.all([
        callGateway('/api/a_crud_universal_read', {
          config_id: CONFIGS.READ_DASHBOARD_STATS,
          params: { limit: 1 }
        }, session.access_token),
        callGateway('/api/a_crud_universal_read', {
          config_id: CONFIGS.READ_RECENT_BATCHES,
          params: { orderBy: [{ column: 'created_at', ascending: false }], limit: 10 }
        }, session.access_token),
        callGateway('/api/a_crud_universal_read', {
          config_id: CONFIGS.READ_CRITICAL_ANOMALIES,
          params: {
            filters: [
              { column: 'severity', operator: 'eq', value: 'CRITICAL' },
              { column: 'resolution_status', operator: 'eq', value: 'OPEN' }
            ],
            orderBy: [{ column: 'detected_at', ascending: false }],
            limit: 10
          }
        }, session.access_token)
      ]);

      setStats(statsRes.data?.[0] || null);
      setBatches(batchesRes.data || []);
      setAnomalies(anomaliesRes.data || []);
      
      const activeBatches = Array.isArray(batchesRes.data) && batchesRes.data.some((b: RecentBatch) => b.status === 'RUNNING');
      if (activeBatches) {
        setPollingIntervalId(prevId => {
          if (!prevId) { // Only set new interval if one isn't already active
            const intervalId = setInterval(() => fetchData(true), 5000);
            return intervalId;
          }
          return prevId;
        });
      } else {
        setPollingIntervalId(prevId => {
          if (prevId) {
            clearInterval(prevId);
          }
          return null;
        });
      }

    } catch (e: any) {
      setError(e.message);
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [session]);

  const runHealthCheck = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
        const healthRes = await callGateway('/api/a_crud_universal_pg_function_gateway', {
            config_id: CONFIGS.SYSTEM_HEALTH_CHECK,
            params: {}
        }, session.access_token);
        setSystemHealth(healthRes);
        setShowHealthModal(true); // Open the modal
    } catch(e:any) {
        setError('Failed to run health check: ' + e.message);
    } finally {
        setLoading(false);
    }
  }


  useEffect(() => {
    if (session) {
      fetchData();
    }
    return () => {
        if (pollingIntervalId) clearInterval(pollingIntervalId);
    };
  }, [session, fetchData]);
  
  const handleCreateManualBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;

    setManualBatchLoading(true);
    setManualBatchError(null);
    setManualBatchSuccessMessage(null);

    // Basic client-side validation
    if (!payrollPeriod || !establishmentId) {
        setManualBatchError('Payroll Period and Establishment ID are required.');
        setManualBatchLoading(false);
        return;
    }

    const employeeCodesArray = employeeCodesInput
        .split(/[\n,]+/)
        .map(code => code.trim())
        .filter(code => code.length > 0);

    const p_params: any = {
        payroll_period: payrollPeriod,
        establishment_id: parseInt(establishmentId),
        reason: manualBatchReason.length > 0 ? manualBatchReason : undefined,
    };

    if (includeAllActive) {
        p_params.include_all_active = true;
    } else if (employeeCodesArray.length > 0) {
        p_params.employee_codes = employeeCodesArray;
    } else {
        setManualBatchError('Either select "Include all active employees" or provide specific Employee Codes.');
        setManualBatchLoading(false);
        return;
    }

    try {
        const result = await callGateway('/api/a_crud_universal_pg_function_gateway', {
            config_id: 'wcm-pf-create-manual-batch',
            params: p_params,
        }, session.access_token);

        if (result.success) {
            setManualBatchSuccessMessage(`Batch ${result.batch_code} created successfully! Employees: ${result.employee_count}.`);
            // Optionally, clear form or close modal after a delay
            setTimeout(() => {
                setShowManualBatchModal(false);
                setPayrollPeriod('');
                setEstablishmentId('');
                setEmployeeCodesInput('');
                setIncludeAllActive(false);
                setManualBatchReason('');
                setManualBatchSuccessMessage(null);
                // Refresh dashboard data after successful batch creation
                fetchData(); 
            }, 3000);
        } else {
            setManualBatchError(result.message || 'Failed to create batch.');
        }
    } catch (e: any) {
        setManualBatchError(e.message || 'An unexpected error occurred.');
    } finally {
        setManualBatchLoading(false);
    }
  };

  if (loading && !batches.length && !systemHealth) return <Loader />;
  if (error) return <div className="p-4 text-red-500">{error}</div>

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">PF Dashboard</h1>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard title="Active Members" value={stats?.total_active_members || 0} />
            <StatCard title="Establishments" value={stats?.total_establishments || 0} />
            <StatCard title="Open Anomalies" value={stats?.open_anomalies || 0} isCritical={stats?.open_anomalies > 0} />
            <StatCard title="Monthly Contribution" value={`₹${((stats?.current_month_total_contribution || 0) / 100000).toFixed(1)}L`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Batches List */}
            <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Recent Batches</h2>
                <RecentBatchesTable batches={batches} />
            </div>

            {/* Critical Alerts */}
            <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4 text-red-600">Critical Alerts</h2>
                <CriticalAlertsList anomalies={anomalies} />
            </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 bg-white p-6 rounded-lg shadow">
             <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
             <div className="flex space-x-4">
                <Button onClick={() => setShowManualBatchModal(true)}>Run Manual PF Computation</Button>
                <Button>Generate Challan</Button>
                <Button>View All Registrations</Button>
                <Button onClick={runHealthCheck} variant="outline">System Health Check</Button>
             </div>
        </div>

        {/* System Health Check Modal */}
        <Modal isOpen={showHealthModal} onClose={() => setShowHealthModal(false)} title="System Health Check Results">
            {loading ? (
                <Loader />
            ) : systemHealth ? (
                <div className="p-4">
                    <p className={`text-lg font-bold ${systemHealth.status === 'HEALTHY' ? 'text-green-600' : 'text-orange-600'}`}>
                        Status: {systemHealth.status}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">Timestamp: {new Date(systemHealth.timestamp).toLocaleString()}</p>

                    <div className="mt-4">
                        <h3 className="font-semibold">Checks:</h3>
                        <ul className="list-disc list-inside text-sm text-gray-700">
                            <li>Missing Partitions: {systemHealth.checks.missing_partitions ? 'Yes' : 'No'}</li>
                            <li>Healed Stale Locks: {systemHealth.checks.healed_stale_locks}</li>
                            <li>Quarantined Failed Batches: {systemHealth.checks.quarantined_failed_batches}</li>
                            <li>Pending Batches: {systemHealth.checks.pending_batches}</li>
                            <li>Unresolved Critical Anomalies: {systemHealth.checks.unresolved_critical_anomalies}</li>
                            <li>Overdue Challans: {systemHealth.checks.overdue_challans}</li>
                        </ul>
                    </div>

                    {systemHealth.recommendations && systemHealth.recommendations.length > 0 && (
                        <div className="mt-4">
                            <h3 className="font-semibold text-orange-700">Recommendations:</h3>
                            <ul className="list-disc list-inside text-sm text-gray-700">
                                {systemHealth.recommendations.map((rec, index) => (
                                    <li key={index}>{rec}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {systemHealth.auto_fixes_applied && (
                        <p className="mt-4 text-sm text-green-600">Automated fixes were applied during this check.</p>
                    )}

                    {error && <p className="mt-4 text-sm text-red-500">Error: {error}</p>}
                </div>
            ) : (
                <p>No health check data available.</p>
            )}
        </Modal>

        {/* Manual PF Computation Modal */}
        <Modal isOpen={showManualBatchModal} onClose={() => setShowManualBatchModal(false)} title="Create Manual PF Batch">
            <div className="p-4">
                <form onSubmit={handleCreateManualBatchSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="payrollPeriod" className="block text-sm font-medium text-gray-700">Payroll Period (YYYY-MM-DD)</label>
                        <Input
                            type="date"
                            id="payrollPeriod"
                            value={payrollPeriod}
                            onChange={(e) => setPayrollPeriod(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="establishmentId" className="block text-sm font-medium text-gray-700">Establishment ID</label>
                        <Input
                            type="number"
                            id="establishmentId"
                            value={establishmentId}
                            onChange={(e) => setEstablishmentId(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="employeeCodes" className="block text-sm font-medium text-gray-700">Employee Codes (comma or newline separated, optional)</label>
                        <textarea
                            id="employeeCodes"
                            rows={4}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                            value={employeeCodesInput}
                            onChange={(e) => setEmployeeCodesInput(e.target.value)}
                            placeholder="e.g., EMP001, EMP002"
                        ></textarea>
                    </div>
                    <div className="flex items-center">
                        <input
                            id="includeAllActive"
                            type="checkbox"
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            checked={includeAllActive}
                            onChange={(e) => setIncludeAllActive(e.target.checked)}
                        />
                        <label htmlFor="includeAllActive" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">Include all active employees (overrides Employee Codes)</label>
                    </div>
                    <div>
                        <label htmlFor="manualBatchReason" className="block text-sm font-medium text-gray-700">Reason (optional)</label>
                        <Input
                            type="text"
                            id="manualBatchReason"
                            value={manualBatchReason}
                            onChange={(e) => setManualBatchReason(e.target.value)}
                            placeholder="e.g., Quarterly adjustments"
                        />
                    </div>

                    {manualBatchError && <p className="text-red-500 text-sm">{manualBatchError}</p>}
                    {manualBatchSuccessMessage && <p className="text-green-500 text-sm">{manualBatchSuccessMessage}</p>}

                    <div className="flex justify-end space-x-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowManualBatchModal(false)}
                            disabled={manualBatchLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={manualBatchLoading}
                        >
                            {manualBatchLoading ? <Loader /> : 'Create Batch'}
                        </Button>
                    </div>
                </form>
            </div>
        </Modal>
    </div>
  );
}


// ============================================================================
// 5. SUB-COMPONENTS
// ============================================================================

const StatCard = ({ title, value, isCritical = false }: { title: string, value: string | number, isCritical?: boolean }) => (
    <div className="bg-white p-5 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <p className={`text-3xl font-bold mt-2 ${isCritical ? 'text-red-500' : 'text-gray-900'}`}>{value}</p>
    </div>
);

const RecentBatchesTable = ({ batches }: { batches: RecentBatch[] }) => {
    const getStatusPill = (status: string) => {
        const statusMap: { [key: string]: string } = {
            'COMPLETED': 'bg-green-100 text-green-800',
            'RUNNING': 'bg-blue-100 text-blue-800 animate-pulse',
            'FAILED': 'bg-red-100 text-red-800',
            'QUEUED': 'bg-yellow-100 text-yellow-800',
            'VALIDATION_FAILED': 'bg-orange-100 text-orange-800',
        };
        return statusMap[status] || 'bg-gray-100 text-gray-800';
      };

    return (
    <div className="overflow-x-auto">
        <table className="min-w-full">
            <thead className="bg-gray-50">
                <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Batch Code</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {batches.length > 0 ? batches.map(batch => (
                    <tr key={batch.id}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{batch.batch_code}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{new Date(batch.payroll_period).toLocaleString('default', { month: 'short', year: 'numeric' })}</td>
                        <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusPill(batch.status)}`}>
                                {batch.status}
                            </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{batch.progress_percentage}%</td>
                        <td className="px-4 py-3 text-sm">
                            <Link href={`/payroll_admin/pf-batch-monitor/${batch.id}`} passHref>
                                <Button as="a" size="sm" variant="ghost">View Details</Button>
                            </Link>
                        </td>
                    </tr>
                )) : (
                    <tr><td colSpan={5} className="text-center py-6 text-gray-500">No recent batches.</td></tr>
                )}
            </tbody>
        </table>
    </div>
    )
};

const CriticalAlertsList = ({ anomalies }: { anomalies: CriticalAnomaly[] }) => (
    <div className="space-y-3">
        {anomalies.length > 0 ? anomalies.map(anomaly => (
            <div key={anomaly.id} className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                <p className="text-sm font-semibold text-red-800">{anomaly.anomaly_type}</p>
                <p className="text-xs text-red-700">{anomaly.anomaly_description}</p>
                <p className="text-xs text-gray-500 mt-1">{new Date(anomaly.detected_at).toLocaleString()}</p>
            </div>
        )) : (
            <div className="text-center py-6">
                <p className="text-green-600 font-semibold">✅ All clear!</p>
                <p className="text-sm text-gray-500">No critical anomalies found.</p>
            </div>
        )}
    </div>
);
