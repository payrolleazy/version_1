'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Loader from '@/components/ui/Loader';
import Modal from '@/components/Modal';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface CalculationResult {
  id: number;
  tenant_id: string;
  user_id: string;
  component_id: number;
  payroll_period: string;
  batch_id: number | null;
  calculated_value: number;
  calculation_method: string;
  input_values: Record<string, any> | null;
  calculation_details: Record<string, any> | null;
  calculation_timestamp: string;
  is_reversed: boolean;
  reversal_of_result_id: number | null;
  // Enriched fields (from employee details)
  employee_name?: string;
  emp_code?: string;
  // Component details (joined)
  component_code?: string;
  component_name?: string;
}

interface PayrollBatch {
  id: number;
  batch_code: string;
  payroll_period: string;
  status: string;
}

interface PayComponent {
  id: number;
  component_code: string;
  name: string;
}

// ============================================================================
// CONFIG IDS
// ============================================================================

const CONFIGS = {
  READ_RESULTS: '306bb078-108f-4023-ba60-d4a29a3119f2',
  READ_BATCHES: '75e87d9b-ad1c-4639-b519-6626f9488fec',
  READ_COMPONENTS: '0872c31a-89cb-4b33-bff6-b5b3e954a705',
};

// ============================================================================
// HELPER: API CALLER
// ============================================================================

