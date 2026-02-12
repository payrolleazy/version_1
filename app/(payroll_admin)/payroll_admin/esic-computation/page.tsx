'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation'; // For navigation to Ledger
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/Modal';
import Loader from '@/components/ui/Loader';

// ============================================================================
// 1. TYPES
// ============================================================================

interface ComputationBatch {
  id: number;
  batch_code: string;
  payroll_period: string;
  establishment_id: number;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'COMPLETED_WITH_WARNINGS' | 'FAILED';
  progress_percentage: number;
  total_employees: number;
  processed_employees: number;
  failed_employees: number;
  created_at: string;
}

interface Establishment {
  id: number;
  establishment_name: string;
  establishment_code: string;
}

// ============================================================================
// 2. CONFIGURATION CONSTANTS
// ============================================================================

const CONFIGS = {
  READ_BATCHES: '08fc7812-10d4-4e72-bd16-0b27148ad284',
  READ_ESTABLISHMENTS: '8b0aae37-378f-407e-9454-88d0c6941dba',
  READ_EMPLOYEES: '78b20d6c-06a9-4088-b72e-6f43f0a39c83',
  CREATE_BATCH: 'wcm_esic_create_computation_batch'
};

// ============================================================================
// 3. PAGE COMPONENT
// ============================================================================

