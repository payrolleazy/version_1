'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { EOAP_GATEWAY_CONFIGS } from '@/lib/constants';
import { callPgFunction } from '@/lib/useGateway';
import { DataTable, Pagination, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ActionConfirmModal from './ActionConfirmModal';

// Aligned with the result columns of public.eoap_get_pending_hires
interface PendingHire {
  id: string;
  full_name: string;
  email: string;
  mobile_no: string;
  position_id: number;
  onboarding_status: string;
  doj: string;
  last_sign_in_at: string | null;
}

// Maps ActionConfirmModal display keys to backend eoap_initiate_action values
const ACTION_TO_BACKEND: Record<string, string> = {
  APPROVE: 'approved',
  REJECT: 'rejected',
  ON_HOLD: 'on_hold',
};

const fetchClientIp = async (): Promise<string> => {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip;
  } catch {
    return '127.0.0.1';
  }
};

export default function PendingHiresTable() {
  const { session } = useSessionContext();
  const [hires, setHires] = useState<PendingHire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination - matches SQL v_page_size and v_page_number
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // Filters - matches SQL v_filter_email, v_filter_doj_start, v_filter_doj_end
  const [emailFilter, setEmailFilter] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Action modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedHire, setSelectedHire] = useState<PendingHire | null>(null);
  const [actionType, setActionType] = useState<string>('');

  const fetchPendingHires = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await callPgFunction(
        EOAP_GATEWAY_CONFIGS.PENDING_HIRES,
        {
          page_size: pageSize,
          page_number: currentPage,
          filter_email: emailFilter || null,
          filter_doj_start: dateRange.start || null,
          filter_doj_end: dateRange.end || null,
        },
        session.access_token
      );

      if (result.success && result.data) {
        setHires(result.data.data || []);
        setTotalItems(result.data.total_count || 0);
      } else {
        setError(result.error || 'Failed to fetch pending hires');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, currentPage, pageSize, emailFilter, dateRange]);

  useEffect(() => {
    fetchPendingHires();
  }, [fetchPendingHires]);

  const handleAction = (hire: PendingHire, action: string) => {
    setSelectedHire(hire);
    setActionType(action);
    setModalOpen(true);
  };

  const handleActionConfirm = async (comments: string) => {
    if (!session?.access_token || !selectedHire) return;

    const clientIp = await fetchClientIp();
    const backendAction = ACTION_TO_BACKEND[actionType] || actionType.toLowerCase();

    try {
      const result = await callPgFunction(
        EOAP_GATEWAY_CONFIGS.ACTION_INITIATE,
        {
          employee_user_id: selectedHire.id,
          action: backendAction,
          comments,
          ip_address: clientIp,
        },
        session.access_token
      );

      if (result.success) {
        setModalOpen(false);
        fetchPendingHires();
      } else {
        setError(result.error || 'Action execution failed');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const columns: Column<PendingHire>[] = useMemo(() => [
    {
      key: 'full_name',
      header: 'Candidate',
      sortable: true,
      render: (v: string, row: PendingHire) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-900">{v}</span>
          <span className="text-[10px] text-gray-400 font-mono">ID: {row.id.slice(0, 8)}</span>
        </div>
      ),
    },
    { key: 'email', header: 'Email', sortable: true },
    { key: 'mobile_no', header: 'Mobile' },
    {
      key: 'position_id',
      header: 'Position ID',
      render: (v: number) => <span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">{v}</span>,
    },
    {
      key: 'doj',
      header: 'Proposed Joining',
      sortable: true,
      render: (v: string) => v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'TBD',
    },
    {
      key: 'onboarding_status',
      header: 'Status',
      render: (v: string) => <StatusBadge status={v} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (_: any, row: PendingHire) => (
        <div className="flex space-x-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleAction(row, 'APPROVE'); }}
            className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full hover:bg-green-200 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleAction(row, 'REJECT'); }}
            className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full hover:bg-red-200 transition-colors"
          >
            Reject
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleAction(row, 'ON_HOLD'); }}
            className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
          >
            Hold
          </button>
        </div>
      ),
    },
  ], []);

  if (!session) {
    return <div className="min-h-screen flex items-center justify-center"><p>Loading session...</p></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[240px]">
          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Search Email</label>
          <Input
            placeholder="Filter by email pattern..."
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
          />
        </div>
        <div className="w-44">
          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Joining From</label>
          <Input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          />
        </div>
        <div className="w-44">
          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Joining To</label>
          <Input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          />
        </div>
        <Button onClick={fetchPendingHires} disabled={loading} variant="secondary">
          Apply Filters
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded shadow-inner flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs font-bold uppercase hover:underline">Dismiss</button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <DataTable
          data={hires}
          columns={columns}
          loading={loading}
          rowKey="id"
          emptyMessage="No pending hires found"
          emptyDescription="Either all candidates have active workflows or they do not match your current filters."
        />

        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalItems / pageSize)}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
        />
      </div>

      <ActionConfirmModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleActionConfirm}
        actionType={actionType}
        candidateName={selectedHire?.full_name || ''}
      />
    </div>
  );
}
