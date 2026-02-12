'use client';

'use client'

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import UserRolesDataTable from '@/components/UserRolesDataTable';
import { useSessionContext } from '@supabase/auth-helpers-react';

import AssignRoleModal from '@/components/AssignRoleModal';

export default function InternRolePage() {
  const { session } = useSessionContext();
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [filterText, setFilterText] = useState('');
  const [filterColumn, setFilterColumn] = useState('name');
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('ASC');
  const [isModalOpen, setIsModalOpen] = useState(false);


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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Assign Intern Role</h1>
        <Button onClick={() => setIsModalOpen(true)}>Assign New Role</Button>
      </div>

      <AssignRoleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchUserRoles(); // Refresh the table after successful assignment
        }}
      />

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
        roles={roles.filter(role => role.role === 'intern')}
        onEdit={() => {}}
        onToggleEnable={() => {}}
        onSortChange={handleSortChange}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
      />

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
    </div>
  );
}
