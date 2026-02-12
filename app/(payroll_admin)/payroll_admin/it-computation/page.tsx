'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Loader from '@/components/ui/Loader';
import Modal from '@/components/Modal';
import { supabase } from '@/lib/supabase';

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================

interface ComputationBatch {
  id: number;
  batch_code: string;
  financial_year: string;
  payroll_period: string; // YYYY-MM-DD
  status: 'DRAFT' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED';
  progress_percentage: number;
  total_employees: number;
  processed_count: number;
  created_at: string;
}

interface LedgerEntry {
  id: number;
  user_id: string;
  // Note: Ideally join with profiles in backend view, for now we use ID or enrich if possible
  employee_name?: string; 
  employee_code?: string;
  projected_annual_gross: number;
  total_exemptions: number;
  total_deductions_ch6a: number;
  net_taxable_income: number;
  total_annual_tax_liability: number;
  tax_already_paid: number;
  monthly_tds_to_deduct: number;
  regime_used: 'OLD_REGIME' | 'NEW_REGIME';
}

// ============================================================================
// 2. CONFIGURATION CONSTANTS
// ============================================================================
const CONFIGS = {
  // Reads
  READ_BATCHES: 'it-read-batches', // config_id for wcm_it_computation_batches
  READ_LEDGER: 'it-read-monthly-ledger', // config_id for wcm_it_monthly_projection_ledger
  
  // Actions
  CREATE_BATCH: 'it-create-computation-batch',
  // Assuming a sync config exists or using generic gateway to call wcm_it_sync_deduction_to_wcm
  SYNC_TO_PAYROLL: 'wcm-it-sync-deductions' 
};

