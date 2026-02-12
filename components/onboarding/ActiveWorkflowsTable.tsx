'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { EOAP_READ_CONFIGS, EOAP_WORKFLOW_STATUS } from '@/lib/constants';
import { callReadGateway } from '@/lib/useGateway';
import { DataTable, Pagination, Column } from '@/components/ui/DataTable';
import { StatusBadge, PriorityBadge, CountBadge } from '@/components/ui/StatusBadge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatDate } from '@/lib/dateUtils';

// Aligned with public.eoap_active_workflows_view + read config allowed_columns
interface ActiveWorkflow {
  workflow_id: string;
  employee_user_id: string;
  employee_name: string;
  employee_email: string;
  status: string;
  priority: string;
  progress_percentage: number;
  current_step: string;
  expected_completion_date: string;
  pending_steps_count: number;
  last_activity_at: string;
  updated_at: string;
}

interface ActiveWorkflowsTableProps {
  basePath: string;
}

// Active workflow statuses (view excludes COMPLETED and CANCELLED)
const ACTIVE_STATUSES = [
  { value: EOAP_WORKFLOW_STATUS.PENDING_HR_REVIEW, label: 'Pending HR Review' },
  { value: EOAP_WORKFLOW_STATUS.PENDING_MANAGER_REVIEW, label: 'Pending Manager Review' },
  { value: EOAP_WORKFLOW_STATUS.HR_APPROVED, label: 'HR Approved' },
  { value: EOAP_WORKFLOW_STATUS.ACTIVATION_IN_PROGRESS, label: 'Activation In Progress' },
  { value: EOAP_WORKFLOW_STATUS.ASSETS_PENDING, label: 'Assets Pending' },
  { value: EOAP_WORKFLOW_STATUS.DOCUMENTS_PENDING, label: 'Documents Pending' },
  { value: EOAP_WORKFLOW_STATUS.ON_HOLD, label: 'On Hold' },
  { value: EOAP_WORKFLOW_STATUS.FAILED, label: 'Failed' },
];

export default function ActiveWorkflowsTable({ basePath }: ActiveWorkflowsTableProps) {
  const { session } = useSessionContext();
  const router = useRouter();
  const [workflows, setWorkflows] = useState<ActiveWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchWorkflows = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const filters: Record<string, any> = {};
      if (statusFilter !== 'ALL') filters.status = statusFilter;
      if (searchQuery) filters.employee_name = searchQuery;

      const result = await callReadGateway(
        EOAP_READ_CONFIGS.ACTIVE_WORKFLOWS_LIST,
        {
          filters,
          limit: pageSize,
          offset: (currentPage - 1) * pageSize,
          orderBy: [['updated_at', 'DESC']],
        },
        session.access_token
      );

      if (result.success && result.data) {
        const responseData = result.data as any;
        const dataArray = Array.isArray(responseData) ? responseData : responseData.data || [];
        setWorkflows(dataArray);
        setTotalItems(responseData.total_records || dataArray.length || 0);
      } else {
        setError(result.error || 'Failed to fetch active workflows');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, currentPage, pageSize, statusFilter, searchQuery]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const columns: Column<ActiveWorkflow>[] = useMemo(() => [
    {
      key: 'employee_name',
      header: 'Candidate',
      sortable: true,
      render: (val: string, row: ActiveWorkflow) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-900">{val}</span>
          <span className="text-xs text-gray-500">{row.employee_email}</span>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (val: string) => <PriorityBadge priority={val.toLowerCase() as any} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (val: string) => <StatusBadge status={val} size="sm" />,
    },
    {
      key: 'progress_percentage',
      header: 'Progress',
      render: (val: number) => (
        <div className="flex items-center space-x-2 w-36">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${val || 0}%` }} />
          </div>
          <span className="text-xs font-medium text-gray-600">{val || 0}%</span>
        </div>
      ),
    },
    {
      key: 'current_step',
      header: 'Current Step',
      render: (val: string, row: ActiveWorkflow) => (
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <span className="text-sm text-gray-800">{val || 'Pending...'}</span>
            <span className="text-[10px] text-gray-400">
              Updated: {row.last_activity_at ? formatDate(row.last_activity_at) : 'N/A'}
            </span>
          </div>
          {row.pending_steps_count > 0 && (
            <CountBadge count={row.pending_steps_count} variant="warning" size="sm" />
          )}
        </div>
      ),
    },
    {
      key: 'expected_completion_date',
      header: 'Expected By',
      render: (val: string) => val ? new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
    },
    {
      key: 'actions',
      header: '',
      render: (_: any, row: ActiveWorkflow) => (
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`${basePath}/onboarding/employee-detail/${row.employee_user_id}`); }}
          className="text-sm text-purple-600 hover:text-purple-800 font-medium"
        >
          Manage
        </button>
      ),
    },
  ], [basePath, router]);

  if (!session) {
    return <div className="min-h-screen flex items-center justify-center"><p>Loading session...</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center space-x-3">
          <Input
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="ALL">All Statuses</option>
            {ACTIVE_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <Button onClick={fetchWorkflows} disabled={loading}>Refresh</Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs font-bold uppercase hover:underline">Dismiss</button>
        </div>
      )}

      <DataTable
        data={workflows}
        columns={columns}
        loading={loading}
        rowKey="workflow_id"
        emptyMessage="No active workflows"
        emptyDescription="All candidates have completed or no workflows are in progress."
        onRowClick={(row) => router.push(`${basePath}/onboarding/employee-detail/${row.employee_user_id}`)}
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
  );
}
