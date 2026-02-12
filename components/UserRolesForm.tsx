'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useSessionContext } from '@supabase/auth-helpers-react';

interface UserRolesFormProps {
  role: any | null;
  onClose: () => void;
}

export default function UserRolesForm({ role, onClose }: UserRolesFormProps) {
  const { session } = useSessionContext();
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If a role is passed, it's an edit, so populate the form
    if (role) {
      setFormData(role);
    } else {
      // It's a new role, so start with an empty form and default role to 'candidate'
      setFormData({ role: 'candidate', enable_disable: '1' }); // Default role to 'candidate' and enabled
    }
  }, [role]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!session?.access_token) {
        throw new Error('Authentication required to save role.');
      }

      const userRolesData = {
        name: formData.name,
        email_users_roles: formData.email_users_roles,
        mobile: formData.mobile,
        role: 'candidate', // Enforce 'candidate' role as per backend function
        enable_disable: formData.enable_disable || '1',
        position_id: formData.position_id || null,
        date_of_joining: formData.date_of_joining || null,
        // tenant_id and user_id are injected by the gateway
      };

      const response = await fetch('/api/a_crud_universal_pg_function_gateway', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config_id: 'ums_insert_employee_invites', // Use the new config ID for candidate invites
          params: { user_roles_data: [userRolesData] }, // Wrap data in user_roles_data for the PG function
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to save candidate role');
      }

      onClose(); // Close the modal on success
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6">{role ? 'Edit Candidate Role' : 'Add New Candidate Role'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <Input name="email_users_roles" value={formData.email_users_roles || ''} onChange={handleChange} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Mobile</label>
            <Input name="mobile" value={formData.mobile || ''} onChange={handleChange} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <Input name="name" value={formData.name || ''} onChange={handleChange} required />
          </div>
          {/* Role is enforced as 'candidate' by the backend function, so it's not an editable field here */}
          <Input name="role" type="hidden" value="candidate" />
          <div>
            <label className="block text-sm font-medium text-gray-700">Position ID</label>
            <Input name="position_id" type="number" value={formData.position_id || ''} onChange={handleChange} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Date of Joining</label>
            <Input name="date_of_joining" type="date" value={formData.date_of_joining || ''} onChange={handleChange} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Existing Employee Code</label>
            <Input name="existing_emp_code" value={formData.existing_emp_code || ''} onChange={handleChange} />
          </div>
          
          {error && <p className="text-red-500 text-sm">Error: {error}</p>}

          <div className="flex justify-end space-x-4 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : (role ? 'Update Candidate Role' : 'Add Candidate Role')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
