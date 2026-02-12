'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/Modal';
import Loader from '@/components/ui/Loader';

// ============================================================================
// 1. TYPES
// ============================================================================

interface EsicRegistration {
  id: number;
  user_id: string;
  ip_number: string | null;
  registration_date: string | null;
  exit_date: string | null;
  status: 'PENDING_REGISTRATION' | 'ACTIVE' | 'INACTIVE' | 'EXEMPTED';
  exemption_reason: string | null;
  establishment_id: number;
  // Enriched fields from Gateway
  full_name?: string;
  emp_code?: string;
}

interface Establishment {
  id: number;
  establishment_name: string;
  establishment_code: string;
}

// ============================================================================
// 2. CONFIGURATION CONSTANTS
// ============================================================================

const CONFIGS = {
  READ_REGISTRATIONS: '78b20d6c-06a9-4088-b72e-6f43f0a39c83',
  READ_ESTABLISHMENTS: '8b0aae37-378f-407e-9454-88d0c6941dba',
  UPDATE_REGISTRATION: 'wcm_esic_update_employee_registration'
};

// ============================================================================
// 3. PAGE COMPONENT
// ============================================================================

export default function EsicRegistrationPage() {
  const { session } = useSessionContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data State
  const [registrations, setRegistrations] = useState<EsicRegistration[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  
  // Filter State
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal & Action State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReg, setEditingReg] = useState<EsicRegistration | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<EsicRegistration>>({});

  // --------------------------------------------------------------------------
  // Data Fetching
  // --------------------------------------------------------------------------
  const fetchData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);

    try {
      // Parallel fetch: Employees and Establishments
      const [regRes, estRes] = await Promise.all([
        fetch('/api/a_crud_universal_read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config_id: CONFIGS.READ_REGISTRATIONS,
            params: { 
              limit: 1000,
              orderBy: [['created_at', 'DESC']]
            },
            // Critical: Get Employee Name & Code
            accessToken: session.access_token,
          }),
        }).then(r => r.json()),

        fetch('/api/a_crud_universal_read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config_id: CONFIGS.READ_ESTABLISHMENTS,
            params: { filters: { is_active: true } },
            accessToken: session.access_token,
          }),
        }).then(r => r.json())
      ]);

      if (!regRes.success) throw new Error(regRes.message || 'Failed to fetch registrations');
      if (!estRes.success) throw new Error(estRes.message || 'Failed to fetch establishments');

      setRegistrations(regRes.data || []);
      setEstablishments(estRes.data || []);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) fetchData();
  }, [session, fetchData]);

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  const handleEditClick = (reg: EsicRegistration) => {
    setEditingReg(reg);
    setFormData({
      ip_number: reg.ip_number || '',
      registration_date: reg.registration_date ? reg.registration_date.split('T')[0] : '',
      status: reg.status,
      exemption_reason: reg.exemption_reason || '',
      establishment_id: reg.establishment_id
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!session?.access_token || !editingReg) return;

    // Validation
    if (formData.status === 'ACTIVE' && !formData.ip_number) {
      alert('IP Number is required for Active status.');
      return;
    }
    if (formData.status === 'EXEMPTED' && !formData.exemption_reason) {
      alert('Reason is required for Exempted status.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/a_crud_universal_pg_function_gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: CONFIGS.UPDATE_REGISTRATION,
          params: {
            registration_id: editingReg.id,
            user_id: editingReg.user_id, // Identity of employee being updated
            ip_number: formData.ip_number || null,
            registration_date: formData.registration_date || null,
            status: formData.status,
            exemption_reason: formData.exemption_reason || null,
            // Explicitly pass changed_by to help the wrapper audit trail
            changed_by: session.user.id 
          },
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();
      
      // Gateway returns { success: true, data: { ... } }
      // Or wrapper might return { success: true, message: ... } inside result.data
      if (!response.ok || (result.data && result.data.success === false)) {
        throw new Error(result.data?.error || result.message || 'Update failed');
      }

      setIsModalOpen(false);
      fetchData(); // Refresh list
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------------------------------
  // Filtering Logic
  // --------------------------------------------------------------------------
  const filteredData = useMemo(() => {
    return registrations.filter(reg => {
      const searchMatch = 
        (reg.full_name?.toLowerCase() || '').includes(filterText.toLowerCase()) ||
        (reg.emp_code?.toLowerCase() || '').includes(filterText.toLowerCase()) ||
        (reg.ip_number || '').includes(filterText);
      
      const statusMatch = statusFilter === 'ALL' || reg.status === statusFilter;
      
      return searchMatch && statusMatch;
    });
  }, [registrations, filterText, statusFilter]);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  if (loading && registrations.length === 0) return <Loader />;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">ESIC Registration</h1>
          <p className="text-sm text-gray-500">Manage Employee IP Numbers and Coverage Status.</p>
        </div>
        <Button onClick={fetchData} variant="secondary">Refresh List</Button>
      </div>

      {error && <div className="p-4 mb-4 text-red-700 bg-red-100 rounded border border-red-400">{error}</div>}

      {/* Filters */}
      <div className="flex gap-4 mb-4 bg-white p-4 rounded shadow-sm">
        <Input 
          placeholder="Search Name, Code, IP..." 
          value={filterText} 
          onChange={e => setFilterText(e.target.value)} 
          className="w-1/3"
        />
        <select 
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING_REGISTRATION">Pending Registration</option>
          <option value="EXEMPTED">Exempted</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Est. Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reg. Date</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredData.length > 0 ? filteredData.map((reg) => (
              <tr key={reg.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">{reg.full_name || 'Unknown'}</div>
                  <div className="text-xs text-gray-500">{reg.emp_code || reg.user_id}</div>
                </td>
                <td className="px-6 py-4 text-sm font-mono text-gray-700">
                  {reg.ip_number || <span className="text-red-400 italic">Missing</span>}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${reg.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 
                      reg.status === 'EXEMPTED' ? 'bg-gray-100 text-gray-800' : 
                      'bg-yellow-100 text-yellow-800'}`}>
                    {reg.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {establishments.find(e => e.id === reg.establishment_id)?.establishment_code || reg.establishment_id}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {reg.registration_date ? new Date(reg.registration_date).toLocaleDateString() : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => handleEditClick(reg)} className="text-blue-600 hover:text-blue-900">Edit</button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {isModalOpen && editingReg && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Edit ESIC: ${editingReg.full_name}`}>
          <div className="space-y-4 p-4">
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select 
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value as any})}
                >
                  <option value="PENDING_REGISTRATION">Pending Registration</option>
                  <option value="ACTIVE">Active</option>
                  <option value="EXEMPTED">Exempted</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Registration Date</label>
                <Input 
                  type="date"
                  value={formData.registration_date || ''}
                  onChange={e => setFormData({...formData, registration_date: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">IP Number</label>
              <Input 
                value={formData.ip_number || ''}
                onChange={e => setFormData({...formData, ip_number: e.target.value})}
                placeholder="10-digit IP Number"
                disabled={formData.status === 'EXEMPTED'}
              />
            </div>

            {formData.status === 'EXEMPTED' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Exemption Reason</label>
                <Input 
                  value={formData.exemption_reason || ''}
                  onChange={e => setFormData({...formData, exemption_reason: e.target.value})}
                  placeholder="e.g., Salary > 21k"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} isLoading={saving}>Update</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}