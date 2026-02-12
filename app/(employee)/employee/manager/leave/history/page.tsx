'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { DataTable, Pagination, Column } from '@/components/ui/DataTable';
import { LeaveStatusBadge } from '@/components/ui/StatusBadge';
import { ErrorBoundary, LoadingState } from '@/components/ui/ErrorBoundary';
import { LMS_GATEWAY_CONFIGS, PAGINATION } from '@/lib/constants';
import { callPgFunction } from '@/lib/useGateway';
import { formatDate } from '@/lib/dateUtils';

// ============================================================================
// Types based on lms_leave_requests enriched for Managers [Source 79-82, 592]
// ============================================================================
interface TeamLeaveRequest {
  id: string;
  application_number: string;
  applicant_name: string;
  applicant_emp_code: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  leave_duration_days: number;
  status: string;
  reason: string;
  submitted_at: string;
}

export default function TeamLeaveHistoryPage() {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const router = useRouter();

  // Data State
  const [requests, setRequests] = useState<TeamLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Filters
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGINATION.DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchTeamHistory = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);

    try {
      // Config ID: 'lms-get-team-leave-requests' [Source 2728]
      const result = await callPgFunction(
        LMS_GATEWAY_CONFIGS.GET_TEAM_LEAVE_REQUESTS,
        { 
          page: currentPage, 
          page_size: pageSize,
          search: searchTerm 
        },
        session.access_token
      );

      if (result.success) {
        const data = result.data?.data || result.data || [];
        setRequests(Array.isArray(data) ? data : []);
        setTotalCount(data.length >= pageSize ? (currentPage * pageSize) + 1 : (currentPage - 1) * pageSize + data.length);
      } else {
        setError(result.error || 'Failed to load team records');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, currentPage, pageSize, searchTerm]);

  useEffect(() => {
    if (session) fetchTeamHistory();
  }, [session, fetchTeamHistory]);

  if (sessionLoading || loading) return <LoadingState message="Retrieving team leave archives..." />;

  const columns: Column<TeamLeaveRequest>[] = [
    { key: 'applicant_name', header: 'Employee', render: (v, row) => (
      <div>
        <p className="font-bold text-gray-900">{v}</p>
        <p className="text-xs text-gray-500">{row.applicant_emp_code}</p>
      </div>
    )},
    { key: 'leave_type_name', header: 'Type' },
    { key: 'start_date', header: 'Period', render: (_, row) => (
      <span className="text-sm font-medium">
        {formatDate(row.start_date)} - {formatDate(row.end_date)}
      </span>
    )},
    { key: 'leave_duration_days', header: 'Days', align: 'center' },
    { key: 'status', header: 'Status', render: (v) => <LeaveStatusBadge status={v} /> },
    { key: 'submitted_at', header: 'Submitted', render: (v) => formatDate(v) }
  ];

  return (
    <ErrorBoundary>
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Team Leave History</h1>
              <p className="text-gray-600">Review all processed leave applications for your team</p>
            </div>
            <div className="flex gap-3">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search name or code..."
                  className="pl-10 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-purple-500"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
                <svg className="w-4 h-4 absolute left-3 top-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <Button onClick={fetchTeamHistory} variant="secondary">Refresh</Button>
            </div>
          </div>

          {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>}

          {/* Records Table */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <DataTable 
              data={requests} 
              columns={columns} 
              rowKey="id"
              emptyMessage="No historical leave records found."
            />
            <Pagination 
              currentPage={currentPage}
              totalPages={Math.ceil(totalCount / pageSize)}
              totalItems={totalCount}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </motion.div>
        </div>
      </div>
    </ErrorBoundary>
  );
}