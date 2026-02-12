'use client';

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Loader from '@/components/ui/Loader';

// ============================================================================
// 1. TYPES
// ============================================================================

interface LedgerEntry {
  id: number;
  user_id: string;
  ip_number: string;
  gross_wages: number;
  esic_eligible_wages: number;
  employee_contribution: number;
  employer_contribution: number;
  worked_days: number;
  has_warnings: boolean;
  warning_messages: string[] | null;
  // Enriched fields
  full_name?: string;
  emp_code?: string;
}

interface BatchDetails {
  id: number;
  batch_code: string;
  payroll_period: string;
  status: string;
  total_employees: number;
  total_wages?: number; // Might calculate on frontend if not in batch table
}

// ============================================================================
// 2. CONFIGURATION CONSTANTS
// ============================================================================

const CONFIGS = {
  READ_LEDGER: '5edbb239-cee4-46c7-9fc5-fcb09bb4510e',
  READ_BATCH: '08fc7812-10d4-4e72-bd16-0b27148ad284',
  GENERATE_CHALLAN: 'wcm_esic_generate_challan'
};

// ============================================================================
// 3. PAGE COMPONENT
// ============================================================================

export default function EsicLedgerPage() {
  return (
    <Suspense fallback={<Loader />}>
      <EsicLedgerContent />
    </Suspense>
  );
}

function EsicLedgerContent() {
  const { session } = useSessionContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchId = searchParams.get('batch_id');

  // State
  const [ledgerData, setLedgerData] = useState<LedgerEntry[]>([]);
  const [batchInfo, setBatchInfo] = useState<BatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [generating, setGenerating] = useState(false);

  // --------------------------------------------------------------------------
  // Data Fetching
  // --------------------------------------------------------------------------
  const fetchData = useCallback(async () => {
    if (!session?.access_token || !batchId) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch Batch Details
      const batchRes = await fetch('/api/a_crud_universal_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: CONFIGS.READ_BATCH,
          params: { filters: { id: batchId } }, // Strict filter by ID
          accessToken: session.access_token,
        }),
      }).then(r => r.json());

      if (!batchRes.success || !batchRes.data?.length) {
        throw new Error("Batch not found.");
      }
      setBatchInfo(batchRes.data[0]);

      // 2. Fetch Ledger Entries (With Enrichment)
      const ledgerRes = await fetch('/api/a_crud_universal_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: CONFIGS.READ_LEDGER,
          params: { 
            filters: { batch_id: batchId },
            limit: 2000 // Reasonable limit for a single batch view
          },
          // CRITICAL: JOIN to get Employee Name
          p_enrich_with_employee_details: true, 
          accessToken: session.access_token,
        }),
      }).then(r => r.json());

      if (!ledgerRes.success) {
        throw new Error(ledgerRes.message || "Failed to load ledger.");
      }

      setLedgerData(ledgerRes.data || []);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, batchId]);

  useEffect(() => {
    if (batchId) {
      fetchData();
    } else {
      setError("No Batch ID provided.");
      setLoading(false);
    }
  }, [batchId, fetchData]);

  // --------------------------------------------------------------------------
  // Action: Generate Challan
  // --------------------------------------------------------------------------
  const handleGenerateChallan = async () => {
    if (!session?.access_token || !batchId) return;
    
    if (!confirm("Are you sure? This will finalize the numbers and generate the ECR file.")) return;

    setGenerating(true);
    try {
      const response = await fetch('/api/a_crud_universal_pg_function_gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: CONFIGS.GENERATE_CHALLAN,
          params: {
            p_payload: {
                computation_batch_id: Number(batchId),
                user_id: session.user.id
            }
          },
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();

      if (!response.ok || (result.data && result.data.success === false)) {
        throw new Error(result.data?.error || result.message || "Challan generation failed");
      }

      // Success! Navigate to Challan Manager
      alert("Challan Generated Successfully!");
      router.push('/payroll_admin/esic-challan');

    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // --------------------------------------------------------------------------
  // Computed Stats & Filtering
  // --------------------------------------------------------------------------
  const filteredData = useMemo(() => {
    return ledgerData.filter(row => 
      (row.full_name?.toLowerCase() || '').includes(filterText.toLowerCase()) ||
      (row.emp_code?.toLowerCase() || '').includes(filterText.toLowerCase()) ||
      (row.ip_number || '').includes(filterText)
    );
  }, [ledgerData, filterText]);

  const stats = useMemo(() => {
    return ledgerData.reduce((acc, row) => ({
      totalGross: acc.totalGross + (row.gross_wages || 0),
      totalEligible: acc.totalEligible + (row.esic_eligible_wages || 0),
      totalEmp: acc.totalEmp + (row.employee_contribution || 0),
      totalEmplr: acc.totalEmplr + (row.employer_contribution || 0)
    }), { totalGross: 0, totalEligible: 0, totalEmp: 0, totalEmplr: 0 });
  }, [ledgerData]);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  if (loading) return <Loader />;
  if (error) return <div className="p-8 text-red-500">{error}</div>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">&larr; Back</button>
            <h1 className="text-3xl font-bold text-gray-800">Batch Ledger</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1 ml-8">
            {batchInfo ? `${new Date(batchInfo.payroll_period).toLocaleString('default', { month: 'long', year: 'numeric' })} (${batchInfo.batch_code})` : 'Loading...'}
          </p>
        </div>
        
        {batchInfo?.status === 'COMPLETED' || batchInfo?.status === 'COMPLETED_WITH_WARNINGS' ? (
           <Button onClick={handleGenerateChallan} isLoading={generating} className="bg-green-600 hover:bg-green-700 text-white">
             Finalize & Generate Challan
           </Button>
        ) : (
           <div className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded">
             Status: {batchInfo?.status} (Cannot Generate Challan)
           </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Employees" value={ledgerData.length} />
        <StatCard title="Eligible Wages" value={`₹${stats.totalEligible.toLocaleString()}`} />
        <StatCard title="Employee Share (0.75%)" value={`₹${stats.totalEmp.toLocaleString()}`} />
        <StatCard title="Employer Share (3.25%)" value={`₹${stats.totalEmplr.toLocaleString()}`} />
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <Input 
          placeholder="Search by Name, Code, or IP..." 
          value={filterText} 
          onChange={e => setFilterText(e.target.value)} 
          className="max-w-md"
        />
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Number</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Days</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gross Wages</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Eligible Wages</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Emp Contrib</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Emplr Contrib</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{row.full_name || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{row.emp_code || row.user_id}</div>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-600">{row.ip_number}</td>
                  <td className={`px-6 py-4 text-center text-sm font-medium ${row.worked_days === 0 ? 'text-red-500 bg-red-50' : 'text-gray-900'}`}>
                    {row.worked_days}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-500">₹{row.gross_wages.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">₹{row.esic_eligible_wages.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-sm text-red-600">- ₹{row.employee_contribution}</td>
                  <td className="px-6 py-4 text-right text-sm text-blue-600">₹{row.employer_contribution}</td>
                  <td className="px-6 py-4 text-center">
                    {row.has_warnings ? (
                      <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full" title={row.warning_messages?.join(', ')}>Warning</span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">OK</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-gray-500">No entries match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Simple Stat Component
const StatCard = ({ title, value }: { title: string, value: string | number }) => (
  <div className="bg-white p-4 rounded-lg shadow border border-gray-100">
    <p className="text-xs text-gray-500 uppercase font-semibold">{title}</p>
    <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
  </div>
);