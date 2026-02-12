'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import { DataTable, Pagination, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ErrorBoundary, LoadingState } from '@/components/ui/ErrorBoundary';
import { LMS_GATEWAY_CONFIGS, API_ENDPOINTS, PAGINATION } from '@/lib/constants';
import { callPgFunction, callReadGateway } from '@/lib/useGateway';
import { formatDate, formatDays, formatMonthYear, getPayrollPeriodsForYear } from '@/lib/dateUtils';

// ============================================================================
// Types
// ============================================================================
interface LedgerEntry {
  id: number;
  policy_id: number;
  transaction_type: string;
  transaction_code: string;
  amount: number;
  balance_before: number | null;
  balance_after: number | null;
  effective_date: string;
  notes: string | null;
  leave_request_id: number | null;
  system_generated: boolean;
  created_at: string;
}

interface LeaveType {
  leave_type_id: number;
  leave_type_code: string;
  leave_type_name: string;
  policy_id: number;
  policy_name: string;
  current_balance: number;
  total_accrued: number;
  total_used: number;
}

// ============================================================================
// Transaction Type Colors
// ============================================================================
const TRANSACTION_COLORS: Record<string, { bg: string; text: string }> = {
  ACCRUAL: { bg: 'bg-green-100', text: 'text-green-700' },
  CREDIT_OPENING: { bg: 'bg-blue-100', text: 'text-blue-700' },
  CREDIT_ADJUSTMENT: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  CREDIT_REVERSAL: { bg: 'bg-purple-100', text: 'text-purple-700' },
  CREDIT_CARRY_FORWARD: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  DEBIT_REQUEST: { bg: 'bg-red-100', text: 'text-red-700' },
  DEBIT_ADJUSTMENT: { bg: 'bg-orange-100', text: 'text-orange-700' },
  DEBIT_EXPIRY: { bg: 'bg-gray-100', text: 'text-gray-700' },
  ENCASHMENT: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
};

function getTransactionColor(type: string) {
  return TRANSACTION_COLORS[type] || { bg: 'bg-gray-100', text: 'text-gray-700' };
}

