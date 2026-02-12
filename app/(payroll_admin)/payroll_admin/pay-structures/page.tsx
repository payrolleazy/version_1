'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PayStructureFormModal from '@/components/PayStructureFormModal';
import PayStructureViewModal from '@/components/PayStructureViewModal'; // Import the new view modal
import Tabs from '@/components/Tabs'; // Import the new Tabs component
import WcmPayStructureComponentsTab from '@/components/WcmPayStructureComponentsTab'; // Import the new tab component
import ValidationResultModal from '@/components/ValidationResultModal'; // Import the new validation result modal
import ActivationResultModal from '@/components/ActivationResultModal'; // Import the new activation result modal

interface PayStructure {
  id: string;
  tenant_id: string;
  structure_code: string;
  name: string;
  description: string | null;
  version: number;
  status: string;
  pay_grade_id: number | null;
  applicability_rules: any;
  approval_status: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  activated_at: string | null;
  activated_by: string | null;
  deleted_at: string | null;
}

export default function PayStructuresPage() {
  const router = useRouter();
  const { session } = useSessionContext();
  const [payStructures, setPayStructures] = useState<PayStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [filterText, setFilterText] = useState('');
  const [filterColumn, setFilterColumn] = useState('name');
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('ASC');
  
  // State for the two modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingPayStructure, setViewingPayStructure] = useState<PayStructure | null>(null);

  // New state for validation and activation
  const [validatedStructures, setValidatedStructures] = useState<Set<string>>(new Set());
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  // New state for activation
  const [activationResult, setActivationResult] = useState<any>(null);
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);

  const handleValidate = async (payStructureId: string) => {
    if (!session) return;
    setLoading(true);
    try {
      const response = await fetch('/api/a_crud_universal_pg_function_gateway', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          config_id: 'validate-pay-structure',
          params: { pay_structure_id: payStructureId },
          accessToken: session.access_token,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || result.message || 'Validation failed with non-OK status');
      }
      
      // Correctly extract the validation result from the nested structure
      const validationData = result; 
      if (!validationData || typeof validationData.is_valid === 'undefined') {
        throw new Error('Invalid validation response structure');
      }

      setValidationResult(validationData);
      setIsValidationModalOpen(true);

      if (validationData.is_valid) {
        setValidatedStructures(prev => new Set(prev).add(payStructureId));
      } else {
        setValidatedStructures(prev => {
          const newSet = new Set(prev);
          newSet.delete(payStructureId);
          return newSet;
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (payStructureId: string) => {
    if (!session) return;
    setLoading(true);
    try {
      const response = await fetch('/api/a_crud_universal_pg_function_gateway', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          config_id: 'activate-pay-structure',
          params: { p_pay_structure_id: payStructureId },
          accessToken: session.access_token,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || result.message || 'Activation failed');

      // Correctly extract the activation result from the nested structure
      const activationData = result;
      if (!activationData) {
        throw new Error('Invalid activation response structure');
      }

      setActivationResult(activationData);
      setIsActivationModalOpen(true);

      if (activationData.success) {
        fetchPayStructures(); // Refresh data on successful activation
        setValidatedStructures(prev => { // Remove from validated set after activation
          const newSet = new Set(prev);
          newSet.delete(payStructureId);
          return newSet;
        });
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayStructures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!session?.access_token) {
        throw new Error('Authentication required to fetch pay structures.');
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config_id: '6a8b60fc-5c09-4f2f-ab73-9869d3245dff',
          params: params,
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch pay structures');
      }

      setPayStructures(result.data || []);
      setTotalRecords(result.total_records || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, currentPage, pageSize, filterText, filterColumn, sortColumn, sortDirection]);

  useEffect(() => {
    if (session) {
      fetchPayStructures();
    }
  }, [session, fetchPayStructures]);

  const handleViewClick = (structure: PayStructure) => {
    setViewingPayStructure(structure);
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

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading session...</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-white rounded-lg shadow-md">
      <Tabs>
        <Tabs.Tab label="Pay Structures">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Pay Structures</h1>
            <Button onClick={() => setIsFormModalOpen(true)}>
              Create Pay Structure
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
              <option value="name">Name</option>
              <option value="structure_code">Structure Code</option>
              <option value="status">Status</option>
              <option value="version">Version</option>
              <option value="pay_grade_id">Pay Grade ID</option>
            </select>
          </div>

          {loading && <p>Loading...</p>}
          {error && <p className="text-red-500">Error: {error}</p>}

          {!loading && !error && payStructures.length === 0 && (
            <p>No pay structures found.</p>
          )}

          {!loading && !error && payStructures.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr>
                    <th className="py-2 px-4 border-b cursor-pointer text-left" onClick={() => handleSortChange('structure_code')}>Structure Code</th>
                    <th className="py-2 px-4 border-b cursor-pointer text-left" onClick={() => handleSortChange('name')}>Name</th>
                    <th className="py-2 px-4 border-b cursor-pointer text-left" onClick={() => handleSortChange('status')}>Status</th>
                    <th className="py-2 px-4 border-b cursor-pointer text-left" onClick={() => handleSortChange('version')}>Version</th>
                    <th className="py-2 px-4 border-b cursor-pointer text-left" onClick={() => handleSortChange('pay_grade_id')}>Pay Grade ID</th>
                    <th className="py-2 px-4 border-b text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payStructures.map((structure) => (
                    <tr key={structure.id}>
                      <td className="py-2 px-4 border-b">{structure.structure_code}</td>
                      <td className="py-2 px-4 border-b">{structure.name}</td>
                      <td className="py-2 px-4 border-b">{structure.status}</td>
                      <td className="py-2 px-4 border-b">{structure.version}</td>
                      <td className="py-2 px-4 border-b">{structure.pay_grade_id}</td>
                      <td className="py-2 px-4 border-b">
                        <div className="flex items-center space-x-2">
                          <Button onClick={() => handleViewClick(structure)} variant="ghost" size="sm">
                            View
                          </Button>
                          {structure.status === 'DRAFT' && !validatedStructures.has(structure.id) && (
                            <Button onClick={() => handleValidate(structure.id)} variant="outline" size="sm" isLoading={loading}>
                              Validate
                            </Button>
                          )}
                          {structure.status === 'DRAFT' && validatedStructures.has(structure.id) && (
                            <Button onClick={() => handleActivate(structure.id)} variant="primary" size="sm" isLoading={loading}>
                              Activate
                            </Button>
                          )}
                        </div>
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
        </Tabs.Tab>
        <Tabs.Tab label="Pay Structure Components">
          <WcmPayStructureComponentsTab />
        </Tabs.Tab>
      </Tabs>

      {/* CREATE Modal */}
      <PayStructureFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={() => {
          setIsFormModalOpen(false);
          fetchPayStructures();
        }}
      />

      {/* VIEW Modal */}
      <PayStructureViewModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        payStructure={viewingPayStructure}
      />

      {/* Validation Result Modal */}
      {validationResult && (
        <ValidationResultModal
          isOpen={isValidationModalOpen}
          onClose={() => setIsValidationModalOpen(false)}
          result={validationResult}
        />
      )}

      {/* Activation Result Modal */}
      {activationResult && (
        <ActivationResultModal
          isOpen={isActivationModalOpen}
          onClose={() => setIsActivationModalOpen(false)}
          result={activationResult}
        />
      )}
    </div>
  );
}