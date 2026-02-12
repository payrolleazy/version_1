'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';

interface TpsBatch {
  id: number;
  payroll_period: string;
  status: string;
  total_employees: number;
  processed_employees: number;
  progress_percentage: number;
  created_at: string;
  completed_at: string | null;
}

interface PeriodSummary {
  user_id: string;
  emp_code: string;
  full_name: string;
  lop_days: number;
  total_overtime_hours: number;
}

export default function TpsFinalizationPage() {
  const { session } = useSessionContext();
  const [batches, setBatches] = useState<TpsBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<TpsBatch | null>(null);
  const [summaryData, setSummaryData] = useState<PeriodSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);

  const fetchBatches = useCallback(async () => {
    if (!session) return;
    try {
      const { data, error } = await supabase
        .from('tps_processing_batches')
        .select('*')
        .order('payroll_period', { ascending: false });

      if (error) throw error;
      setBatches(data || []);
      if (data && data.length > 0 && !selectedBatch) {
        setSelectedBatch(data[0]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, selectedBatch]);

  const fetchSummaryData = useCallback(async (batchId: number) => {
    if (!session || !batchId) {
      setSummaryData([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('tps_employee_period_summary')
        .select(`
          user_id,
          lop_days,
          total_overtime_hours,
          profiles ( emp_code, full_name )
        `)
        .eq('batch_id', batchId);

      if (error) throw error;

      const formattedData = data.map((item: any) => ({
        user_id: item.user_id,
        lop_days: item.lop_days,
        total_overtime_hours: item.total_overtime_hours,
        emp_code: item.profiles?.emp_code,
        full_name: item.profiles?.full_name,
      }));
      setSummaryData(formattedData);
    } catch (err: any) {
      setError(`Failed to fetch summary data: ${err.message}`);
    }
  }, [session]);

  const handleApiAction = async (configId: string, params: object, successMessage: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('a_crud_universal_pg_function_gateway', {
        body: { config_id: configId, params },
      });
      
      if (error || !data.success) throw new Error(error?.message || data.message || 'An unknown error occurred.');
      
      console.log(successMessage, data);
      await fetchBatches(); // Refresh batch list
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFreeze = () => {
    if (!selectedBatch) return;
    if (!confirm("Are you sure you want to freeze this period? This will lock attendance and leave records.")) return;
    handleApiAction('tps-freeze-period', { payroll_period: selectedBatch.payroll_period }, 'Period frozen successfully.');
  };

  const handleProcess = () => {
    if (!selectedBatch) return;
    handleApiAction('tps-process-batch', { batch_id: selectedBatch.id }, 'Batch processing initiated.');
  };

  const handleFinalize = () => {
    if (!selectedBatch) return;
    if (!confirm("Are you sure? This will finalize the period and push LOP/Overtime data to the payroll module.")) return;
    handleApiAction('tps-finalize-period', { batch_id: selectedBatch.id }, 'Period finalized and data pushed to payroll.');
  };

  useEffect(() => {
    if (session) {
      fetchBatches();
    }
  }, [session]);

  useEffect(() => {
    if (selectedBatch) {
      fetchSummaryData(selectedBatch.id);

      // Polling logic
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        setPollingIntervalId(null);
      }

      if (selectedBatch.status === 'PROCESSING') {
        const intervalId = setInterval(async () => {
          const { data, error } = await supabase
            .from('tps_processing_batches')
            .select('*')
            .eq('id', selectedBatch.id)
            .single();

          if (error) {
            console.error('Polling error:', error);
            clearInterval(intervalId);
          } else if (data && data.status !== 'PROCESSING') {
            clearInterval(intervalId);
            setPollingIntervalId(null);
            fetchBatches(); // Refresh the whole list to get final status
          } else if (data) {
            setSelectedBatch(data); // Update progress
          }
        }, 10000); // Poll every 10 seconds
        setPollingIntervalId(intervalId);
      }
    }

    // Cleanup on unmount
    return () => {
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
      }
    };
  }, [selectedBatch, session, fetchBatches, fetchSummaryData]);

  const renderActionButton = () => {
    if (!selectedBatch || actionLoading) {
      return <Button disabled>{actionLoading ? 'Processing...' : 'Select a Period'}</Button>;
    }

    switch (selectedBatch.status) {
      case 'DRAFT':
        return <Button onClick={handleFreeze}>Freeze Period</Button>;
      case 'FROZEN':
        return <Button onClick={handleProcess}>Process Batch</Button>;
      case 'PROCESSING':
        return <Button disabled>Processing ({selectedBatch.progress_percentage || 0}%)</Button>;
      case 'PROCESSED':
        return <Button onClick={handleFinalize} className="bg-green-600 hover:bg-green-700">Finalize & Push to Payroll</Button>;
      case 'FINALIZED':
        return <Button disabled>Period Locked</Button>;
      case 'FAILED':
        return <Button onClick={handleProcess} className="bg-red-600 hover:bg-red-700">Retry Process</Button>;
      default:
        return <Button disabled>{selectedBatch.status}</Button>;
    }
  };

  return (
    <div className="p-8 bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h1 className="text-3xl font-bold">Time & Pay Reconciliation</h1>
        <div className="flex items-center space-x-4">
          <select
            value={selectedBatch?.id || ''}
            onChange={(e) => {
              const batch = batches.find(b => b.id === parseInt(e.target.value));
              setSelectedBatch(batch || null);
            }}
            disabled={loading || actionLoading}
            className="px-3 py-2 pr-8 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {batches.map(b => (
              <option key={b.id} value={b.id}>
                {new Date(b.payroll_period).toLocaleString('default', { month: 'long', year: 'numeric' })}
              </option>
            ))}
          </select>
          {renderActionButton()}
        </div>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {selectedBatch && (
        <div className="mb-6 bg-gray-50 p-4 rounded-lg border">
          <h2 className="text-xl font-semibold mb-2">Batch Details for {new Date(selectedBatch.payroll_period).toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><strong>Status:</strong> <span className="font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{selectedBatch.status}</span></div>
            <div><strong>Total Employees:</strong> {selectedBatch.total_employees}</div>
            <div><strong>Processed:</strong> {selectedBatch.processed_employees || 0}</div>
            <div><strong>Progress:</strong> {selectedBatch.progress_percentage || 0}%</div>
          </div>
        </div>
      )}
      
      <h2 className="text-2xl font-bold mb-4">Reconciliation Summary</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-4 border-b text-left">Employee Code</th>
              <th className="py-2 px-4 border-b text-left">Employee Name</th>
              <th className="py-2 px-4 border-b text-left">LOP Days</th>
              <th className="py-2 px-4 border-b text-left">Overtime Hours</th>
            </tr>
          </thead>
          <tbody>
            {summaryData.length > 0 ? summaryData.map((row) => (
              <tr key={row.user_id}>
                <td className="py-2 px-4 border-b">{row.emp_code}</td>
                <td className="py-2 px-4 border-b">{row.full_name}</td>
                <td className="py-2 px-4 border-b">{row.lop_days}</td>
                <td className="py-2 px-4 border-b">{row.total_overtime_hours}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="text-center py-4">No summary data to display. Process the batch to see results.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
