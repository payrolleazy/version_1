'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import Modal from '@/components/Modal';
import { DataTable, Pagination, Column } from '@/components/ui/DataTable';
import { ErrorBoundary, LoadingState } from '@/components/ui/ErrorBoundary';
import { BatchStatusBadge } from '@/components/ui/StatusBadge';
import { TPS_GATEWAY_CONFIGS, TPS_BATCH_STATUS, PAGINATION } from '@/lib/constants';
import { callReadGateway, callPgFunction } from '@/lib/useGateway';
import { formatDate, formatDateTime, formatMonthYear } from '@/lib/dateUtils';

// ============================================================================
// Types
// ============================================================================
interface PayrollBatch {
  id: string;
  batch_code: string;
  period_start: string;
  period_end: string;
  period_month: number;
  period_year: number;
  status: 'OPEN' | 'FROZEN' | 'PROCESSING' | 'PROCESSED' | 'FINALIZED';
  total_employees: number;
  total_work_days: number;
  total_present_days: number;
  total_absent_days: number;
  total_leave_days: number;
  total_overtime_hours: number;
  total_late_instances: number;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  finalized_at: string | null;
  finalized_by: string | null;
  notes: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

interface BatchStats {
  total_batches: number;
  open_batches: number;
  frozen_batches: number;
  processed_batches: number;
  finalized_batches: number;
}

// ============================================================================
// Main Component
// ============================================================================
export default function PayrollBatchesPage() {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const router = useRouter();

  // State
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [stats, setStats] = useState<BatchStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGINATION.DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const currentYear = new Date().getFullYear();
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Modal State
  const [selectedBatch, setSelectedBatch] = useState<PayrollBatch | null>(null);
  const [actionType, setActionType] = useState<'freeze' | 'process' | 'finalize' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch batches
  const fetchBatches = useCallback(async () => {
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);

    try {
      const filters: Record<string, any> = { period_year: filterYear };
      if (filterStatus) {
        filters.status = filterStatus;
      }

      const result = await callReadGateway<PayrollBatch[]>(
        TPS_GATEWAY_CONFIGS.READ_BATCHES,
        {
          filters,
          orderBy: [['period_year', 'DESC'], ['period_month', 'DESC']],
          limit: pageSize,
          offset: (currentPage - 1) * pageSize,
        },
        session.access_token
      );

      if (result.success && result.data) {
        const data = Array.isArray(result.data) ? result.data : [];
        setBatches(data);
        setTotalCount(data.length >= pageSize ? data.length + 1 : data.length);

        // Calculate stats
        const allBatches = data;
        setStats({
          total_batches: allBatches.length,
          open_batches: allBatches.filter((b) => b.status === 'OPEN').length,
          frozen_batches: allBatches.filter((b) => b.status === 'FROZEN').length,
          processed_batches: allBatches.filter((b) => b.status === 'PROCESSED').length,
          finalized_batches: allBatches.filter((b) => b.status === 'FINALIZED').length,
        });
      } else {
        setError(result.error || 'Failed to load batches');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, currentPage, pageSize, filterYear, filterStatus]);

  // Effects
  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push('/admin/auth/login');
    }
  }, [session, sessionLoading, router]);

  useEffect(() => {
    if (session) {
      fetchBatches();
    }
  }, [session, fetchBatches]);

  // Action handlers
  const handleAction = (batch: PayrollBatch, action: 'freeze' | 'process' | 'finalize') => {
    setSelectedBatch(batch);
    setActionType(action);
    setIsModalOpen(true);
  };

  const executeAction = async () => {
    if (!session?.access_token || !selectedBatch || !actionType) return;

    setActionLoading(true);

    try {
      let configId = '';
      const params: Record<string, any> = { batch_id: selectedBatch.id };

      switch (actionType) {
        case 'freeze':
          configId = TPS_GATEWAY_CONFIGS.FREEZE_PERIOD;
          break;
        case 'process':
          configId = TPS_GATEWAY_CONFIGS.PROCESS_BATCH;
          break;
        case 'finalize':
          configId = TPS_GATEWAY_CONFIGS.FINALIZE_PERIOD;
          break;
      }

      const result = await callPgFunction(configId, params, session.access_token);

      if (result.success) {
        setIsModalOpen(false);
        setSelectedBatch(null);
        setActionType(null);
        fetchBatches();
      } else {
        setError(result.error || `Failed to ${actionType} batch`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getAvailableActions = (batch: PayrollBatch) => {
    const actions: { action: 'freeze' | 'process' | 'finalize'; label: string; variant: 'primary' | 'secondary' | 'danger' }[] = [];

    switch (batch.status) {
      case 'OPEN':
        actions.push({ action: 'freeze', label: 'Freeze', variant: 'secondary' });
        break;
      case 'FROZEN':
        actions.push({ action: 'process', label: 'Process', variant: 'primary' });
        break;
      case 'PROCESSED':
        actions.push({ action: 'finalize', label: 'Finalize', variant: 'primary' });
        break;
    }

    return actions;
  };

  // Table columns
  const columns: Column<PayrollBatch>[] = [
    {
      key: 'batch_code',
      header: 'Batch',
      render: (value, row) => (
        <div>
          <p className="font-medium text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{formatMonthYear(row.period_month, row.period_year)}</p>
        </div>
      ),
    },
    {
      key: 'period_start',
      header: 'Period',
      width: '180px',
      render: (_, row) => (
        <span className="text-sm">
          {formatDate(row.period_start)} - {formatDate(row.period_end)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      align: 'center',
      render: (value) => <BatchStatusBadge status={value} />,
    },
    {
      key: 'total_employees',
      header: 'Employees',
      width: '100px',
      align: 'center',
      render: (value) => <span className="font-medium">{value}</span>,
    },
    {
      key: 'total_present_days',
      header: 'Present',
      width: '90px',
      align: 'center',
      render: (value) => <span className="text-green-600">{value}</span>,
    },
    {
      key: 'total_absent_days',
      header: 'Absent',
      width: '80px',
      align: 'center',
      render: (value) => <span className="text-red-600">{value}</span>,
    },
    {
      key: 'total_leave_days',
      header: 'Leave',
      width: '80px',
      align: 'center',
      render: (value) => <span className="text-blue-600">{value}</span>,
    },
    {
      key: 'total_overtime_hours',
      header: 'OT Hours',
      width: '90px',
      align: 'center',
      render: (value) => <span className="text-orange-600">{value || 0}</span>,
    },
    {
      key: 'id',
      header: 'Actions',
      width: '200px',
      align: 'center',
      render: (_, row) => {
        const actions = getAvailableActions(row);
        return (
          <div className="flex gap-2 justify-center">
            <Button
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/admin/payroll/batches/${row.id}`);
              }}
            >
              View
            </Button>
            {actions.map((act) => (
              <Button
                key={act.action}
                variant={act.variant as any}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction(row, act.action);
                }}
              >
                {act.label}
              </Button>
            ))}
          </div>
        );
      },
    },
  ];

  // Render
  if (sessionLoading || loading) {
    return <LoadingState message="Loading payroll batches..." />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Payroll Batches</h1>
              <p className="text-gray-600 mt-1">Manage monthly payroll processing batches</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => router.back()}>
                Back
              </Button>
              <Button onClick={() => router.push('/admin/payroll/batches/create')}>
                + Create Batch
              </Button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-4 rounded-lg border border-gray-200"
              >
                <div className="text-2xl font-bold text-gray-900">{stats.total_batches}</div>
                <div className="text-sm text-gray-500">Total Batches</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-blue-50 p-4 rounded-lg border border-blue-200"
              >
                <div className="text-2xl font-bold text-blue-700">{stats.open_batches}</div>
                <div className="text-sm text-blue-600">Open</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-cyan-50 p-4 rounded-lg border border-cyan-200"
              >
                <div className="text-2xl font-bold text-cyan-700">{stats.frozen_batches}</div>
                <div className="text-sm text-cyan-600">Frozen</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-green-50 p-4 rounded-lg border border-green-200"
              >
                <div className="text-2xl font-bold text-green-700">{stats.processed_batches}</div>
                <div className="text-sm text-green-600">Processed</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-purple-50 p-4 rounded-lg border border-purple-200"
              >
                <div className="text-2xl font-bold text-purple-700">{stats.finalized_batches}</div>
                <div className="text-sm text-purple-600">Finalized</div>
              </motion.div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Year:</label>
                <select
                  value={filterYear}
                  onChange={(e) => {
                    setFilterYear(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[currentYear, currentYear - 1, currentYear - 2].map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Status:</label>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Statuses</option>
                  {Object.entries(TPS_BATCH_STATUS).map(([key, value]) => (
                    <option key={key} value={value}>{key}</option>
                  ))}
                </select>
              </div>

              <Button variant="secondary" onClick={fetchBatches}>
                Refresh
              </Button>
            </div>
          </div>

          {/* Batches Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <DataTable
              data={batches}
              columns={columns}
              loading={loading}
              emptyMessage="No payroll batches found"
              emptyDescription="Create a new batch to start payroll processing"
              rowKey="id"
              striped
              hoverable
            />

            {totalCount > pageSize && (
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(totalCount / pageSize)}
                totalItems={totalCount}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              />
            )}
          </div>

          {/* Workflow Info */}
          <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-3">Batch Processing Workflow</h3>
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">OPEN</span>
              <span className="text-gray-400">&rarr;</span>
              <span className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full">FROZEN</span>
              <span className="text-gray-400">&rarr;</span>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full">PROCESSING</span>
              <span className="text-gray-400">&rarr;</span>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full">PROCESSED</span>
              <span className="text-gray-400">&rarr;</span>
              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full">FINALIZED</span>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Freeze the batch to lock attendance data, then process to calculate summaries, and finally finalize for payroll export.
            </p>
          </div>
        </div>

        {/* Action Confirmation Modal */}
        {isModalOpen && selectedBatch && actionType && (
          <Modal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setSelectedBatch(null);
              setActionType(null);
            }}
            title={`${actionType.charAt(0).toUpperCase() + actionType.slice(1)} Batch`}
          >
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to <strong>{actionType}</strong> the batch{' '}
                <strong>{selectedBatch.batch_code}</strong>?
              </p>

              {actionType === 'freeze' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-700">
                  <strong>Warning:</strong> Once frozen, attendance data for this period cannot be modified.
                  Make sure all regularization requests have been processed.
                </div>
              )}

              {actionType === 'process' && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700">
                  <strong>Info:</strong> This will calculate attendance summaries for all employees
                  in this batch. The process may take a few minutes.
                </div>
              )}

              {actionType === 'finalize' && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                  <strong>Warning:</strong> Finalizing the batch is irreversible. This will lock
                  all data and make it ready for payroll export.
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedBatch(null);
                    setActionType(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={executeAction}
                  isLoading={actionLoading}
                  variant={actionType === 'finalize' ? 'danger' : 'primary'}
                >
                  Confirm {actionType.charAt(0).toUpperCase() + actionType.slice(1)}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </ErrorBoundary>
  );
}