// ============================================================================
// 3. HELPER: GENERIC API CALLER
// ============================================================================
async function callGateway(endpoint: string, payload: any, token: string) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
export default function ComputationCockpitPage() {
  const { session } = useSessionContext();
  const accessToken = session?.access_token;

  // --- State ---
  const [batches, setBatches] = useState<ComputationBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<ComputationBatch | null>(null);
  const [ledgerData, setLedgerData] = useState<LedgerEntry[]>([]);
  
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Polling
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newBatchForm, setNewBatchForm] = useState({
    financial_year: 'FY2025-26',
    payroll_period: '', // YYYY-MM-DD
    include_all: true
  });

  // ==========================
  // FETCH BATCHES (History)
  // ==========================
  const fetchBatches = useCallback(async (isBackground = false) => {
    if (!accessToken) return;
    if (!isBackground) setLoadingBatches(true);
    
    try {
      const res = await callGateway('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_BATCHES,
        params: { 
          orderBy: [['created_at', 'DESC']],
          limit: 20
        }
      }, accessToken);

      const data: ComputationBatch[] = res.data || [];
      setBatches(data);

      // Check if we need to poll (if any batch is active)
      const hasActiveBatch = data.some(b => ['QUEUED', 'PROCESSING'].includes(b.status));
      
      if (hasActiveBatch && !pollingInterval) {
        const id = setInterval(() => fetchBatches(true), 3000); // Poll every 3s
        setPollingInterval(id);
      } else if (!hasActiveBatch && pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
      
      // Update selected batch if it was updated in the list
      if (selectedBatch) {
         const updatedSelected = data.find(b => b.id === selectedBatch.id);
         if (updatedSelected && updatedSelected.status !== selectedBatch.status) {
            setSelectedBatch(updatedSelected);
            if (updatedSelected.status === 'COMPLETED') fetchLedger(updatedSelected.id);
         } else if (updatedSelected) {
            // Just update progress
            setSelectedBatch(updatedSelected);
         }
      }

    } catch (e: any) {
      setError(e.message);
    } finally {
      if (!isBackground) setLoadingBatches(false);
    }
  }, [accessToken, pollingInterval, selectedBatch]);

  useEffect(() => {
    if (accessToken) fetchBatches();
    return () => { if (pollingInterval) clearInterval(pollingInterval); };
  }, [accessToken, fetchBatches]);

  // ==========================
  // FETCH LEDGER (Details)
  // ==========================
  const fetchLedger = async (batchId: number) => {
    setLoadingLedger(true);
    try {
      const res = await callGateway('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_LEDGER,
        params: { 
          filters: { batch_id: batchId },
          limit: 1000
        },
        // IMPORTANT: Request enrichment to get employee names
        p_enrich_with_employee_details: true 
      }, accessToken!);

      // Map enriched data or raw data
      // The universal gateway might return nested data in 'details' -> 'data' if enriched, 
      // or direct array. Handling both structures safely.
      const rawData = res.data || [];
      // If enriched, names are usually at top level of object due to JOIN logic in gateway
      setLedgerData(rawData);
    } catch (e: any) {
      console.error(e);
      // Non-blocking error for ledger view
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleSelectBatch = (batch: ComputationBatch) => {
    setSelectedBatch(batch);
    if (batch.status === 'COMPLETED' || batch.status === 'COMPLETED_WITH_ERRORS') {
        fetchLedger(batch.id);
    } else {
        setLedgerData([]);
    }
  };

  // ==========================
  // ACTIONS
  // ==========================

  const handleCreateBatch = async () => {
    if (!accessToken) return;
    if (!newBatchForm.payroll_period) return alert('Select a payroll period');

    setActionLoading(true);
    try {
        // 1. Fetch active users (Simplified: In real app, might need a selector)
        // For now, passing empty array allows backend to select ALL active by default if logic exists,
        // or we fetch user IDs first. Assuming backend handles "All Active" if we pass a flag or special value,
        // but looking at wcm_it_create_batch signature, it wants UUIDs.
        // Let's fetch IDs first to be safe.
        
        let employeeIds: string[] = [];
        if (newBatchForm.include_all) {
            const userRes = await callGateway('/api/a_crud_universal_read', {
                config_id: 'a68f5a57-0b78-40bc-bbdc-e35e4efd6dea', // READ_TAX_PROFILE as proxy for active IT employees
                params: { 
                    filters: { financial_year: newBatchForm.financial_year },
                    limit: 2000 
                }
            }, accessToken);
            employeeIds = userRes.data.map((u: any) => u.user_id);
        }

        if (employeeIds.length === 0) throw new Error("No eligible employees found for this FY.");

        // 2. Create Batch
        await callGateway('/api/a_crud_universal_pg_function_gateway', {
            config_id: CONFIGS.CREATE_BATCH,
            params: {
                p_tenant_id: session!.user.user_metadata.tenant_id || 'YOUR_TENANT_ID', // Replace with context
                p_financial_year: newBatchForm.financial_year,
                p_payroll_period: newBatchForm.payroll_period,
                p_employee_user_ids: employeeIds,
                p_created_by: session!.user.id
            }
        }, accessToken);

        setIsCreateModalOpen(false);
        fetchBatches();
        alert("Computation initiated successfully.");

    } catch (e: any) {
        alert(e.message);
    } finally {
        setActionLoading(false);
    }
  };

  const handleSyncToPayroll = async () => {
    if (!selectedBatch || !accessToken) return;
    if (!confirm("This will overwrite 'TDS' values in the Payroll Input table for this month. Continue?")) return;

    setActionLoading(true);
    try {
        // Assuming a gateway config exists to call 'wcm_it_sync_deduction_to_wcm'
        // If not explicitly configured, we might need to add it to backend SQL first.
        // Using generic RPC call pattern:
        await callGateway('/api/a_crud_universal_pg_function_gateway', {
            config_id: 'it-func-sync-deduction-001', // Hypothetical ID, ensure this exists in DB
            params: {
                p_batch_id: selectedBatch.id
            }
        }, accessToken);

        alert("TDS Sync completed successfully.");
    } catch (e: any) {
        alert("Sync failed: " + e.message);
    } finally {
        setActionLoading(false);
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen flex flex-col h-screen">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Computation Cockpit</h1>
          <p className="text-gray-500">Run tax calculations and sync to payroll</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>+ New Computation Run</Button>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

      <div className="flex flex-1 gap-6 overflow-hidden">
        
        {/* LEFT: Batch List */}
        <div className="w-1/3 bg-white rounded-lg shadow border flex flex-col">
            <div className="p-4 border-b bg-gray-50">
                <h3 className="font-semibold text-gray-700">Recent Runs</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {loadingBatches && batches.length === 0 ? <Loader /> : batches.map(batch => (
                    <div 
                        key={batch.id}
                        onClick={() => handleSelectBatch(batch)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            selectedBatch?.id === batch.id 
                            ? 'bg-blue-50 border-blue-500 shadow-sm' 
                            : 'bg-white border-gray-200 hover:border-blue-300'
                        }`}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-mono text-xs text-gray-500">{batch.batch_code}</span>
                            <StatusBadge status={batch.status} />
                        </div>
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm font-bold text-gray-800">{new Date(batch.payroll_period).toLocaleDateString(undefined, {month: 'short', year: 'numeric'})}</p>
                                <p className="text-xs text-gray-500">{batch.processed_count} / {batch.total_employees} processed</p>
                            </div>
                            {/* Progress Bar */}
                            {(batch.status === 'PROCESSING' || batch.status === 'QUEUED') && (
                                <div className="w-20">
                                    <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${batch.progress_percentage}%` }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* RIGHT: Details & Ledger */}
        <div className="w-2/3 bg-white rounded-lg shadow border flex flex-col">
            {!selectedBatch ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                    Select a batch to view details
                </div>
            ) : (
                <>
                    {/* Batch Header */}
                    <div className="p-6 border-b flex justify-between items-start bg-gray-50">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">
                                {new Date(selectedBatch.payroll_period).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} Computation
                            </h2>
                            <p className="text-sm text-gray-500 font-mono mt-1">{selectedBatch.batch_code}</p>
                        </div>
                        <div className="flex gap-2">
                            {/* Sync Button only if completed */}
                            {['COMPLETED', 'COMPLETED_WITH_ERRORS'].includes(selectedBatch.status) && (
                                <Button onClick={handleSyncToPayroll} isLoading={actionLoading} className="bg-purple-600 hover:bg-purple-700">
                                    Sync to Payroll
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-4 gap-4 p-6 border-b">
                         <div className="text-center">
                            <p className="text-xs text-gray-500 uppercase">Status</p>
                            <p className="font-semibold">{selectedBatch.status}</p>
                         </div>
                         <div className="text-center">
                            <p className="text-xs text-gray-500 uppercase">Processed</p>
                            <p className="font-semibold">{selectedBatch.processed_count} / {selectedBatch.total_employees}</p>
                         </div>
                         <div className="text-center">
                            <p className="text-xs text-gray-500 uppercase">Total Liability</p>
                            <p className="font-semibold text-green-600">
                                ₹{ledgerData.reduce((acc, curr) => acc + curr.total_annual_tax_liability, 0).toLocaleString()}
                            </p>
                         </div>
                         <div className="text-center">
                            <p className="text-xs text-gray-500 uppercase">Monthly TDS</p>
                            <p className="font-semibold text-blue-600">
                                ₹{ledgerData.reduce((acc, curr) => acc + curr.monthly_tds_to_deduct, 0).toLocaleString()}
                            </p>
                         </div>
                    </div>

                    {/* Ledger Table */}
                    <div className="flex-1 overflow-auto p-0">
                        {loadingLedger ? <div className="p-10"><Loader /></div> : (
                            <table className="min-w-full text-sm divide-y divide-gray-200">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium text-gray-500">Employee</th>
                                        <th className="px-4 py-3 text-left font-medium text-gray-500">Regime</th>
                                        <th className="px-4 py-3 text-right font-medium text-gray-500">Proj. Gross</th>
                                        <th className="px-4 py-3 text-right font-medium text-gray-500">Exemptions</th>
                                        <th className="px-4 py-3 text-right font-medium text-gray-500">Net Taxable</th>
                                        <th className="px-4 py-3 text-right font-medium text-gray-500">Annual Tax</th>
                                        <th className="px-4 py-3 text-right font-medium text-gray-500 bg-blue-50">Monthly TDS</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {ledgerData.map(row => (
                                        <tr key={row.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900">{row.employee_name || row.user_id}</div>
                                                <div className="text-xs text-gray-500">{row.employee_code}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-xs ${row.regime_used === 'OLD_REGIME' ? 'bg-orange-100 text-orange-800' : 'bg-purple-100 text-purple-800'}`}>
                                                    {row.regime_used === 'OLD_REGIME' ? 'Old' : 'New'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">{row.projected_annual_gross.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right text-gray-500">
                                                {(row.total_exemptions + row.total_deductions_ch6a).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium">{row.net_taxable_income.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right">{row.total_annual_tax_liability.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-bold text-blue-600 bg-blue-50">
                                                {row.monthly_tds_to_deduct.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                    {ledgerData.length === 0 && (
                                        <tr><td colSpan={7} className="p-8 text-center text-gray-500">No ledger entries found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}
        </div>
      </div>

      {/* CREATE MODAL */}
      {isCreateModalOpen && (
        <Modal isOpen={true} onClose={() => setIsCreateModalOpen(false)} title="Start New Computation">
            <div className="p-4 space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Financial Year</label>
                    <Input value={newBatchForm.financial_year} onChange={e => setNewBatchForm({...newBatchForm, financial_year: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Payroll Period (Month)</label>
                    <Input type="date" value={newBatchForm.payroll_period} onChange={e => setNewBatchForm({...newBatchForm, payroll_period: e.target.value})} />
                </div>
                <div className="flex items-center gap-2">
                     <input type="checkbox" checked={newBatchForm.include_all} onChange={e => setNewBatchForm({...newBatchForm, include_all: e.target.checked})} />
                     <label className="text-sm">Run for all active employees</label>
                </div>
                
                <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
                    <p><strong>Note:</strong> This will start an asynchronous background job. Calculation may take a few minutes depending on employee count.</p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateBatch} isLoading={actionLoading}>Start Processing</Button>
                </div>
            </div>
        </Modal>
      )}

    </div>
  );
}

// Helper Component
const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
        QUEUED: 'bg-yellow-100 text-yellow-800',
        PROCESSING: 'bg-blue-100 text-blue-800',
        COMPLETED: 'bg-green-100 text-green-800',
        FAILED: 'bg-red-100 text-red-800',
        DRAFT: 'bg-gray-100 text-gray-800'
    };
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${styles[status] || 'bg-gray-100'}`}>
            {status.replace('_', ' ')}
        </span>
    );
};