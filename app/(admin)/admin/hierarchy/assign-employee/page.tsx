'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/Modal';
import { DataTable, Pagination, Column } from '@/components/ui/DataTable';
import { LoadingState, ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { callPgFunction } from '@/lib/useGateway';
import { HMS_GATEWAY_CONFIGS, PAGINATION } from '@/lib/constants';

// --- Types ---

interface HierarchyPosition {
  id: number;
  position_name: string;
  position_status?: string;
  department_name?: string;
  designation_name?: string;
  first_name?: string;
  last_name?: string;
  emp_code?: string;
  user_id?: string;
  reporting_position_id?: number;
  hierarchy_level?: number;
  total_subordinates?: number;
  direct_reports?: number;
  [key: string]: any;
}

// --- Helpers ---

function getFullName(row: HierarchyPosition): string | null {
  const first = row.first_name?.trim();
  const last = row.last_name?.trim();
  if (!first && !last) return null;
  return [first, last].filter(Boolean).join(' ');
}

function isVacantPosition(row: HierarchyPosition): boolean {
  // A position is vacant if it has no emp_code assigned in the view
  return !row.emp_code;
}

// --- Main Component ---

export default function AssignEmployeePage() {
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const router = useRouter();

  // Data State
  const [data, setData] = useState<HierarchyPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGINATION.DEFAULT_PAGE_SIZE);
  const [totalRecords, setTotalRecords] = useState(0);
  
  // Filter State
  const [filterVacant, setFilterVacant] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Assign Modal State
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<HierarchyPosition | null>(null);
  const [empCodeInput, setEmpCodeInput] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  // --- Fetch Positions ---
  const fetchPositions = useCallback(async () => {
    if (!session?.access_token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Using the dynamic hierarchy view to get positions + current occupants
      const result = await callPgFunction(
        HMS_GATEWAY_CONFIGS.DYNAMIC_HIERARCHY_VIEW,
        { 
            page_number: currentPage, 
            page_size: pageSize 
            // Add search params here if your backend view supports filtering by name/code
        },
        session.access_token
      );

      if (result.success) {
        // Universal Gateway v3 typically returns { details: { data: [], total_records: N } }
        // OR sometimes direct data depending on config. Handling both:
        const details = result.data?.details || result.data || {};
        const rows = Array.isArray(details.data) ? details.data : (Array.isArray(details) ? details : []);
        
        setData(rows);
        setTotalRecords(details.total_records || rows.length);
      } else {
        throw new Error(result.error || result.message || 'Failed to fetch positions');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while fetching positions.');
    } finally {
      setLoading(false);
    }
  }, [session, currentPage, pageSize]);

  // Auth Check & Initial Fetch
  useEffect(() => {
    if (!isSessionLoading && !session) router.push('/admin/auth/login');
    if (session) fetchPositions();
  }, [session, isSessionLoading, router, fetchPositions]);

  // --- Handlers ---

  const handleOpenAssign = (position: HierarchyPosition) => {
    setAssignTarget(position);
    setEmpCodeInput('');
    setAssignError(null);
    setAssignSuccess(null);
    setIsAssignOpen(true);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !assignTarget || !empCodeInput.trim()) return;

    setAssignLoading(true);
    setAssignError(null);
    setAssignSuccess(null);

    try {
      const result = await callPgFunction(
        HMS_GATEWAY_CONFIGS.ASSIGN_EMPLOYEE,
        { 
          // CORRECTED PAYLOAD: Matches the updated SQL function signature
          position_id: assignTarget.id, 
          target_emp_code: empCodeInput.trim() 
        },
        session.access_token
      );

      if (!result.success) {
        throw new Error(result.error || result.message || 'Failed to assign employee.');
      }

      setAssignSuccess(`Successfully assigned ${empCodeInput} to ${assignTarget.position_name}`);
      
      // Close modal after short delay to show success message
      setTimeout(() => {
        setIsAssignOpen(false);
        fetchPositions(); // Refresh grid
      }, 1500);

    } catch (err: any) {
      setAssignError(err.message);
    } finally {
      setAssignLoading(false);
    }
  };

  // --- Filtering Logic (Client Side for responsiveness on small datasets) ---
  const filteredData = data.filter(item => {
    // 1. Vacant Filter
    if (filterVacant && !isVacantPosition(item)) return false;
    
    // 2. Search Filter (Position Name or Current Occupant Name/Code)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const posName = (item.position_name || '').toLowerCase();
      const empName = (getFullName(item) || '').toLowerCase();
      const empCode = (item.emp_code || '').toLowerCase();
      
      return posName.includes(term) || empName.includes(term) || empCode.includes(term);
    }
    
    return true;
  });

  // --- Columns Configuration ---
  const columns: Column<HierarchyPosition>[] = [
    { 
      key: 'position_name', 
      header: 'Position Title', 
      sortable: true,
      render: (val, row) => (
        <div>
          <span className="font-medium text-gray-900">{val}</span>
          <div className="text-xs text-gray-500">ID: {row.id}</div>
        </div>
      )
    },
    { key: 'department_name', header: 'Department', render: (v) => v || '-' },
    { key: 'designation_name', header: 'Designation', render: (v) => v || '-' },
    {
      key: 'emp_code', 
      header: 'Current Occupant',
      render: (_, row) => {
        const name = getFullName(row);
        if (name || row.emp_code) {
          return (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                {name ? name.charAt(0) : '?'}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{name || 'Unknown'}</p>
                <p className="text-xs text-gray-500">{row.emp_code}</p>
              </div>
            </div>
          );
        }
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Vacant</span>;
      },
    },
    { 
      key: 'position_status', 
      header: 'Status', 
      render: (v) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${v === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
          {v || '-'}
        </span>
      ) 
    },
    {
      key: 'actions', 
      header: 'Actions', 
      align: 'right',
      render: (_, row) => {
        const isVacant = isVacantPosition(row);
        return (
          <div className="flex justify-end gap-2">
            <Button 
              size="sm" 
              variant={isVacant ? 'primary' : 'secondary'}
              onClick={() => handleOpenAssign(row)}
            >
              {isVacant ? 'Assign' : 'Reassign'}
            </Button>
          </div>
        );
      },
    },
  ];

  if (isSessionLoading) return <LoadingState message="Initializing session..." />;

  return (
    <ErrorBoundary>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Assign Employees</h1>
              <p className="text-gray-600 mt-1">Map employees to positions to build the reporting hierarchy.</p>
            </div>
            <Button variant="secondary" onClick={fetchPositions}>Refresh List</Button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex justify-between items-center">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-sm font-bold">Dismiss</button>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
            
            {/* Filters Bar */}
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Search positions or employees..." 
                      className="pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-64"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                 </div>
                 <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterVacant}
                      onChange={(e) => setFilterVacant(e.target.checked)}
                      className="h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                    />
                    Show only vacant positions
                 </label>
              </div>
            </div>

            {/* Table */}
            <div className="p-0">
              <DataTable
                data={filteredData}
                columns={columns}
                loading={loading}
                rowKey="id"
                emptyMessage="No positions found matching your criteria."
              />
              
              {/* Pagination (server-side driven) */}
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(totalRecords / pageSize)}
                totalItems={totalRecords}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Assign Employee Modal */}
      {isAssignOpen && assignTarget && (
        <Modal isOpen={isAssignOpen} onClose={() => setIsAssignOpen(false)} title={isVacantPosition(assignTarget) ? "Assign Employee" : "Reassign Position"}>
          <form onSubmit={handleAssign} className="space-y-4">
            
            {/* Context Card */}
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-blue-500 uppercase font-bold tracking-wider">Target Position</p>
                  <p className="text-lg font-bold text-blue-900">{assignTarget.position_name}</p>
                  <p className="text-sm text-blue-700">{assignTarget.department_name} • {assignTarget.designation_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-blue-500 uppercase font-bold tracking-wider">ID</p>
                  <p className="text-sm font-mono text-blue-900">#{assignTarget.id}</p>
                </div>
              </div>

              {!isVacantPosition(assignTarget) && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                   <p className="text-xs text-amber-600 font-bold uppercase tracking-wider flex items-center gap-1">
                     <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                     Warning: Currently Occupied
                   </p>
                   <p className="text-sm text-amber-800 mt-1">
                     Assigned to: <strong>{getFullName(assignTarget)} ({assignTarget.emp_code})</strong>. 
                     Assigning a new employee will automatically remove the current occupant.
                   </p>
                </div>
              )}
            </div>

            {/* Input Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee Code *</label>
              <Input
                value={empCodeInput}
                onChange={(e) => setEmpCodeInput(e.target.value)}
                placeholder="Enter employee code (e.g. EMP001)"
                autoFocus
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the exact Employee Code of the person you want to assign to this position.
              </p>
            </div>

            {/* Feedback Messages */}
            {assignError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                <strong>Error:</strong> {assignError}
              </div>
            )}
            
            {assignSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm font-medium">
                {assignSuccess}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="secondary" onClick={() => setIsAssignOpen(false)} disabled={assignLoading}>
                Cancel
              </Button>
              <Button type="submit" isLoading={assignLoading} disabled={!empCodeInput.trim() || assignLoading}>
                {isVacantPosition(assignTarget) ? 'Confirm Assignment' : 'Confirm Reassignment'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </ErrorBoundary>
  );
}