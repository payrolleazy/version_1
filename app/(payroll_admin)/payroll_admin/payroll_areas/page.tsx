'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PayrollAreaViewModal from '@/components/PayrollAreaViewModal';
import PayrollAreaFormModal from '@/components/PayrollAreaFormModal'; // Import the form modal

interface PayrollArea {
  id: number;
  tenant_id: string;
  area_code: string;
  description: string | null;
  periodicity: string;
  currency_code: string;
  country_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

const READ_CONFIG_ID = '7ccbf45d-140c-4dde-939b-f82a222d93dc';
const UPSERT_CONFIG_ID = 'b7f91d1b-a1e6-43e2-81a9-c17432cdedb6';

export default function PayrollAreasPage() {
  const router = useRouter();
  const { session } = useSessionContext();
  const [payrollAreas, setPayrollAreas] = useState<PayrollArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [filterText, setFilterText] = useState('');
  const [filterColumn, setFilterColumn] = useState('area_code');
  const [sortColumn, setSortColumn] = useState('area_code');
  const [sortDirection, setSortDirection] = useState('ASC');
  
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false); // State for form modal
  const [viewingPayrollArea, setViewingPayrollArea] = useState<PayrollArea | null>(null);

  const fetchPayrollAreas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!session?.access_token) {
        throw new Error('Authentication required.');
      }

      const params: any = {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      };

      if (filterText && filterColumn) {
        params.filters = {
          [filterColumn]: filterText,
        };
      }

      if (sortColumn && sortDirection) {
        params.orderBy = [[sortColumn, sortDirection]];
      }

      const response = await fetch('/api/a_crud_universal_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: READ_CONFIG_ID,
          params: params,
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch payroll areas');
      }

      setPayrollAreas(result.data || []);
      setTotalRecords(result.total_records || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, currentPage, pageSize, filterText, filterColumn, sortColumn, sortDirection]);

  useEffect(() => {
    if (session) {
      fetchPayrollAreas();
    }
  }, [session, fetchPayrollAreas]);

  const handleViewClick = (area: PayrollArea) => {
    setViewingPayrollArea(area);
    setIsViewModalOpen(true);
  };



  const handlePageChange = (newPage: number) => {
    if (newPage < 1) return;
    setCurrentPage(newPage);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const handleFilterTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterText(e.target.value);
    setCurrentPage(1);
  };

  const handleFilterColumnChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterColumn(e.target.value);
    setCurrentPage(1);
  };

  const handleSortChange = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortColumn(column);
      setSortDirection('ASC');
    }
    setCurrentPage(1);
  };

  const handleToggleActive = async (area: PayrollArea) => {
    if (!session?.access_token) {
      setError('Authentication required to update payroll area status.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...area, // Send the entire area object
        is_active: !area.is_active, // Toggle the status
      };

      const response = await fetch('/api/a_crud_universal_bulk_upsert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          config_id: UPSERT_CONFIG_ID,
          input_rows: [payload],
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();

      if (!response.ok || !Array.isArray(result) || result.length === 0 || !result[0].success) {
        throw new Error(result[0]?.message || 'Failed to update payroll area status');
      }

      // Refresh the list of payroll areas after successful update
      fetchPayrollAreas();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading session...</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Payroll Areas</h1>
        <Button onClick={() => {
          setViewingPayrollArea(null); // Clear for new creation
          setIsFormModalOpen(true);
        }}>
          Create Payroll Area
        </Button>
      </div>

      {/* Filter Controls */}
      <div className="flex w-full justify-end space-x-4 mb-4">
        <Input
          type="text"
          placeholder={`Filter by ${filterColumn}...`}
          value={filterText}
          onChange={handleFilterTextChange}
          className="w-64"
        />
        <select
          value={filterColumn}
          onChange={handleFilterColumnChange}
          className="px-3 py-2 pr-4 border border-gray-300 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none w-48"
        >
          <option value="area_code">Area Code</option>
          <option value="periodicity">Periodicity</option>
          <option value="is_active">Status</option>
        </select>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {!loading && !error && payrollAreas.length === 0 && (
        <p>No payroll areas found.</p>
      )}

      {!loading && !error && payrollAreas.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b cursor-pointer text-left" onClick={() => handleSortChange('area_code')}>Area Code</th>
                <th className="py-2 px-4 border-b cursor-pointer text-left" onClick={() => handleSortChange('description')}>Description</th>
                <th className="py-2 px-4 border-b cursor-pointer text-left" onClick={() => handleSortChange('periodicity')}>Periodicity</th>
                <th className="py-2 px-4 border-b cursor-pointer text-left" onClick={() => handleSortChange('is_active')}>Status</th>
                <th className="py-2 px-4 border-b text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payrollAreas.map((area, index) => (
                <tr key={index}>
                  <td className="py-2 px-4 border-b">{area.area_code}</td>
                  <td className="py-2 px-4 border-b">{area.description}</td>
                  <td className="py-2 px-4 border-b">{area.periodicity}</td>
                  <td className="py-2 px-4 border-b">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${area.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {area.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-2 px-4 border-b flex items-center space-x-2">
                    <Button onClick={() => handleViewClick(area)} variant="ghost" size="sm">
                      View
                    </Button>
                    <button
                      type="button"
                      id={`is_active-${area.id}`}
                      name="is_active"
                      onClick={() => handleToggleActive(area)}
                      className={`${
                        area.is_active ? 'bg-gradient-to-r from-[#d0b9df] to-[#a9b9df]' : 'bg-gray-200'
                      } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ml-2`}
                      role="switch"
                      aria-checked={area.is_active}
                    >
                      <span className="sr-only">Toggle Active Status</span>
                      <span
                        aria-hidden="true"
                        className={`${
                          area.is_active ? 'translate-x-5' : 'translate-x-0'
                        } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out`}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex justify-between items-center mt-4">
        <Button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          isLoading={loading}
        >
          Previous
        </Button>
        <span>
          Page {currentPage} of {Math.ceil(totalRecords / pageSize)}
        </span>
        <Button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage * pageSize >= totalRecords}
          isLoading={loading}
        >
          Next
        </Button>
      </div>

      <PayrollAreaViewModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        payrollArea={viewingPayrollArea}
      />

      <PayrollAreaFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
        }}
        onSuccess={() => {
          setIsFormModalOpen(false);
          fetchPayrollAreas();
        }}
      />
    </div>
  );
}
