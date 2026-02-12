'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Loader from '@/components/ui/Loader';
import Modal from '@/components/Modal'; // <--- Import Modal

// Configuration IDs from backend setup
const READ_ROLES_CONFIG_ID = '21455be5-bdbd-4c03-86da-52a814434d1b';
const UPSERT_ROLES_CONFIG_ID = 'f460e9e0-acac-407e-a49c-345c180bb9ed';

interface Role {
  id: string;
  name: string;
  role_id: number;
  created_at: string;
}

export default function RolesManagementPage() {
  const { supabaseClient: supabase, session } = useSessionContext();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // State for new/editing role
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleId, setNewRoleId] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false); // <--- New state for modal visibility

  const fetchRoles = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error('Authentication required to fetch roles.');
      }

      const response = await fetch('/api/a_crud_universal_read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config_id: READ_ROLES_CONFIG_ID,
          params: {
            orderBy: [['name', 'ASC']],
          },
          accessToken: accessToken,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch roles');
      }

      setRoles(result.data);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching roles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (supabase && session) {
      fetchRoles();
    }
  }, [supabase, session]);

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setNewRoleName(role.name);
    setNewRoleId(role.role_id);
    setIsModalOpen(true); // <--- Open modal when editing
  };

  const handleCancelEdit = () => {
    setEditingRole(null);
    setNewRoleName('');
    setNewRoleId('');
    setIsModalOpen(false); // <--- Close modal on cancel
  };

  const handleOpenAddRoleModal = () => { // <--- New function to open modal for adding
    setEditingRole(null); // Ensure we're adding, not editing
    setNewRoleName('');
    setNewRoleId('');
    setIsModalOpen(true);
  };

  const handleSubmitUpsert = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    if (!newRoleName || newRoleId === '') {
      setError('Role Name and Role ID are required.');
      setIsSubmitting(false);
      return;
    }

    try {
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error('Authentication required to upsert role.');
      }

      const roleData = {
        id: editingRole ? editingRole.id : undefined,
        name: newRoleName,
        role_id: newRoleId,
      };

      const response = await fetch('/api/a_crud_universal_bulk_upsert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config_id: UPSERT_ROLES_CONFIG_ID,
          input_rows: [roleData],
          accessToken: accessToken,
        }),
      });

      const result = await response.json();

      if (!response.ok || !Array.isArray(result) || result.length === 0 || !result[0].success) {
        throw new Error(result[0]?.message || 'Failed to upsert role');
      }

      setSuccessMessage(result[0].message || 'Role upserted successfully!');

      handleCancelEdit(); // <--- Close modal on success
      fetchRoles();
    } catch (err: any) {
      setError(err.message);
      console.error('Error upserting role:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!supabase || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader />
        <p>Loading session...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Roles Management</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Success:</strong>
          <span className="block sm:inline"> {successMessage}</span>
        </div>
      )}

      {/* Roles List */}
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 mb-8">
        <div className="flex justify-between items-center mb-4"> {/* <--- Added flex container */}
          <h2 className="text-2xl font-semibold">Existing Roles</h2>
          <Button onClick={handleOpenAddRoleModal}>Add New Role</Button> {/* <--- Button to open modal */}
        </div>
        {loading ? (
          <div className="flex items-center justify-center">
            <Loader />
            <p>Loading roles...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Role ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Created At
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{role.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{role.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{role.role_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{new Date(role.created_at).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button onClick={() => handleEdit(role)} variant="ghost">
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role Upsert Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCancelEdit} // Use handleCancelEdit to close modal
        title={editingRole ? 'Edit Role' : 'Add New Role'}
        maxWidth="max-w-md" // <--- Added maxWidth prop
      >
        <form onSubmit={handleSubmitUpsert} className="space-y-4">
          <div>
            <label htmlFor="roleName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role Name</label>
            <Input
              id="roleName"
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="e.g., Editor"
              required
              className="mt-1 block w-full"
            />
          </div>
          <div>
            <label htmlFor="roleId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role ID (Number)</label>
            <Input
              id="roleId"
              type="number"
              value={newRoleId}
              onChange={(e) => setNewRoleId(parseInt(e.target.value) || '')}
              placeholder="e.g., 5"
              required
              className="mt-1 block w-full"
            />
          </div>
          <div className="flex space-x-4 mt-6"> {/* <--- Added margin-top */}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader /> : (editingRole ? 'Update Role' : 'Add Role')}
            </Button>
            <Button type="button" onClick={handleCancelEdit} variant="secondary">
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
