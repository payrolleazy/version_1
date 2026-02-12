'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import Loader from '@/components/ui/Loader';
import Modal from '@/components/Modal';
import Input from '@/components/ui/Input';

// Interface for a payroll batch
interface PayrollBatch {
  id: number;
  payroll_period: string;
  status: string;
  total_employees: number;
  processed_employees: number;
  failed_employees: number;
  progress_percentage: number;
  created_at: string;
  completed_at: string | null;
  batch_code: string;
  description: string | null;
  processing_type: string; // Add processing_type to interface
}

// Config IDs
const READ_BATCHES_CONFIG_ID = '75e87d9b-ad1c-4639-b519-6626f9488fec'; // VERIFIED
const DISPATCH_BATCH_CONFIG_ID = 'wcm-dispatch-jobs'; // VERIFIED
const CREATE_ADHOC_BATCH_CONFIG_ID = 'wcm-create-adhoc-payroll-run'; // Our new config ID

// New Interface for Payroll Area Options
interface PayrollAreaOption {
  value: number; // The payroll_area_id
  label: string; // The area_code or description
}

export default function PayrollRunCockpitPage() {
  const { session } = useSessionContext();
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);

  // State for the ad-hoc modal
  const [isAdhocModalOpen, setIsAdhocModalOpen] = useState(false);
  const [adhocPeriod, setAdhocPeriod] = useState('');
  const [adhocEmpCodes, setAdhocEmpCodes] = useState('');
  const [adhocDescription, setAdhocDescription] = useState('');
  const [adhocPayrollAreaId, setAdhocPayrollAreaId] = useState<number | null>(null); // New state for mandatory payroll area
  const [adhocLoading, setAdhocLoading] = useState(false);
  const [payrollAreaOptions, setPayrollAreaOptions] = useState<PayrollAreaOption[]>([]); // New state for payroll area dropdown

  // New Config ID for reading payroll areas
  const READ_PAYROLL_AREAS_CONFIG_ID = '7ccbf45d-140c-4dde-939b-f82a222d93dc';

  // Function to fetch active payroll areas for the dropdown
  const fetchPayrollAreas = useCallback(async () => {
    if (!session) return;
    try {
      const response = await fetch('/api/a_crud_universal_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: READ_PAYROLL_AREAS_CONFIG_ID,
          params: { filters: { is_active: true }, orderBy: [['area_code', 'ASC']] },
          accessToken: session.access_token,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch payroll areas');
      }
      const options = result.data.map((area: any) => ({
        value: area.id,
        label: `${area.area_code} (${area.description || 'No Description'})`,
      }));
      setPayrollAreaOptions(options);
      if (options.length > 0 && adhocPayrollAreaId === null) {
        setAdhocPayrollAreaId(options[0].value); // Select first as default
      }
    } catch (err: any) {
      setError(`Failed to load payroll areas: ${err.message}`);
    }
  }, [session, adhocPayrollAreaId]);


  const fetchBatches = useCallback(async (isPolling = false) => {
    if (!isPolling) setLoading(true);
    setError(null);
    if (!session) return;

    try {
      const response = await fetch('/api/a_crud_universal_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: READ_BATCHES_CONFIG_ID,
          params: { orderBy: [['created_at', 'DESC']] },
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch payroll batches.');
      }
      
      setBatches(result.data || []);
      
      if (result.data?.some((b: PayrollBatch) => ['RUNNING', 'PROCESSING', 'QUEUED'].includes(b.status))) {
        if (!pollingIntervalId) {
          const intervalId = setInterval(() => fetchBatches(true), 5000); // Poll every 5 seconds
          setPollingIntervalId(intervalId);
        }
      } else {
        if (pollingIntervalId) {
          clearInterval(pollingIntervalId);
          setPollingIntervalId(null);
        }
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [session, pollingIntervalId]);

  useEffect(() => {
    if (session) {
      fetchBatches();
      fetchPayrollAreas(); // Fetch payroll areas when session is available
    }
    return () => {
      if (pollingIntervalId) clearInterval(pollingIntervalId);
    };
  }, [session, pollingIntervalId, fetchPayrollAreas]); // Add fetchPayrollAreas to dependencies

  const handleDispatch = async (batchId: number) => {
    setActionLoading(batchId);
    setError(null);
    try {
        const response = await fetch('/api/a_crud_universal_pg_function_gateway', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                config_id: DISPATCH_BATCH_CONFIG_ID,
                params: { p_batch_id: batchId },
                accessToken: session?.access_token,
            }),
        });

        const result = await response.json();
        if (!response.ok || (result.data && result.data.success === false)) {
            throw new Error(result.data?.message || result.message || 'Failed to dispatch batch.');
        }
        await fetchBatches();

    } catch (err: any) {
      setError(`Dispatch failed for batch ${batchId}: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateAdhoc = async () => {
    if (!adhocPeriod || !adhocEmpCodes || adhocPayrollAreaId === null) {
      setError('Payroll Period, Employee Codes, and Payroll Area are required.');
      return;
    }
    setAdhocLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/a_crud_universal_pg_function_gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: CREATE_ADHOC_BATCH_CONFIG_ID,
          params: {
            payroll_period: adhocPeriod,
            employee_emp_codes: adhocEmpCodes.split(',').map(c => c.trim()).filter(c => c), // Split emp codes
            batch_description: adhocDescription,
            payroll_area_id: adhocPayrollAreaId, // Pass the mandatory payroll area ID
          },
          accessToken: session?.access_token,
        }),
      });

      const result = await response.json();
      if (!response.ok || (result.data && result.data.success === false)) {
        throw new Error(result.data?.message || result.message || 'Failed to create ad-hoc batch.');
      }
      
      setIsAdhocModalOpen(false);
      setAdhocEmpCodes('');
      setAdhocDescription('');
      setAdhocPeriod(''); // Reset period
      setAdhocPayrollAreaId(payrollAreaOptions.length > 0 ? payrollAreaOptions[0].value : null); // Reset payroll area
      await fetchBatches(); // Refresh batch list
      setError(null); // Clear any previous error

    } catch (err: any) {
      setError(`Failed to create ad-hoc batch: ${err.message}`);
    } finally {
      setAdhocLoading(false);
    }
  };

  const getStatusPill = (status: string) => {
    const statusMap: { [key: string]: string } = {
        'COMPLETED': 'bg-green-100 text-green-800',
        'RUNNING': 'bg-blue-100 text-blue-800 animate-pulse',
        'PROCESSING': 'bg-blue-100 text-blue-800 animate-pulse',
        'QUEUED': 'bg-yellow-100 text-yellow-800',
        'ADHOC': 'bg-purple-100 text-purple-800', // New pill for ADHOC status in UI
        'FAILED': 'bg-red-100 text-red-800',
        'DRAFT': 'bg-gray-100 text-gray-800',
        'FINALIZED': 'bg-indigo-100 text-indigo-800'
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800';
  };
  
  if (loading && batches.length === 0) return <Loader />;

  return (
    <>
      <div className="p-8 bg-white rounded-lg shadow-md min-h-screen">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h1 className="text-3xl font-bold">Payroll Cockpit</h1>
          <div className="flex space-x-2">
            <Button onClick={() => setIsAdhocModalOpen(true)} variant="outline">Create Ad-hoc Run</Button> {/* Enabled Ad-hoc button */}
            <Button onClick={() => fetchBatches(false)} disabled={loading || actionLoading !== null}>Refresh</Button>
          </div>
        </div>

        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">{error}</div>}

        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-100"><tr><th className="py-2 px-4 border-b text-left">Period</th><th className="py-2 px-4 border-b text-left">Description</th><th className="py-2 px-4 border-b text-left">Type</th><th className="py-2 px-4 border-b text-left">Status</th><th className="py-2 px-4 border-b text-left">Progress</th><th className="py-2 px-4 border-b text-center">Employees</th><th className="py-2 px-4 border-b text-center">Actions</th></tr></thead>
            <tbody>
              {batches.length > 0 ? batches.map((batch) => (
                <tr key={batch.id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b font-medium">{new Date(batch.payroll_period).toLocaleString('default', { month: 'long', year: 'numeric' })}</td>
                  <td className="py-2 px-4 border-b text-sm text-gray-600">
                    <div>{batch.description || 'Standard Run'}</div>
                    <div className="text-xs text-gray-400 font-mono">{batch.batch_code}</div>
                  </td>
                  <td className="py-2 px-4 border-b text-sm text-gray-600">
                     <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusPill(batch.processing_type || 'FULL')}`}>
                       {batch.processing_type || 'FULL'}
                     </span>
                  </td> {/* Display processing type */}
                  <td className="py-2 px-4 border-b">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusPill(batch.status)}`}>
                      {batch.status}
                    </span>
                  </td>
                  <td className="py-2 px-4 border-b">
                    {batch.status === 'RUNNING' || batch.status === 'PROCESSING' ? (
                      <div className="w-full bg-gray-200 rounded-full h-4">
                        <div className="bg-blue-600 h-4 rounded-full" style={{ width: `${batch.progress_percentage || 0}%` }}></div>
                      </div>
                    ) : (
                      <p>{batch.progress_percentage || 0}%</p>
                    )}
                  </td>
                  <td className="py-2 px-4 border-b text-center">{batch.processed_employees || 0} / {batch.total_employees}</td>
                  <td className="py-2 px-4 border-b text-center">
                    {batch.status === 'QUEUED' ? (
                      <Button onClick={() => handleDispatch(batch.id)} size="sm" isLoading={actionLoading === batch.id}>Dispatch</Button>
                    ) : batch.status === 'COMPLETED' ? (
                      <Button variant="ghost" size="sm">View Results</Button>
                    ) : (
                      <span className="text-xs text-gray-500 italic">No actions available</span>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">No payroll batches found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ad-hoc Run Creation Modal */}
      <Modal isOpen={isAdhocModalOpen} onClose={() => setIsAdhocModalOpen(false)} title="Create Ad-hoc Payroll Run">
        <div className="space-y-4">
          <div>
            <label htmlFor="adhoc-period" className="block text-sm font-medium text-gray-700">Payroll Period *</label>
            <Input type="date" id="adhoc-period" value={adhocPeriod} onChange={e => setAdhocPeriod(e.target.value)} />
          </div>
          <div>
            <label htmlFor="adhoc-payroll-area" className="block text-sm font-medium text-gray-700">Payroll Area *</label>
            <select
              id="adhoc-payroll-area"
              value={adhocPayrollAreaId || ''}
              onChange={e => setAdhocPayrollAreaId(parseInt(e.target.value))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 sm:text-sm"
              disabled={adhocLoading || payrollAreaOptions.length === 0}
            >
              {payrollAreaOptions.length === 0 && <option value="">Loading areas...</option>}
              {payrollAreaOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {payrollAreaOptions.length === 0 && !loading && (
              <p className="text-sm text-red-500 mt-1">No active payroll areas found. Please create one.</p>
            )}
          </div>
          <div>
            <label htmlFor="adhoc-codes" className="block text-sm font-medium text-gray-700">Employee Codes (comma-separated) *</label>
            <textarea
              id="adhoc-codes"
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., EMP001, EMP002, EMP003"
              value={adhocEmpCodes}
              onChange={e => setAdhocEmpCodes(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="adhoc-desc" className="block text-sm font-medium text-gray-700">Description (Optional)</label>
            <Input type="text" id="adhoc-desc" value={adhocDescription} onChange={e => setAdhocDescription(e.target.value)} placeholder="e.g., Q4 Bonus Payout" />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="secondary" onClick={() => setIsAdhocModalOpen(false)} disabled={adhocLoading}>Cancel</Button>
            <Button onClick={handleCreateAdhoc} isLoading={adhocLoading} disabled={adhocPayrollAreaId === null}>Create & Queue Run</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
