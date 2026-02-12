'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { EOAP_READ_CONFIGS } from '@/lib/constants';
import { callReadGateway } from '@/lib/useGateway';
import { DataTable, Pagination, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import Button from '@/components/ui/Button';

interface EmailLogEntry {
  id: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  template_name: string;
  status: string;
  sent_at: string;
  delivered_at: string | null;
  opened_at: string | null;
  error_message: string | null;
  created_at: string;
}

export default function OnboardingEmailLog() {
  const { session } = useSessionContext();
  const [entries, setEntries] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchEntries = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const filters: Record<string, any> = {};
      if (statusFilter !== 'ALL') filters.status = statusFilter;

      const result = await callReadGateway(
        EOAP_READ_CONFIGS.EMAIL_LOG,
        { filters, limit: pageSize, offset: (currentPage - 1) * pageSize, orderBy: [['created_at', 'DESC']] },
        session.access_token
      );
      if (result.success && result.data) {
        const data = result.data as any;
        setEntries(Array.isArray(data) ? data : data.rows || []);
        setTotalItems(data.total_count || data.length || 0);
      } else {
        setError(result.error || 'Failed to fetch email log');
      }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [session?.access_token, currentPage, pageSize, statusFilter]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const columns: Column<EmailLogEntry>[] = [
    { key: 'recipient_name', header: 'Recipient', sortable: true },
    { key: 'recipient_email', header: 'Email' },
    { key: 'subject', header: 'Subject' },
    { key: 'template_name', header: 'Template' },
    { key: 'status', header: 'Status', render: (v: string) => <StatusBadge status={v} size="sm" /> },
    { key: 'sent_at', header: 'Sent', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { key: 'delivered_at', header: 'Delivered', render: (v: string | null) => v ? new Date(v).toLocaleString() : '-' },
    { key: 'opened_at', header: 'Opened', render: (v: string | null) => v ? new Date(v).toLocaleString() : '-' },
    { key: 'error_message', header: 'Error', render: (v: string | null) => v ? <span className="text-xs text-red-600 truncate max-w-xs block">{v}</span> : '-' },
  ];

  if (!session) return <div className="min-h-screen flex items-center justify-center"><p>Loading session...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800">Email Log</h2>
        <div className="flex items-center space-x-3">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Queued">Queued</option>
            <option value="Sent">Sent</option>
            <option value="Failed">Failed</option>
            <option value="Delivered">Delivered</option>
            <option value="Bounced">Bounced</option>
            <option value="Spam">Spam</option>
          </select>
          <Button onClick={fetchEntries} disabled={loading}>Refresh</Button>
        </div>
      </div>
      {error && <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">{error}</div>}
      <DataTable data={entries} columns={columns} loading={loading} rowKey="id" emptyMessage="No email log entries" compact />
      <Pagination currentPage={currentPage} totalPages={Math.ceil(totalItems / pageSize)} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} />
    </div>
  );
}