function formatTransactionType(type: string): string {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================================
// Main Component
// ============================================================================
export default function LeaveLedgerPage() {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const router = useRouter();

  // State
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [selectedLeaveType, setSelectedLeaveType] = useState<number | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGINATION.DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Fetch leave balance summary
  const fetchLeaveTypes = useCallback(async () => {
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);

    try {
      const result = await callPgFunction<{ data: LeaveType[] }>(
        LMS_GATEWAY_CONFIGS.GET_BALANCE_SUMMARY,
        {},
        session.access_token
      );

      if (result.success && result.data) {
        const types = Array.isArray(result.data) ? result.data : result.data.data || [];
        setLeaveTypes(types);

        // Auto-select first leave type
        if (types.length > 0 && !selectedLeaveType) {
          setSelectedLeaveType(types[0].policy_id);
        }
      } else {
        setError(result.error || 'Failed to load leave types');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, selectedLeaveType]);

  // Fetch ledger entries
  const fetchLedgerEntries = useCallback(async () => {
    if (!session?.access_token || !selectedLeaveType) return;

    setLedgerLoading(true);

    try {
      const result = await callReadGateway<LedgerEntry[]>(
        'lms-read-my-leave-ledger',
        {
          filters: { policy_id: selectedLeaveType },
          orderBy: [['effective_date', 'DESC'], ['created_at', 'DESC']],
          limit: pageSize,
          offset: (currentPage - 1) * pageSize,
        },
        session.access_token
      );

      if (result.success && result.data) {
        const entries = Array.isArray(result.data) ? result.data : [];
        setLedgerEntries(entries);
        // Assuming the API returns total count, otherwise we'd need a separate count query
        setTotalCount(entries.length >= pageSize ? entries.length + 1 : entries.length);
      }
    } catch (err: any) {
      console.error('Failed to load ledger:', err);
    } finally {
      setLedgerLoading(false);
    }
  }, [session?.access_token, selectedLeaveType, currentPage, pageSize]);

  // Effects
  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push('/employee/auth/login');
    }
  }, [session, sessionLoading, router]);

  useEffect(() => {
    fetchLeaveTypes();
  }, [fetchLeaveTypes]);

  useEffect(() => {
    if (selectedLeaveType) {
      fetchLedgerEntries();
    }
  }, [selectedLeaveType, fetchLedgerEntries]);

  // Get selected leave type details
  const selectedType = leaveTypes.find((t) => t.policy_id === selectedLeaveType);

  // Table columns
  const columns: Column<LedgerEntry>[] = [
    {
      key: 'effective_date',
      header: 'Date',
      width: '120px',
      render: (value) => formatDate(value),
    },
    {
      key: 'transaction_type',
      header: 'Transaction Type',
      width: '180px',
      render: (value) => {
        const colors = getTransactionColor(value);
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
            {formatTransactionType(value)}
          </span>
        );
      },
    },
    {
      key: 'amount',
      header: 'Days',
      width: '100px',
      align: 'right',
      render: (value) => (
        <span className={`font-medium ${value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-gray-600'}`}>
          {value > 0 ? '+' : ''}{value}
        </span>
      ),
    },
    {
      key: 'balance_after',
      header: 'Balance',
      width: '100px',
      align: 'right',
      render: (value) => (
        <span className="font-semibold text-gray-900">
          {value !== null ? value : '-'}
        </span>
      ),
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (value, row) => (
        <div className="max-w-xs">
          <p className="text-sm text-gray-700 truncate">{value || '-'}</p>
          {row.system_generated && (
            <span className="text-xs text-gray-400">System generated</span>
          )}
        </div>
      ),
    },
    {
      key: 'transaction_code',
      header: 'Reference',
      width: '150px',
      render: (value) => (
        <span className="text-xs font-mono text-gray-500">{value}</span>
      ),
    },
  ];

  // Render
  if (sessionLoading || loading) {
    return <LoadingState message="Loading leave ledger..." />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Leave Balance Ledger</h1>
              <p className="text-gray-600 mt-1">View your complete leave balance transaction history</p>
            </div>
            <Button variant="secondary" onClick={() => router.back()}>
              Back
            </Button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Leave Type Selector and Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
            {/* Leave Type Cards */}
            <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {leaveTypes.map((type) => (
                <motion.div
                  key={type.policy_id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectedLeaveType(type.policy_id);
                    setCurrentPage(1);
                  }}
                  className={`
                    p-4 rounded-lg border-2 cursor-pointer transition-all
                    ${selectedLeaveType === type.policy_id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                    }
                  `}
                >
                  <h3 className="font-medium text-gray-900 text-sm">{type.leave_type_name}</h3>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-gray-900">{type.current_balance}</span>
                    <span className="text-sm text-gray-500 ml-1">days</span>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-gray-500">
                    <span>+{type.total_accrued} accrued</span>
                    <span>-{type.total_used} used</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Summary Card */}
            {selectedType && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-4">{selectedType.leave_type_name}</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Current Balance</span>
                    <span className="font-bold text-gray-900">{selectedType.current_balance} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Accrued</span>
                    <span className="text-green-600">+{selectedType.total_accrued} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Used</span>
                    <span className="text-red-600">-{selectedType.total_used} days</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Ledger Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Transaction History</h2>
              <div className="flex items-center gap-4">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[currentYear, currentYear - 1, currentYear - 2].map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            <DataTable
              data={ledgerEntries}
              columns={columns}
              loading={ledgerLoading}
              emptyMessage="No transactions found"
              emptyDescription="Your leave balance transactions will appear here"
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

          {/* Legend */}
          <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-3">Transaction Types</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(TRANSACTION_COLORS).map(([type, colors]) => (
                <span key={type} className={`px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                  {formatTransactionType(type)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
