'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import UserRolesDataTable from '@/components/UserRolesDataTable';
import UserRolesForm from '@/components/UserRolesForm';
import ImportUserRolesModal from '@/components/ImportUserRolesModal';
import ExportUserRolesModal from '@/components/ExportUserRolesModal'; // Import the new ExportUserRolesModal
import { useSessionContext } from '@supabase/auth-helpers-react';

export default function UserRolesPage() {
  const { session } = useSessionContext();
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false); // New state for export modal
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [filterText, setFilterText] = useState('');
  const [filterColumn, setFilterColumn] = useState('name');
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('ASC');

  const fetchUserRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!session?.access_token) {
        throw new Error('Authentication required to fetch roles.');
      }

      const params: any = {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      };

      // Add filter conditions for a single selected column
      if (filterText && filterColumn) {
        params.filters = {
          [filterColumn]: filterText,
        };
      }

      // Add sort conditions
      if (sortColumn && sortDirection) {
        params.orderBy = [[sortColumn, sortDirection]];
      }

      const response = await fetch('/api/a_crud_universal_read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config_id: '8a1b726e-9573-4a2c-a50a-1a2a3a4a5a6a', // The ID for user-roles-read
          params: params,
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch roles');
      }

      setRoles(result.data || []);
      setTotalRecords(result.total_records || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, currentPage, pageSize, filterText, filterColumn, sortColumn, sortDirection]);

  useEffect(() => {
    if (session) {
      fetchUserRoles();
    }
  }, [session, fetchUserRoles]);

  const handleAddNew = () => {
    setSelectedRole(null);
    setShowForm(true);
  };

  const handleEdit = (role: any) => {
    setSelectedRole(role);
    setShowForm(true);
  };

  const handleToggleEnable = async (role: any) => {
    if (!confirm(`Are you sure you want to ${role.enable_disable === '1' ? 'disable' : 'enable'} this role?`)) {
      return;
    }

    const updatedRole = { ...role, enable_disable: role.enable_disable === '1' ? '0' : '1' };

    try {
      if (!session?.access_token) {
        throw new Error('Authentication required to update role.');
      }

      const response = await fetch('/api/a_crud_universal_bulk_upsert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config_id: '4e5d6c7b-8a9b-4c5d-8e9f-0a1b2c3d4e5f', // The ID for user-roles-upsert
          input_rows: [updatedRole],
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();

      if (!response.ok || !Array.isArray(result) || result.length === 0 || !result[0].success) {
        throw new Error(result[0]?.message || 'Failed to update role');
      }

      fetchUserRoles(); // Refresh data on success
    } catch (err: any) {
      setError(`Failed to update role: ${err.message}`);
    }
  };

  const handleExport = () => {
    setShowExportModal(true);
  };

  const handleDownloadTemplate = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('excel-template-generator', {
        body: { config_id: 'user-roles-template-download' },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      } else {
        throw new Error('Download URL not provided by backend.');
      }

    } catch (err: any) {
      setError(`Failed to download template: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    fetchUserRoles(); // Refresh data after form closes
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1) return; // Prevent going below page 1
    setCurrentPage(newPage);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1); // Reset to first page when page size changes
  };

  const handleFilterTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterText(e.target.value);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleFilterColumnChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterColumn(e.target.value);
    setCurrentPage(1); // Reset to first page when filter column changes
  };

  const handleSortChange = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortColumn(column);
      setSortDirection('ASC');
    }
    setCurrentPage(1); // Reset to first page on sort change
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
        <h1 className="text-3xl font-bold">Assign Candidate</h1>
        <div className="flex space-x-4">
          <Button onClick={handleExport} disabled={loading}>Export to Excel</Button>
          <Button onClick={() => setShowImportModal(true)} disabled={loading}>Import from Excel</Button>
          <Button onClick={handleDownloadTemplate} disabled={loading}>Download Template</Button>
          <Button onClick={handleAddNew}>Add New Candidate Role</Button>
        </div>
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
          <option value="email_users_roles">Email</option>
          <option value="role">Role</option>
          <option value="mobile">Mobile</option>
          <option value="position_id">Position ID</option>
        </select>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      <UserRolesDataTable 
        roles={roles.filter(role => role.role === 'candidate')} 
        onEdit={handleEdit} 
        onToggleEnable={handleToggleEnable} 
        onSortChange={handleSortChange}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
      />

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

      {showForm && (
        <UserRolesForm 
          role={selectedRole} 
          onClose={handleFormClose} 
        />
      )}

      {showImportModal && (
        <ImportUserRolesModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportSuccess={fetchUserRoles} // Refresh data after successful import
        />
      )}

      {showExportModal && (
        <ExportUserRolesModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          config_id='user-roles-export-to-excel'
        />
      )}
    </div>
  );
}
