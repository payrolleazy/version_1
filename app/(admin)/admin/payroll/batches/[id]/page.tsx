'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import { DataTable, Pagination, Column } from '@/components/ui/DataTable';
import { ErrorBoundary, LoadingState } from '@/components/ui/ErrorBoundary';
import { BatchStatusBadge } from '@/components/ui/StatusBadge';
import { TPS_GATEWAY_CONFIGS, PAGINATION } from '@/lib/constants';
import { callReadGateway, callPgFunction } from '@/lib/useGateway';
import { formatDate, formatMonthYear, formatDuration } from '@/lib/dateUtils';

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
}

interface EmployeeSummary {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  department_name: string | null;
  designation_name: string | null;
  work_days: number;
  present_days: number;
  absent_days: number;
  leave_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  late_instances: number;
  early_departure_instances: number;
  total_work_hours: number;
  overtime_hours: number;
  late_deduction_amount: number;
  early_departure_deduction_amount: number;
  effective_days: number;
  loss_of_pay_days: number;
}

// ============================================================================
// Main Component
// ============================================================================
export default function BatchDetailPage() {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const router = useRouter();
  const params = useParams();
  const batchId = params.id as string;

  // State
  const [batch, setBatch] = useState<PayrollBatch | null>(null);
  const [summaries, setSummaries] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGINATION.DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch batch details
  const fetchBatch = useCallback(async () => {
    if (!session?.access_token || !batchId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await callReadGateway<PayrollBatch[]>(
        TPS_GATEWAY_CONFIGS.READ_BATCHES,
        { filters: { id: batchId } },
        session.access_token
      );

      if (result.success && result.data) {
        const data = Array.isArray(result.data) ? result.data[0] : result.data;
        setBatch(data || null);
      } else {
        setError(result.error || 'Failed to load batch details');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, batchId]);

  // Fetch employee summaries
  const fetchSummaries = useCallback(async () => {
    if (!session?.access_token || !batchId) return;

    setSummaryLoading(true);

    try {
      const filters: Record<string, any> = { batch_id: batchId };
      if (searchTerm) {
        filters.search = searchTerm;
      }

      const result = await callReadGateway<EmployeeSummary[]>(
        TPS_GATEWAY_CONFIGS.READ_EMPLOYEE_SUMMARY,
        {
          filters,
          orderBy: [['employee_name', 'ASC']],
          limit: pageSize,
          offset: (currentPage - 1) * pageSize,
        },
        session.access_token
      );

      if (result.success && result.data) {
        const data = Array.isArray(result.data) ? result.data : [];
        setSummaries(data);
        setTotalCount(data.length >= pageSize ? data.length + 1 : data.length);
      }
    } catch (err: any) {
      console.error('Failed to fetch summaries:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, [session?.access_token, batchId, currentPage, pageSize, searchTerm]);

  // Recalculate summary for single employee
  const recalculateEmployee = async (employeeId: string) => {
    if (!session?.access_token || !batchId) return;

    try {
      const result = await callPgFunction(
        TPS_GATEWAY_CONFIGS.CALCULATE_SUMMARY,
        { batch_id: batchId, employee_id: employeeId },
        session.access_token
      );

      if (result.success) {
        fetchSummaries();
      } else {
        alert(result.error || 'Failed to recalculate');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (summaries.length === 0) return;

    const headers = [
      'Employee Code',
      'Employee Name',
      'Department',
      'Work Days',
      'Present',
      'Absent',
      'Leave',
      'Paid Leave',
      'Unpaid Leave',
      'Late',
      'Early Out',
      'Work Hours',
      'Overtime',
      'LOP Days',
      'Effective Days',
    ];

    const rows = summaries.map((s) => [
      s.employee_code,
      s.employee_name,
      s.department_name || '-',
      s.work_days,
      s.present_days,
      s.absent_days,
      s.leave_days,
      s.paid_leave_days,
      s.unpaid_leave_days,
      s.late_instances,
      s.early_departure_instances,
      s.total_work_hours,
      s.overtime_hours,
      s.loss_of_pay_days,
      s.effective_days,
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_summary_${batch?.batch_code || batchId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Effects
  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push('/admin/auth/login');
    }
  }, [session, sessionLoading, router]);

  useEffect(() => {
    if (session && batchId) {
      fetchBatch();
    }
  }, [session, batchId, fetchBatch]);

  useEffect(() => {
    if (session && batchId) {
      fetchSummaries();
    }
  }, [session, batchId, fetchSummaries]);

  // Table columns
  const columns: Column<EmployeeSummary>[] = [
    {
      key: 'employee_name',
      header: 'Employee',
      render: (value, row) => (
        <div>
          <p className="font-medium text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{row.employee_code}</p>
        </div>
      ),
    },
    {
      key: 'department_name',
      header: 'Department',
      render: (value) => <span className="text-sm text-gray-600">{value || '-'}</span>,
    },
    {
      key: 'work_days',
      header: 'Work Days',
      width: '90px',
      align: 'center',
      render: (value) => <span className="font-medium">{value}</span>,
    },
    {
      key: 'present_days',
      header: 'Present',
      width: '80px',
      align: 'center',
      render: (value) => <span className="text-green-600 font-medium">{value}</span>,
    },
    {
      key: 'absent_days',
      header: 'Absent',
      width: '70px',
      align: 'center',
      render: (value) => (
        <span className={`font-medium ${value > 0 ? 'text-red-600' : 'text-gray-400'}`}>{value}</span>
      ),
    },
    {
      key: 'leave_days',
      header: 'Leave',
      width: '70px',
      align: 'center',
      render: (value, row) => (
        <div className="text-center">
          <span className="text-blue-600 font-medium">{value}</span>
          {row.unpaid_leave_days > 0 && (
            <p className="text-xs text-red-500">({row.unpaid_leave_days} unpaid)</p>
          )}
        </div>
      ),
    },
    {
      key: 'late_instances',
      header: 'Late',
      width: '60px',
      align: 'center',
      render: (value) => (
        <span className={`font-medium ${value > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>{value}</span>
      ),
    },
    {
      key: 'early_departure_instances',
      header: 'Early',
      width: '60px',
      align: 'center',
      render: (value) => (
        <span className={`font-medium ${value > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{value}</span>
      ),
    },
    {
      key: 'overtime_hours',
      header: 'OT Hrs',
      width: '70px',
      align: 'center',
      render: (value) => (
        <span className={`font-medium ${value > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
          {value?.toFixed(1) || 0}
        </span>
      ),
    },
    {
      key: 'loss_of_pay_days',
      header: 'LOP',
      width: '60px',
      align: 'center',
      render: (value) => (
        <span className={`font-medium ${value > 0 ? 'text-red-600' : 'text-gray-400'}`}>{value}</span>
      ),
    },
    {
      key: 'effective_days',
      header: 'Effective',
      width: '80px',
      align: 'center',
      render: (value) => <span className="font-bold text-gray-900">{value}</span>,
    },
    {
      key: 'id',
      header: '',
      width: '100px',
      align: 'center',
      render: (_, row) =>
        batch?.status === 'FROZEN' ? (
          <Button
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              recalculateEmployee(row.employee_id);
            }}
          >
            Recalc
          </Button>
        ) : null,
    },
  ];

  // Render
  if (sessionLoading || loading) {
    return <LoadingState message="Loading batch details..." />;
  }

  if (!batch) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Batch not found</p>
          <Button variant="secondary" onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{batch.batch_code}</h1>
                <BatchStatusBadge status={batch.status} />
              </div>
              <p className="text-gray-600 mt-1">
                {formatMonthYear(batch.period_month, batch.period_year)} &bull;{' '}
                {formatDate(batch.period_start)} to {formatDate(batch.period_end)}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => router.push('/admin/payroll/batches')}>
                Back to List
              </Button>
              <Button variant="secondary" onClick={exportToCSV} disabled={summaries.length === 0}>
                Export CSV
              </Button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Batch Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-4 rounded-lg border border-gray-200 text-center"
            >
              <div className="text-2xl font-bold text-gray-900">{batch.total_employees}</div>
              <div className="text-xs text-gray-500">Employees</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white p-4 rounded-lg border border-gray-200 text-center"
            >
              <div className="text-2xl font-bold text-gray-900">{batch.total_work_days}</div>
              <div className="text-xs text-gray-500">Work Days</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-green-50 p-4 rounded-lg border border-green-200 text-center"
            >
              <div className="text-2xl font-bold text-green-700">{batch.total_present_days}</div>
              <div className="text-xs text-green-600">Present</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-red-50 p-4 rounded-lg border border-red-200 text-center"
            >
              <div className="text-2xl font-bold text-red-700">{batch.total_absent_days}</div>
              <div className="text-xs text-red-600">Absent</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-center"
            >
              <div className="text-2xl font-bold text-blue-700">{batch.total_leave_days}</div>
              <div className="text-xs text-blue-600">Leave</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-orange-50 p-4 rounded-lg border border-orange-200 text-center"
            >
              <div className="text-2xl font-bold text-orange-700">{batch.total_overtime_hours}</div>
              <div className="text-xs text-orange-600">OT Hours</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-center"
            >
              <div className="text-2xl font-bold text-yellow-700">{batch.total_late_instances}</div>
              <div className="text-xs text-yellow-600">Late Instances</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-purple-50 p-4 rounded-lg border border-purple-200 text-center"
            >
              <div className="text-2xl font-bold text-purple-700">
                {((batch.total_present_days / (batch.total_work_days || 1)) * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-purple-600">Attendance %</div>
            </motion.div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by employee name or code..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <Button variant="secondary" onClick={fetchSummaries}>
                Refresh
              </Button>
            </div>
          </div>

          {/* Employee Summary Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Employee Attendance Summary</h2>
            </div>

            <DataTable
              data={summaries}
              columns={columns}
              loading={summaryLoading}
              emptyMessage="No employee summaries found"
              emptyDescription={
                batch.status === 'OPEN'
                  ? 'Freeze the batch to generate employee summaries'
                  : 'No data available for this batch'
              }
              rowKey="id"
              striped
              hoverable
              compact
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

          {/* Processing Info */}
          {batch.processing_started_at && (
            <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-3">Processing History</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Processing Started:</span>
                  <p className="font-medium">
                    {batch.processing_started_at ? formatDate(batch.processing_started_at) : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Processing Completed:</span>
                  <p className="font-medium">
                    {batch.processing_completed_at ? formatDate(batch.processing_completed_at) : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Finalized:</span>
                  <p className="font-medium">
                    {batch.finalized_at ? formatDate(batch.finalized_at) : '-'}
                  </p>
                </div>
              </div>
              {batch.notes && (
                <div className="mt-4 pt-4 border-t">
                  <span className="text-gray-500">Notes:</span>
                  <p className="text-gray-700 mt-1">{batch.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Column Legend */}
          <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-3">Column Legend</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
              <div><strong>Work Days:</strong> Total working days in period</div>
              <div><strong>Present:</strong> Days with attendance marked</div>
              <div><strong>Leave:</strong> Total leave days (paid + unpaid)</div>
              <div><strong>Late:</strong> Number of late arrivals</div>
              <div><strong>Early:</strong> Number of early departures</div>
              <div><strong>OT Hrs:</strong> Overtime hours worked</div>
              <div><strong>LOP:</strong> Loss of Pay days (absent + unpaid leave)</div>
              <div><strong>Effective:</strong> Days to be paid (Work - LOP)</div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
