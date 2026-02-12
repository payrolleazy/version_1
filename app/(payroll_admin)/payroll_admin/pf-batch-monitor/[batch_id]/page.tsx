'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Loader from '@/components/ui/Loader';
import { supabase } from '@/lib/supabase';

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================
interface BatchStatus {
    id: number;
    batch_code: string;
    payroll_period: string;
    status: string;
    progress_percentage: number;
    processed_employees: number;
    failed_employees: number;
    anomalies_detected: number;
    critical_anomalies: number;
    total_employees: number;
    started_at: string;
    completed_at: string | null;
    last_error: any;
}

interface FailedEmployee {
    employee_code: string;
    name: string;
    error_type: string;
    error_message: string;
}

// ============================================================================
// 2. CONFIGURATION CONSTANTS (Gateway IDs from pf_frontend_prompt.txt)
// ============================================================================
const CONFIGS = {
  READ_BATCH_STATUS: '856d0bb3-063e-413a-a97b-0175c825e5a3',
  RETRY_BATCH: 'wcm-pf-dispatch-jobs',
  FINALIZE_BATCH: 'wcm-pf-finalize-batch',
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

export default function BatchProcessingMonitorPage({ params }: { params: { batch_id: string } }) {
  const { session } = useSessionContext();
  const batchId = params.batch_id;

  // --- State ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [failedEmployees, setFailedEmployees] = useState<FailedEmployee[]>([]);
  const [activityLog, setActivityLog] = useState<string[]>(['Initializing...']);
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ==========================
  // DATA FETCHING METHODS
  // ==========================

  const fetchBatchStatus = useCallback(async (isPolling = false) => {
    if (!session?.access_token) return;
    if (!isPolling) {
        setLoading(true);
        addToLog('Fetching batch status...');
    }
    setError(null);

    try {
      const statusRes = await callGateway('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_BATCH_STATUS,
        params: {
          filters: [{ column: 'id', operator: 'eq', value: batchId }],
          limit: 1
        }
      }, session.access_token);

      const currentStatus = statusRes.data?.[0];
      
      if (currentStatus) {
        // Add to log if status changes
        if (batchStatus && batchStatus.status !== currentStatus.status) {
            addToLog(`Status changed to: ${currentStatus.status}`);
        }
        if (batchStatus && batchStatus.progress_percentage !== currentStatus.progress_percentage) {
            addToLog(`Progress: ${currentStatus.progress_percentage}%`);
        }
        setBatchStatus(currentStatus);
      }
      
      if (['RUNNING', 'PROCESSING', 'QUEUED'].includes(currentStatus?.status)) {
        if (!pollingIntervalId) {
          const intervalId = setInterval(() => fetchBatchStatus(true), 2000); // Poll every 2 seconds
          setPollingIntervalId(intervalId);
        }
      } else {
        if (pollingIntervalId) {
          clearInterval(pollingIntervalId);
          setPollingIntervalId(null);
          addToLog('Polling stopped.');
        }
      }

    } catch (e: any) {
      setError(e.message);
      addToLog(`Error: ${e.message}`, 'error');
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [session, batchId, pollingIntervalId, batchStatus]);

  // Placeholder for fetching failed employees
  const fetchFailedEmployees = useCallback(async () => {
    // This would typically call another gateway config to get failed employee details
    // For now, it's a placeholder.
    addToLog('Fetching failed employee details...');
    setFailedEmployees([]); 
  }, []);

  useEffect(() => {
    if (session) {
      fetchBatchStatus();
      fetchFailedEmployees();
    }
    return () => {
      if (pollingIntervalId) clearInterval(pollingIntervalId);
    };
  }, [session, batchId]);

  // ==========================
  // ACTION HANDLERS
  // ==========================
  const handleBatchAction = async (configId: string, params: object, logMessage: string) => {
    if (!session?.access_token) return;
    setActionLoading(true);
    setError(null);
    addToLog(logMessage);

    try {
      await callGateway('/api/a_crud_universal_pg_function_gateway', {
        config_id: configId,
        params: params,
      }, session.access_token);
      await fetchBatchStatus();
    } catch(e: any) {
      setError(e.message);
      addToLog(`Action failed: ${e.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  }

  const addToLog = (message: string, type: 'info' | 'error' | 'warn' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    setActivityLog(prev => [logEntry, ...prev.slice(0, 99)]);
  };
  
  if (loading && !batchStatus) return <Loader />;
  if (error && !batchStatus) return <div className="p-4 text-red-500">{error}</div>;
  if (!batchStatus) return <div className="p-4 text-center">Batch not found.</div>

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
        'RUNNING': 'border-blue-500',
        'COMPLETED': 'border-green-500',
        'FAILED': 'border-red-500',
        'QUEUED': 'border-yellow-500',
    };
    return map[status] || 'border-gray-300';
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="mb-4">
        <a href="/payroll_admin/pf-dashboard" className="text-blue-600 hover:underline">&larr; Back to PF Dashboard</a>
      </div>

      {/* Batch Header */}
      <div className={`bg-white p-6 rounded-lg shadow-md border-t-4 ${getStatusColor(batchStatus.status)} mb-6`}>
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-bold">Batch: {batchStatus.batch_code}</h1>
                <p className="text-gray-600">Period: {new Date(batchStatus.payroll_period).toLocaleString('default', {month: 'long', year: 'numeric'})}</p>
            </div>
            <div className="text-right">
                <p className="text-lg font-semibold">Status: <span className="capitalize">{batchStatus.status.toLowerCase()}</span></p>
                <p className="text-sm text-gray-500">Started: {new Date(batchStatus.started_at).toLocaleString()}</p>
            </div>
        </div>
        <div className="mt-4">
            <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700">Progress</span>
                <span className="text-sm font-medium text-blue-700">{batchStatus.progress_percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{width: `${batchStatus.progress_percentage}%`}}></div>
            </div>
            <p className="text-right text-sm text-gray-500 mt-1">{batchStatus.processed_employees} / {batchStatus.total_employees} employees</p>
        </div>
      </div>
      
      {/* Processing Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Processed" value={batchStatus.processed_employees} />
        <StatCard title="Failed" value={batchStatus.failed_employees} isCritical={batchStatus.failed_employees > 0} />
        <StatCard title="Anomalies" value={batchStatus.anomalies_detected} isCritical={batchStatus.anomalies_detected > 0} />
        <StatCard title="Critical Anomalies" value={batchStatus.critical_anomalies} isCritical={batch.critical_anomalies > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Activity Log */}
        <div className="bg-white p-6 rounded-lg shadow h-96 flex flex-col">
            <h2 className="text-xl font-semibold mb-4">Live Activity Log</h2>
            <div className="overflow-y-auto flex-grow bg-gray-900 text-white font-mono text-xs p-4 rounded">
                {activityLog.map((log, i) => <p key={i} className={`${log.includes('[ERROR]') ? 'text-red-400' : log.includes('[WARN]') ? 'text-yellow-400' : 'text-green-400'}`}>{log}</p>)}
            </div>
        </div>

        {/* Failed Employees Table */}
        <div className="bg-white p-6 rounded-lg shadow h-96 flex flex-col">
            <h2 className="text-xl font-semibold mb-4">Failed Employees</h2>
            <div className="overflow-y-auto flex-grow">
                {failedEmployees.length > 0 ? (
                <table className="min-w-full text-sm">
                    {/* ... table for failed employees ... */}
                </table>
                ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                    <p>No failed employees in this batch.</p>
                </div>
                )}
            </div>
        </div>
      </div>
      
       {/* Batch Actions */}
       <div className="mt-6 bg-white p-6 rounded-lg shadow">
         <h2 className="text-xl font-semibold mb-4">Batch Actions</h2>
         <div className="flex space-x-4">
            <Button onClick={() => handleBatchAction(CONFIGS.RETRY_BATCH, { p_batch_size: 5 }, 'Retrying failed employees...')} disabled={actionLoading || batchStatus.failed_employees === 0}>Retry Failed</Button>
            <Button onClick={() => handleBatchAction(CONFIGS.FINALIZE_BATCH, { p_batch_id: batchId }, 'Finalizing batch...')}>View Full Ledger</Button>
            <Button variant="outline">Download Error Report</Button>
            <Button variant="destructive" disabled={!['RUNNING', 'QUEUED'].includes(batchStatus.status)}>Cancel Batch</Button>
         </div>
    </div>

    </div>
  );
}

// ============================================================================
// 5. SUB-COMPONENTS
// ============================================================================

const StatCard = ({ title, value, isCritical = false }: { title: string, value: string | number, isCritical?: boolean }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <p className={`text-2xl font-bold mt-1 ${isCritical ? 'text-red-500' : 'text-gray-900'}`}>{value}</p>
    </div>
);
