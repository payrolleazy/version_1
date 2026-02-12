'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import { DataTable, Column } from '@/components/ui/DataTable';
import { LoadingState, ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { callPgFunction } from '@/lib/useGateway';
import { HMS_GATEWAY_CONFIGS } from '@/lib/constants';

interface SearchResult {
  id: number;
  position_name: string;
  employee_name?: string;
  emp_code?: string;
  [key: string]: any;
}

interface HistoryRecord {
  id?: number;
  employee_name?: string;
  full_name?: string;
  emp_code?: string;
  start_date?: string;
  end_date?: string;
  assignment_type?: string;
  [key: string]: any;
}

export default function PositionHistoryPage() {
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<SearchResult | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!session?.access_token || !searchQuery.trim()) return;
    setSearchLoading(true);
    setError(null);
    try {
      const result = await callPgFunction(
        HMS_GATEWAY_CONFIGS.SEARCH_POSITIONS,
        { search_query: searchQuery.trim() },
        session.access_token
      );
      if (result.success) {
        setSearchResults(result.data?.data || result.data || []);
      } else {
        throw new Error(result.error || 'Search failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSearchLoading(false);
    }
  }, [session, searchQuery]);

  const fetchHistory = useCallback(async (positionId: number) => {
    if (!session?.access_token) return;
    setHistoryLoading(true);
    setError(null);
    try {
      const result = await callPgFunction(
        HMS_GATEWAY_CONFIGS.POSITION_HISTORY,
        { position_id: positionId },
        session.access_token
      );
      if (result.success) {
        const historyData = result.data?.data || result.data || [];
        setHistory(Array.isArray(historyData) ? historyData : []);
      } else {
        throw new Error(result.error || 'Failed to fetch position history');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  }, [session]);

  const handleSelectPosition = (position: SearchResult) => {
    setSelectedPosition(position);
    setSearchResults([]);
    fetchHistory(position.id);
  };

  useEffect(() => {
    if (!isSessionLoading && !session) router.push('/admin/auth/login');
  }, [session, isSessionLoading, router]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => handleSearch(), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const columns: Column<HistoryRecord>[] = [
    {
      key: 'emp_code', header: 'Employee',
      render: (_, row) => {
        const name = row.employee_name || row.full_name;
        return name ? (
          <span>{name} {row.emp_code && <span className="text-gray-400">({row.emp_code})</span>}</span>
        ) : '-';
      },
    },
    {
      key: 'start_date', header: 'Start Date',
      render: (v) => v ? new Date(v).toLocaleDateString() : '-',
    },
    {
      key: 'end_date', header: 'End Date',
      render: (v) => v ? new Date(v).toLocaleDateString() : <span className="text-green-600 text-xs">Current</span>,
    },
    { key: 'assignment_type', header: 'Type', render: (v) => v || '-' },
  ];

  if (isSessionLoading) return <LoadingState message="Initializing session..." />;

  return (
    <ErrorBoundary>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Position History</h1>
            <p className="text-gray-600 mt-1">View the occupancy history for any position.</p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>
          )}

          {/* Search Section */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Position</label>
            <div className="relative">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by position name, employee name, or code..."
              />
              {searchLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelectPosition(result)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left border-b last:border-b-0 transition-colors"
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-600">#{result.id}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{result.position_name}</p>
                      {result.employee_name && (
                        <p className="text-xs text-gray-500">
                          {result.employee_name} {result.emp_code && `(${result.emp_code})`}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* History Table */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            {selectedPosition && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  Showing history for: <strong>{selectedPosition.position_name}</strong> (#{selectedPosition.id})
                </p>
              </div>
            )}

            {historyLoading ? (
              <LoadingState message="Loading position history..." />
            ) : selectedPosition ? (
              <DataTable
                data={history}
                columns={columns}
                loading={false}
                rowKey="id"
                emptyMessage="No history records found for this position."
              />
            ) : (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>Search for a position above to view its occupancy history.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
