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

interface AuditLogEntry {
  id: number;
  timestamp: string;
  action: string;
  table_name: string;
  record_id: number | null;
  changed_by_user_id: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  change_summary: string | null;
  log_date: string;
  // Enriched
  changed_by_name?: string;
  changed_by_email?: string;
}

// ============================================================================
// CONFIG IDS
// ============================================================================

const CONFIGS = {
  READ_AUDIT_LOG: 'c8d7e6f5-4a3b-2c1d-0e9f-8a7b6c5d4e3f',
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
// HELPER: JSON DIFF VIEWER
// ============================================================================

function JsonDiffViewer({ oldValues, newValues }: { oldValues: any; newValues: any }) {
  if (!oldValues && !newValues) {
    return <p className="text-sm text-gray-500 italic">No data available</p>;
  }

  const allKeys = new Set([
    ...Object.keys(oldValues || {}),
    ...Object.keys(newValues || {})
  ]);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Field</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Old Value</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">New Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {Array.from(allKeys).map(key => {
            const oldVal = oldValues?.[key];
            const newVal = newValues?.[key];
            const hasChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

            return (
              <tr key={key} className={hasChanged ? 'bg-yellow-50' : ''}>
                <td className="px-3 py-2 font-mono text-xs text-gray-700">{key}</td>
                <td className="px-3 py-2">
                  {oldVal !== undefined ? (
                    <span className={`text-xs ${hasChanged ? 'text-red-600 line-through' : 'text-gray-600'}`}>
                      {typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal)}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs italic">-</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {newVal !== undefined ? (
                    <span className={`text-xs ${hasChanged ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                      {typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs italic">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AuditTrailPage() {
  const { session } = useSessionContext();

  // Data state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Filter state
  const [filterAction, setFilterAction] = useState<string>('');
  const [filterTable, setFilterTable] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<AuditLogEntry | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;

  // Available tables for filter dropdown
  const wcmTables = [
    'wcm_components',
    'wcm_component_dependencies',
    'wcm_pay_structures',
    'wcm_pay_structure_components',
    'wcm_pay_structure_versions',
    'wcm_employee_pay_structure_assignments',
    'wcm_payroll_processing_batches',
    'wcm_payroll_input_data',
    'wcm_payroll_areas',
    'wcm_arrear_batches',
    'wcm_arrear_master',
    'wcm_fbp_benefit_master',
    'wcm_fbp_policies',
    'wcm_fbp_declarations',
    'wcm_fbp_reimbursement_claims',
    'wcm_fnf_calculation_worksheet',
    'wcm_fnf_clearance_checklist',
  ];

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchAuditLogs = useCallback(async () => {
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);

    try {
      // Build filters
      const filters: Record<string, any> = {};

      if (filterAction) {
        filters.action = filterAction;
      }

      if (filterTable) {
        filters.table_name = filterTable;
      }

      // Date range filtering would need backend support for >= and <=
      // For now, we filter by log_date if single date provided
      if (filterDateFrom) {
        filters.log_date = filterDateFrom;
      }

      const res = await callApi('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_AUDIT_LOG,
        params: {
          filters,
          orderBy: [['timestamp', 'DESC']],
          limit: PAGE_SIZE,
          offset: (currentPage - 1) * PAGE_SIZE
        }
      }, session.access_token);

      setAuditLogs(res.data || []);
      setTotalCount(res.totalCount || res.data?.length || 0);

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session, filterAction, filterTable, filterDateFrom, currentPage]);

  // Fetch on mount and filter change
  useEffect(() => {
    if (session) {
      fetchAuditLogs();
    }
  }, [session, currentPage, fetchAuditLogs]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSearch = () => {
    setCurrentPage(1);
    fetchAuditLogs();
  };

  const handleReset = () => {
    setFilterAction('');
    setFilterTable('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setCurrentPage(1);
  };

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      'INSERT': 'bg-green-100 text-green-800',
      'UPDATE': 'bg-blue-100 text-blue-800',
      'DELETE': 'bg-red-100 text-red-800',
      'UPSERT': 'bg-purple-100 text-purple-800',
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  const formatTableName = (tableName: string) => {
    // Remove wcm_ prefix and format nicely
    return tableName
      .replace('wcm_', '')
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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
              <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
              <p className="text-sm text-gray-500 mt-1">Track all changes made to payroll data</p>
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

            {/* Action Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Actions</option>
                <option value="INSERT">INSERT</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
                <option value="UPSERT">UPSERT</option>
              </select>
            </div>

            {/* Table Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Table</label>
              <select
                value={filterTable}
                onChange={(e) => setFilterTable(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Tables</option>
                {wcmTables.map(t => (
                  <option key={t} value={t}>{formatTableName(t)}</option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />
            </div>

            {/* Search Button */}
            <div className="flex items-end">
              <Button onClick={handleSearch} className="w-full" disabled={loading}>
                Search
              </Button>
            </div>

            {/* Reset Button */}
            <div className="flex items-end">
              <Button variant="ghost" onClick={handleReset} className="w-full">
                Reset
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

        {/* Audit Log Table */}
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader />
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="mt-2">No audit logs found. Try adjusting your filters.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Table</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Record ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Summary</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {new Date(log.timestamp).toLocaleDateString('en-IN')}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(log.timestamp).toLocaleTimeString('en-IN')}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActionBadge(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{formatTableName(log.table_name)}</div>
                          <div className="text-xs text-gray-500 font-mono">{log.table_name}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">
                          {log.record_id || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-600 max-w-xs truncate">
                            {log.change_summary || 'No summary available'}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailModal(log)}
                          >
                            View Changes
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
                  Showing {((currentPage - 1) * PAGE_SIZE) + 1} to {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} entries
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
          title={`Audit Details - ${detailModal.action} on ${formatTableName(detailModal.table_name)}`}
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500 uppercase">Timestamp</p>
                <p className="text-sm font-medium">{new Date(detailModal.timestamp).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Action</p>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActionBadge(detailModal.action)}`}>
                  {detailModal.action}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Table</p>
                <p className="text-sm font-mono">{detailModal.table_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Record ID</p>
                <p className="text-sm font-mono">{detailModal.record_id || 'N/A'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500 uppercase">Changed By</p>
                <p className="text-sm font-mono">{detailModal.changed_by_user_id || 'System'}</p>
              </div>
            </div>

            {/* Change Summary */}
            {detailModal.change_summary && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Change Summary</h4>
                <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">{detailModal.change_summary}</p>
              </div>
            )}

            {/* Diff View */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Field Changes</h4>
              <div className="border rounded-lg overflow-hidden">
                <JsonDiffViewer oldValues={detailModal.old_values} newValues={detailModal.new_values} />
              </div>
            </div>

            {/* Raw JSON (collapsible) */}
            <details className="group">
              <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-blue-600">
                View Raw JSON Data
              </summary>
              <div className="mt-2 space-y-2">
                {detailModal.old_values && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Old Values:</p>
                    <div className="bg-gray-900 text-red-400 p-3 rounded-lg overflow-x-auto">
                      <pre className="text-xs">{JSON.stringify(detailModal.old_values, null, 2)}</pre>
                    </div>
                  </div>
                )}
                {detailModal.new_values && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">New Values:</p>
                    <div className="bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto">
                      <pre className="text-xs">{JSON.stringify(detailModal.new_values, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            </details>

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={() => setDetailModal(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
