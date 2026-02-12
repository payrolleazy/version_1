'use client';

import { useState, useEffect } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import Loader from '@/components/ui/Loader';

const READ_ROLES_CONFIG_ID = '21455be5-bdbd-4c03-86da-52a814434d1b';
const READ_CANDIDATES_CONFIG_ID = '8a1b726e-9573-4a2c-a50a-1a2a3a4a5a6a';
const REQUEST_ROLE_ASSIGNMENT_CONFIG_ID = '287374fb-65f6-4cbb-9364-d18a6ba4e204';

interface Role {
  id: string;
  name: string;
}

interface Candidate {
  userId: string;
  name: string;
  email_users_roles: string;
}

interface AssignRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AssignRoleModal({ isOpen, onClose, onSuccess }: AssignRoleModalProps) {
  const { session } = useSessionContext();
  const [roles, setRoles] = useState<Role[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('Authentication required.');

      // Fetch Roles
      const rolesResponse = await fetch('/api/a_crud_universal_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_id: READ_ROLES_CONFIG_ID, accessToken }),
      });
      const rolesResult = await rolesResponse.json();
      if (!rolesResponse.ok || !rolesResult.success) throw new Error(rolesResult.message || 'Failed to fetch roles');
      setRoles(rolesResult.data);

      // Fetch Candidates using the new PG function gateway
      const candidatesResponse = await fetch('/api/a_crud_universal_pg_function_gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          config_id: 'user-roles-read-for-admin-role-assign',
          params: { page_number: 1, page_size: 1000 }, // Example pagination
          accessToken 
        }),
      });
      const candidatesResult = await candidatesResponse.json();
      if (!candidatesResponse.ok || !candidatesResult.success) throw new Error(candidatesResult.message || 'Failed to fetch candidates');
      setCandidates(candidatesResult.details.data || []);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidate || !selectedRole) {
      setError('Please select both a user and a role.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('Authentication required.');

      const response = await fetch('/api/a_crud_universal_bulk_upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: REQUEST_ROLE_ASSIGNMENT_CONFIG_ID,
          input_rows: [{
            user_id_to_assign: selectedCandidate,
            role_name_to_assign: selectedRole,
          }],
          accessToken,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result[0]?.success) {
        throw new Error(result[0]?.message || 'Failed to assign role.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign New Role">
      {loading ? (
        <Loader />
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="candidate" className="block text-sm font-medium text-gray-700">Select User (Candidate)</label>
            <select
              id="candidate"
              value={selectedCandidate}
              onChange={(e) => setSelectedCandidate(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">-- Select a user --</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.user_id}>
                  {candidate['Emp Name']} ({candidate['Email']})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700">Select Role</label>
            <select
              id="role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">-- Select a role --</option>
              {roles.map((role) => (
                <option key={role.id} value={role.name}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader /> : 'Assign Role'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
