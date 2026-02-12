'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { EOAP_READ_CONFIGS } from '@/lib/constants';
import { callReadGateway } from '@/lib/useGateway';
import { DataTable, Pagination, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import Button from '@/components/ui/Button';

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  performed_by: string;
  performer_name: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export default function OnboardingAuditLog() {
  const { session } = useSessionContext();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [searchText, setSearchText] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const fetchEntries = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const filters: Record<string, any> = {};
      if (actionFilter !== 'ALL') filters.action = actionFilter;
      if (searchText.trim()) filters.performer_name = searchText.trim();

      const result = await callReadGateway(
        EOAP_READ_CONFIGS.AUDIT_LOG,
        { filters, limit: pageSize, offset: (currentPage - 1) * pageSize, orderBy: [['created_at', 'DESC']] },
        session.access_token
      );
      if (result.success && result.data) {
        const data = result.data as any;
        setEntries(Array.isArray(data) ? data : data.rows || []);
        setTotalItems(data.total_count || data.length || 0);
      } else {
        setError(result.error || 'Failed to fetch audit log');
      }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [session?.access_token, currentPage, pageSize, actionFilter, searchText]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const columns: Column<AuditEntry>[] = [
    {
      key: 'created_at',
      header: 'Timestamp',
      sortable: true,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
    { key: 'action', header: 'Action', render: (v: string) => <StatusBadge status={v} size="sm" /> },
    { key: 'entity_type', header: 'Entity' },
    { key: 'performer_name', header: 'Performed By', sortable: true },
    { key: 'details', header: 'Details', render: (v: string) => <span className="text-sm text-gray-600 truncate max-w-xs block">{v || '-'}</span> },
    { key: 'ip_address', header: 'IP Address' },
  ];

  if (!session) return <div className="min-h-screen flex items-center justify-center"><p>Loading session...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-gray-800">Audit Log</h2>
        <div className="flex items-center space-x-3">
          <input
            type="text"
            placeholder="Search by user..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchEntries()}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-48"
          />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="ALL">All Actions</option>
            <option value="APPROVE">Approve</option>
            <option value="REJECT">Reject</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="STEP_COMPLETE">Step Complete</option>
            <option value="ASSET_ASSIGN">Asset Assign</option>
            <option value="WORKFLOW_CREATE">Workflow Create</option>
          </select>
          <Button onClick={fetchEntries} disabled={loading}>Search</Button>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">{error}</div>}

      <DataTable data={entries} columns={columns} loading={loading} rowKey="id" emptyMessage="No audit entries found" />

      <Pagination currentPage={currentPage} totalPages={Math.ceil(totalItems / pageSize)} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} />
    </div>
  );
}
