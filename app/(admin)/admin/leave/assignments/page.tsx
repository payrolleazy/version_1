'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Modal from '@/components/Modal';
import { DataTable, Column } from '@/components/ui/DataTable';
import { ErrorBoundary, LoadingState } from '@/components/ui/ErrorBoundary';
import { LMS_GATEWAY_CONFIGS } from '@/lib/constants';
import { callReadGateway, callPgFunction } from '@/lib/useGateway';

// Interface aligned with backend allowed_columns + enrichment fields
// READ_POLICY_ASSIGNMENTS allowed_columns: ["assignment_code","department_id","designation_id","effective_date","is_active"]
// enrich_with_employee_details: true -> adds full_name (from profiles) and emp_code (from emp_active_master)
// NOTE: 'is_active' does NOT exist in lms_policy_assignments table — see error.txt ISSUE B-1
// Once backend config is fixed (remove is_active, add end_date), the status column will work correctly
interface Assignment {
  assignment_code: string;
  department_id: number | null;
  designation_id: number | null;
  effective_date: string;
  end_date?: string | null;
  full_name: string | null;
  emp_code: string | null;
}

// Interface for lms_leave_policies (READ_POLICIES config)
// allowed_columns include: id, policy_code, policy_name, is_active, policy_status, etc.
interface Policy {
  id: number;
  policy_code: string;
  policy_name: string;
  is_active: boolean;
  policy_status: string;
}

export default function PolicyAssignmentsPage() {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const router = useRouter();
  const [data, setData] = useState<Assignment[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    policy_id: '',
    target_type: 'department',
    target_id: '',
    effective_date: new Date().toISOString().split('T')[0],
  });

  const fetchData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const [assignRes, policyRes] = await Promise.all([
        callReadGateway(LMS_GATEWAY_CONFIGS.READ_POLICY_ASSIGNMENTS, { limit: 100 }, session.access_token),
        callReadGateway(LMS_GATEWAY_CONFIGS.READ_POLICIES, { limit: 100 }, session.access_token),
      ]);

      if (policyRes.success) {
        setPolicies(policyRes.data || []);
      }

      if (assignRes.success) {
        setData(assignRes.data || []);
      } else {
        setData([]);
        setError(assignRes.message || 'Failed to load policy assignments.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred while loading data.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) fetchData();
  }, [session, fetchData]);

  const resetForm = () => {
    setFormData({
      policy_id: '',
      target_type: 'department',
      target_id: '',
      effective_date: new Date().toISOString().split('T')[0],
    });
    setFormError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      // Use 'target_user_id' when target is a user to avoid conflict with
      // gateway-injected 'user_id' (authenticated caller). See error.txt ISSUE B-5.
      const targetKey = formData.target_type === 'user'
        ? 'target_user_id'
        : formData.target_type + '_id';

      const payload = {
        policy_id: formData.policy_id,
        [targetKey]: formData.target_id,
        effective_date: formData.effective_date,
        assignment_code: `ASGN-${Date.now()}`,
      };

      const result = await callPgFunction(LMS_GATEWAY_CONFIGS.ASSIGN_POLICY, payload, session!.access_token);
      if (result.success) {
        setIsModalOpen(false);
        resetForm();
        fetchData();
      } else {
        setFormError(result.message || 'Failed to create assignment.');
      }
    } catch (err: any) {
      setFormError(err?.message || 'An unexpected error occurred.');
    } finally {
      setFormLoading(false);
    }
  };

  // Columns aligned with backend allowed_columns + enrichment fields
  // allowed_columns: assignment_code, department_id, designation_id, effective_date
  // enrichment (enrich_with_employee_details=true): full_name, emp_code via LEFT JOIN on user_id
  const columns: Column<Assignment>[] = [
    { key: 'assignment_code', header: 'Code' },
    {
      key: 'full_name',
      header: 'Assigned To',
      render: (_, row) => {
        if (row.full_name) return `${row.full_name}${row.emp_code ? ` (${row.emp_code})` : ''}`;
        if (row.department_id) return `Department: ${row.department_id}`;
        if (row.designation_id) return `Designation: ${row.designation_id}`;
        return '-';
      },
    },
    {
      key: 'effective_date',
      header: 'Effective From',
      render: (v) => (v ? new Date(v).toLocaleDateString() : '-'),
    },
    {
      key: 'end_date',
      header: 'Status',
      render: (v, row) => {
        if (!row.end_date) return 'Active';
        return new Date(row.end_date) > new Date() ? 'Active' : 'Expired';
      },
    },
  ];

  if (sessionLoading || loading) return <LoadingState />;

  return (
    <ErrorBoundary>
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Policy Assignments</h1>
          <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>+ New Assignment</Button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow border border-gray-200">
          <DataTable data={data} columns={columns} rowKey="assignment_code" />
        </div>

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Assignment">
          <form onSubmit={handleSave} className="space-y-4 p-2">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {formError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Select Policy</label>
              <select
                className="w-full border rounded p-2 text-sm"
                value={formData.policy_id}
                onChange={(e) => setFormData({ ...formData, policy_id: e.target.value })}
                required
              >
                <option value="">-- Choose Policy --</option>
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.policy_name} ({p.policy_code})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Assignment Level</label>
                <select
                  className="w-full border rounded p-2 text-sm"
                  value={formData.target_type}
                  onChange={(e) => setFormData({ ...formData, target_type: e.target.value, target_id: '' })}
                >
                  <option value="department">Department</option>
                  <option value="designation">Designation</option>
                  <option value="user">Specific Employee</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {formData.target_type === 'user' ? 'Employee UUID' : 'Target ID'}
                </label>
                <input
                  type="text"
                  className="w-full border rounded p-2 text-sm"
                  placeholder={formData.target_type === 'user' ? 'User UUID' : 'ID from master table'}
                  value={formData.target_id}
                  onChange={(e) => setFormData({ ...formData, target_id: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Effective Date</label>
              <input
                type="date"
                className="w-full border rounded p-2 text-sm"
                value={formData.effective_date}
                onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={formLoading}>Confirm Assignment</Button>
            </div>
          </form>
        </Modal>
      </div>
    </ErrorBoundary>
  );
}