export default function EsicComputationPage() {
  const { session } = useSessionContext();
  const router = useRouter();
  
  // Data State
  const [batches, setBatches] = useState<ComputationBatch[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ payroll_period: '', establishment_id: '' });
  const [creating, setCreating] = useState(false);

  // Execution State
  const [processingBatchId, setProcessingBatchId] = useState<number | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // --------------------------------------------------------------------------
  // Data Fetching
  // --------------------------------------------------------------------------
  const fetchData = useCallback(async (isPolling = false) => {
    if (!session?.access_token) return;
    if (!isPolling) setLoading(true);
    
    try {
      // 1. Fetch Batches
      const batchRes = await fetch('/api/a_crud_universal_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: CONFIGS.READ_BATCHES,
          params: { limit: 20, orderBy: [['created_at', 'DESC']] },
          accessToken: session.access_token,
        }),
      }).then(r => r.json());

      if (batchRes.success) {
        setBatches(batchRes.data || []);
        
        // Check if we need to continue polling (if any batch is RUNNING)
        const hasRunning = batchRes.data?.some((b: ComputationBatch) => b.status === 'RUNNING');
        if (!hasRunning && pollInterval) {
          clearInterval(pollInterval);
          setPollInterval(null);
        }
      }

      // 2. Fetch Establishments (Only once)
      if (!isPolling && establishments.length === 0) {
        const estRes = await fetch('/api/a_crud_universal_read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config_id: CONFIGS.READ_ESTABLISHMENTS,
            params: { filters: { is_active: true } },
            accessToken: session.access_token,
          }),
        }).then(r => r.json());
        
        if (estRes.success) setEstablishments(estRes.data || []);
      }

    } catch (err: any) {
      if (!isPolling) setError(err.message);
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [session, pollInterval, establishments.length]);

  useEffect(() => {
    if (session) fetchData();
    return () => { if (pollInterval) clearInterval(pollInterval); };
  }, [session, fetchData]);

  // --------------------------------------------------------------------------
  // Action: Create Batch
  // --------------------------------------------------------------------------
  const handleCreateBatch = async () => {
    if (!createForm.payroll_period || !createForm.establishment_id) {
      alert("Please select Period and Establishment.");
      return;
    }
    
    setCreating(true);
    try {
      // Step 1: Get Active Employees for this Establishment
      // We read from the registration table to get the UUIDs
      const empRes = await fetch('/api/a_crud_universal_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: CONFIGS.READ_EMPLOYEES,
          params: { 
            filters: { 
              status: 'ACTIVE', 
              establishment_id: createForm.establishment_id 
            } 
          },
          accessToken: session!.access_token,
        }),
      }).then(r => r.json());

      const userIds = empRes.data?.map((u: any) => u.user_id) || [];

      if (userIds.length === 0) {
        throw new Error("No active ESIC employees found for this establishment.");
      }

      // Step 2: Call the Wrapper
      const createRes = await fetch('/api/a_crud_universal_pg_function_gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: CONFIGS.CREATE_BATCH,
          params: {
            // Note: The wrapper expects 'p_payload' which is passed by gateway via 'params'
            tenant_id: session!.user.app_metadata.tenant_id,
            payroll_period: createForm.payroll_period,
            establishment_id: Number(createForm.establishment_id),
            user_id: session!.user.id,
            employee_user_ids: userIds,
            wcm_batch_id: null // Independent run
          },
          accessToken: session!.access_token,
        }),
      });

      const result = await createRes.json();
      
      if (!createRes.ok || (result.data && result.data.success === false)) {
        // Handle specific "Batch already exists" warning
        if (result.data?.validation_warnings?.length > 0) {
           throw new Error(result.data.validation_warnings[0].warning);
        }
        throw new Error(result.data?.error || result.message || "Failed to create batch");
      }

      setIsModalOpen(false);
      fetchData(); // Refresh list
      alert(`Batch Created! Ready to process ${userIds.length} employees.`);

    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  // --------------------------------------------------------------------------
  // Action: Trigger Worker
  // --------------------------------------------------------------------------
  const handleRunComputation = async (batch: ComputationBatch) => {
    setProcessingBatchId(batch.id);
    
    try {
      const response = await fetch('/api/esic/trigger-worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job: {
            id: batch.id,
            batch_code: batch.batch_code,
            tenant_id: session!.user.app_metadata.tenant_id,
            payroll_period: batch.payroll_period,
            total_employees: batch.total_employees
          },
          accessToken: session!.access_token
        }),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }

      // Start Polling immediately
      const interval = setInterval(() => fetchData(true), 3000);
      setPollInterval(interval);

    } catch (err: any) {
      alert(`Failed to start worker: ${err.message}`);
      setProcessingBatchId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'COMPLETED_WITH_WARNINGS': return 'bg-yellow-100 text-yellow-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      case 'RUNNING': return 'bg-blue-100 text-blue-800 animate-pulse';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  if (loading && batches.length === 0) return <Loader />;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Computation Runner</h1>
          <p className="text-sm text-gray-500">Create batches and run monthly ESIC calculations.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>Create New Batch</Button>
      </div>

      {error && <div className="p-4 mb-4 text-red-700 bg-red-100 rounded border border-red-400">{error}</div>}

      <div className="grid gap-4">
        {batches.map(batch => (
          <div key={batch.id} className="bg-white p-5 rounded-lg shadow border border-gray-200 flex flex-col md:flex-row justify-between items-center">
            
            {/* Left Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-lg text-gray-800">{new Date(batch.payroll_period).toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(batch.status)}`}>
                  {batch.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-sm text-gray-500 font-mono mt-1">{batch.batch_code}</p>
              <p className="text-sm text-gray-600 mt-1">
                Est: {establishments.find(e => e.id === batch.establishment_id)?.establishment_name || batch.establishment_id}
              </p>
            </div>

            {/* Middle Stats */}
            <div className="flex-1 px-4 w-full md:w-auto mt-4 md:mt-0">
              <div className="flex justify-between text-sm mb-1">
                <span>Progress</span>
                <span className="font-bold">{batch.progress_percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className={`h-2.5 rounded-full ${batch.status === 'FAILED' ? 'bg-red-500' : 'bg-blue-600'}`} 
                  style={{ width: `${batch.progress_percentage}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Processed: {batch.processed_employees}/{batch.total_employees}</span>
                {batch.failed_employees > 0 && <span className="text-red-500 font-bold">Failed: {batch.failed_employees}</span>}
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2 mt-4 md:mt-0 pl-4 border-l">
              {['QUEUED', 'FAILED'].includes(batch.status) && (
                <Button 
                  size="sm" 
                  onClick={() => handleRunComputation(batch)}
                  disabled={!!processingBatchId}
                  isLoading={processingBatchId === batch.id}
                >
                  Run Computation
                </Button>
              )}
              
              {['COMPLETED', 'COMPLETED_WITH_WARNINGS'].includes(batch.status) && (
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => router.push(`/payroll_admin/esic-ledger?batch_id=${batch.id}`)}
                >
                  View Ledger
                </Button>
              )}

              {batch.status === 'RUNNING' && (
                <span className="text-sm text-blue-600 animate-pulse font-medium">Processing...</span>
              )}
            </div>

          </div>
        ))}

        {batches.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-white rounded shadow">No computation batches found. Create one to get started.</div>
        )}
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Monthly Batch">
          <div className="space-y-4 p-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Payroll Period</label>
              <Input 
                type="date" 
                value={createForm.payroll_period}
                onChange={e => setCreateForm({...createForm, payroll_period: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Establishment</label>
              <select 
                className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                value={createForm.establishment_id}
                onChange={e => setCreateForm({...createForm, establishment_id: e.target.value})}
              >
                <option value="">Select Establishment</option>
                {establishments.map(est => (
                  <option key={est.id} value={est.id}>{est.establishment_name} ({est.establishment_code})</option>
                ))}
              </select>
            </div>
            <div className="bg-blue-50 p-3 rounded text-xs text-blue-800">
              Note: This will select all <strong>ACTIVE</strong> employees linked to this establishment for the chosen month.
            </div>
            <div className="flex justify-end gap-3 mt-4 pt-2 border-t">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateBatch} isLoading={creating}>Create & Queue</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}