async function callApi(endpoint: string, payload: any, token: string) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, accessToken: token }),
  });
  const result = await response.json();
  if (!response.ok || (result.hasOwnProperty('success') && !result.success)) {
    throw new Error(result.message || 'API Request Failed');
  }
  return result;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CalculationResultsPage() {
  const { session } = useSessionContext();

  // Data state
  const [results, setResults] = useState<CalculationResult[]>([]);
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [components, setComponents] = useState<PayComponent[]>([]);

  // Filter state
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [selectedComponentId, setSelectedComponentId] = useState<number | null>(null);
  const [searchEmpCode, setSearchEmpCode] = useState<string>('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<CalculationResult | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchBatches = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await callApi('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_BATCHES,
        params: {
          filters: { status: 'COMPLETED' },
          orderBy: [['payroll_period', 'DESC']],
          limit: 100
        }
      }, session.access_token);
      setBatches(res.data || []);
    } catch (e: any) {
      console.error('Failed to fetch batches:', e);
    }
  }, [session]);

  const fetchComponents = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await callApi('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_COMPONENTS,
        params: {
          filters: { is_active: true },
          orderBy: [['component_code', 'ASC']],
          limit: 500
        }
      }, session.access_token);
      setComponents(res.data || []);
    } catch (e: any) {
      console.error('Failed to fetch components:', e);
    }
  }, [session]);

  const fetchResults = useCallback(async () => {
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);

    try {
      // Build filters
      const filters: Record<string, any> = {};

      if (selectedBatchId) {
        filters.batch_id = selectedBatchId;
      }

      if (selectedPeriod) {
        filters.payroll_period = selectedPeriod;
      }

      if (selectedComponentId) {
        filters.component_id = selectedComponentId;
      }

      const res = await callApi('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_RESULTS,
        params: {
          filters,
          orderBy: [['calculation_timestamp', 'DESC']],
          limit: PAGE_SIZE,
          offset: (currentPage - 1) * PAGE_SIZE
        }
      }, session.access_token);

      // Enrich with component names
      const enrichedResults = (res.data || []).map((r: CalculationResult) => {
        const comp = components.find(c => c.id === r.component_id);
        return {
          ...r,
          component_code: comp?.component_code || `ID:${r.component_id}`,
          component_name: comp?.name || 'Unknown Component'
        };
      });

      setResults(enrichedResults);
      setTotalCount(res.totalCount || res.data?.length || 0);

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session, selectedBatchId, selectedPeriod, selectedComponentId, currentPage, components]);

  // Initial load
  useEffect(() => {
    if (session) {
      fetchBatches();
      fetchComponents();
    }
  }, [session, fetchBatches, fetchComponents]);

  // Fetch results when filters change
  useEffect(() => {
    if (session && components.length > 0) {
      fetchResults();
    }
  }, [session, selectedBatchId, selectedPeriod, selectedComponentId, currentPage, components, fetchResults]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSearch = () => {
    setCurrentPage(1);
    fetchResults();
  };

  const handleReset = () => {
    setSelectedBatchId(null);
    setSelectedPeriod('');
    setSelectedComponentId(null);
    setSearchEmpCode('');
    setCurrentPage(1);
  };

  const handleExportToExcel = async () => {
    // Simple CSV export
    if (results.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = ['Employee Code', 'Component Code', 'Component Name', 'Payroll Period', 'Calculated Value', 'Method', 'Timestamp', 'Reversed'];
    const rows = results.map(r => [
      r.emp_code || r.user_id,
      r.component_code,
      r.component_name,
      r.payroll_period,
      r.calculated_value,
      r.calculation_method,
      new Date(r.calculation_timestamp).toLocaleString(),
      r.is_reversed ? 'Yes' : 'No'
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calculation_results_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(value);
  };

  const getMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      'FORMULA': 'bg-blue-100 text-blue-800',
      'FIXED': 'bg-green-100 text-green-800',
      'PERCENTAGE': 'bg-purple-100 text-purple-800',
      'SLAB': 'bg-orange-100 text-orange-800',
      'EXTERNAL': 'bg-gray-100 text-gray-800',
      'MANUAL': 'bg-yellow-100 text-yellow-800'
    };
    return colors[method] || 'bg-gray-100 text-gray-800';
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!session) return <Loader />;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-sm">

        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Calculation Results Viewer</h1>
              <p className="text-sm text-gray-500 mt-1">View and analyze payroll calculation results</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportToExcel} disabled={results.length === 0}>
                Export CSV
              </Button>
              <Button onClick={handleSearch} disabled={loading}>
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

            {/* Batch Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payroll Batch</label>
              <select
                value={selectedBatchId || ''}
                onChange={(e) => {
                  setSelectedBatchId(e.target.value ? parseInt(e.target.value) : null);
                  setCurrentPage(1);
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Batches</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.batch_code} - {new Date(b.payroll_period).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                  </option>
                ))}
              </select>
            </div>

            {/* Period Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payroll Period</label>
              <Input
                type="month"
                value={selectedPeriod ? selectedPeriod.substring(0, 7) : ''}
                onChange={(e) => {
                  setSelectedPeriod(e.target.value ? `${e.target.value}-01` : '');
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Component Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Component</label>
              <select
                value={selectedComponentId || ''}
                onChange={(e) => {
                  setSelectedComponentId(e.target.value ? parseInt(e.target.value) : null);
                  setCurrentPage(1);
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Components</option>
                {components.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.component_code} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Button */}
            <div className="flex items-end">
              <Button variant="ghost" onClick={handleReset} className="w-full">
                Reset Filters
              </Button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
            <button onClick={() => setError(null)} className="float-right font-bold">&times;</button>
          </div>
        )}

        {/* Results Table */}
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader />
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-2">No calculation results found. Try adjusting your filters.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Component</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {results.map((result) => (
                      <tr key={result.id} className={`hover:bg-gray-50 ${result.is_reversed ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{result.emp_code || 'N/A'}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[150px]">{result.employee_name || result.user_id.substring(0, 8)}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-mono text-blue-600">{result.component_code}</div>
                          <div className="text-xs text-gray-500">{result.component_name}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {new Date(result.payroll_period).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <span className={`text-sm font-semibold ${result.calculated_value >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {formatCurrency(result.calculated_value)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getMethodBadge(result.calculation_method)}`}>
                            {result.calculation_method}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {result.is_reversed ? (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                              REVERSED
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              ACTIVE
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailModal(result)}
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-500">
                  Showing {((currentPage - 1) * PAGE_SIZE) + 1} to {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} results
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="px-3 py-1 text-sm text-gray-700">
                    Page {currentPage} of {Math.ceil(totalCount / PAGE_SIZE) || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={currentPage * PAGE_SIZE >= totalCount}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {detailModal && (
        <Modal
          isOpen={!!detailModal}
          onClose={() => setDetailModal(null)}
          title={`Calculation Details - ${detailModal.component_code}`}
        >
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500 uppercase">Employee</p>
                <p className="text-sm font-medium">{detailModal.emp_code || detailModal.user_id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Component</p>
                <p className="text-sm font-medium">{detailModal.component_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Period</p>
                <p className="text-sm font-medium">{new Date(detailModal.payroll_period).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Calculated Value</p>
                <p className="text-lg font-bold text-green-700">{formatCurrency(detailModal.calculated_value)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Method</p>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getMethodBadge(detailModal.calculation_method)}`}>
                  {detailModal.calculation_method}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Timestamp</p>
                <p className="text-sm">{new Date(detailModal.calculation_timestamp).toLocaleString()}</p>
              </div>
            </div>

            {/* Input Values */}
            {detailModal.input_values && Object.keys(detailModal.input_values).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Input Values</h4>
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-xs">{JSON.stringify(detailModal.input_values, null, 2)}</pre>
                </div>
              </div>
            )}

            {/* Calculation Details */}
            {detailModal.calculation_details && Object.keys(detailModal.calculation_details).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Calculation Breakdown</h4>
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-xs">{JSON.stringify(detailModal.calculation_details, null, 2)}</pre>
                </div>
              </div>
            )}

            {/* Reversal Info */}
            {detailModal.is_reversed && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  <strong>Reversed:</strong> This calculation has been reversed.
                  {detailModal.reversal_of_result_id && (
                    <span> Original Result ID: {detailModal.reversal_of_result_id}</span>
                  )}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button onClick={() => setDetailModal(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
