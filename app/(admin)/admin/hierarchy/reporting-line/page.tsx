'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { LoadingState, ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { callPgFunction } from '@/lib/useGateway';
import { HMS_GATEWAY_CONFIGS } from '@/lib/constants';
import ReportingLineChain, { ReportingLineNode } from '@/components/hierarchy/ReportingLineChain';

interface SearchResult {
  id: number;
  position_name: string;
  employee_name?: string;
  emp_code?: string;
  [key: string]: any;
}

export default function AdminReportingLinePage() {
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPositionId, setSelectedPositionId] = useState<number | null>(null);
  const [chain, setChain] = useState<ReportingLineNode[]>([]);
  const [chainLoading, setChainLoading] = useState(false);
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

  const fetchReportingLine = useCallback(async (positionId: number) => {
    if (!session?.access_token) return;
    setChainLoading(true);
    setError(null);
    try {
      const result = await callPgFunction(
        HMS_GATEWAY_CONFIGS.REPORTING_LINE,
        { position_id: positionId },
        session.access_token
      );
      if (result.success) {
        const lineData = result.data?.data || result.data || [];
        setChain(Array.isArray(lineData) ? lineData : []);
      } else {
        throw new Error(result.error || 'Failed to fetch reporting line');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setChainLoading(false);
    }
  }, [session]);

  const handleSelectPosition = (position: SearchResult) => {
    setSelectedPositionId(position.id);
    setSearchResults([]);
    fetchReportingLine(position.id);
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

  if (isSessionLoading) return <LoadingState message="Initializing session..." />;

  return (
    <ErrorBoundary>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Reporting Line Viewer</h1>
            <p className="text-gray-600 mt-1">Search for a position to view its reporting chain.</p>
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

          {/* Reporting Line Chain */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            {chainLoading ? (
              <LoadingState message="Loading reporting line..." />
            ) : selectedPositionId && chain.length > 0 ? (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Reporting Chain</h2>
                <ReportingLineChain chain={chain} currentPositionId={selectedPositionId} />
              </>
            ) : selectedPositionId ? (
              <div className="text-center py-12 text-gray-500">
                <p>No reporting line data found for this position.</p>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p>Search for a position above to view its reporting line.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
