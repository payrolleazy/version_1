'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/Modal';
import Loader from '@/components/ui/Loader';

// ============================================================================
// 1. TYPES
// ============================================================================

interface EsicConfig {
  id?: number;
  state_code: string;
  effective_from: string; // YYYY-MM-DD
  effective_to?: string | null;
  wage_ceiling: number;
  employee_contribution_rate: number;
  employer_contribution_rate: number;
  version_notes?: string;
  statutory_reference?: string;
  is_active: boolean;
}

// ============================================================================
// 2. CONFIGURATION CONSTANTS
// ============================================================================

const CONFIGS = {
  READ_CONFIGS: '4ad740af-e142-4c1f-9d8b-e3924cd9557d',
  UPSERT_CONFIG: 'wcm_esic_upsert_configuration' // Ensure this exists in your Gateway Table
};

// ============================================================================
// 3. PAGE COMPONENT
// ============================================================================

export default function EsicConfigurationPage() {
  const { session } = useSessionContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configs, setConfigs] = useState<EsicConfig[]>([]);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<EsicConfig | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState<EsicConfig>({
    state_code: '',
    effective_from: new Date().toISOString().split('T')[0],
    wage_ceiling: 21000,
    employee_contribution_rate: 0.75,
    employer_contribution_rate: 3.25,
    is_active: true
  });

  // --------------------------------------------------------------------------
  // Data Fetching
  // --------------------------------------------------------------------------
  const fetchConfigs = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/a_crud_universal_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: CONFIGS.READ_CONFIGS,
          params: { orderBy: [['effective_from', 'DESC']] },
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch configurations');
      }

      setConfigs(result.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) fetchConfigs();
  }, [session, fetchConfigs]);

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------
  
  const handleOpenModal = (config?: EsicConfig) => {
    if (config) {
      // Editing existing
      setEditingConfig(config);
      setFormData({
        ...config,
        effective_from: config.effective_from.split('T')[0], // Format date for input
        effective_to: config.effective_to ? config.effective_to.split('T')[0] : null
      });
    } else {
      // Creating new
      setEditingConfig(null);
      setFormData({
        state_code: '',
        effective_from: new Date().toISOString().split('T')[0],
        wage_ceiling: 21000, // Default ESIC ceiling
        employee_contribution_rate: 0.75, // Current Rate
        employer_contribution_rate: 3.25, // Current Rate
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!session?.access_token) return;
    
    // Basic Validation
    if (!formData.state_code || !formData.wage_ceiling) {
      alert("State Code and Wage Ceiling are required.");
      return;
    }

    setSaving(true);
    try {
      // We use the Function Gateway because this logic involves specific validation
      // and audit logging defined in the wrapper function.
      const response = await fetch('/api/a_crud_universal_pg_function_gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: CONFIGS.UPSERT_CONFIG,
          params: {
            // Mapping frontend form to SQL Wrapper parameters
            // Note: tenant_id and user_id are injected by the Gateway automatically
            state_code: formData.state_code.toUpperCase(),
            effective_from: formData.effective_from,
            effective_to: formData.effective_to || null,
            wage_ceiling: Number(formData.wage_ceiling),
            employee_contribution_rate: Number(formData.employee_contribution_rate),
            employer_contribution_rate: Number(formData.employer_contribution_rate),
            version_notes: formData.version_notes,
            statutory_reference: formData.statutory_reference
          },
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();
      
      if (!response.ok || (result.data && result.data.success === false)) {
        throw new Error(result.data?.error || result.message || 'Save failed');
      }

      setIsModalOpen(false);
      fetchConfigs();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  
  if (loading && configs.length === 0) return <Loader />;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">ESIC Configuration</h1>
          <p className="text-sm text-gray-500">Define statutory rates and ceilings per state.</p>
        </div>
        <Button onClick={() => handleOpenModal()}>+ Add Configuration</Button>
      </div>

      {error && <div className="p-4 mb-4 text-red-700 bg-red-100 rounded border border-red-400">{error}</div>}

      {/* Configuration Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">State</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Effective Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wage Ceiling</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Emp Rate %</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employer Rate %</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {configs.length > 0 ? configs.map((config) => (
              <tr key={config.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{config.state_code}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(config.effective_from).toLocaleDateString()}
                  {config.effective_to && <span className="text-xs text-gray-400 block">to {new Date(config.effective_to).toLocaleDateString()}</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">₹{config.wage_ceiling.toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{config.employee_contribution_rate}%</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{config.employer_contribution_rate}%</td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${config.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {config.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    onClick={() => handleOpenModal(config)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No configurations found. Click &quot;Add Configuration&quot; to start.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingConfig ? `Edit Rules: ${editingConfig.state_code}` : 'New ESIC Rule'}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">State Code (e.g. MH, KA)</label>
                <Input 
                  value={formData.state_code} 
                  onChange={e => setFormData({...formData, state_code: e.target.value.toUpperCase()})}
                  placeholder="XX"
                  maxLength={2}
                  disabled={!!editingConfig} // State code usually locked on edit to prevent unique constraint issues
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Effective From</label>
                <Input 
                  type="date" 
                  value={formData.effective_from} 
                  onChange={e => setFormData({...formData, effective_from: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Wage Ceiling (₹)</label>
              <Input 
                type="number" 
                value={formData.wage_ceiling} 
                onChange={e => setFormData({...formData, wage_ceiling: Number(e.target.value)})}
              />
              <p className="text-xs text-gray-500 mt-1">Employees earning above this will be exempt.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Employee Rate (%)</label>
                <Input 
                  type="number" 
                  step="0.01"
                  value={formData.employee_contribution_rate} 
                  onChange={e => setFormData({...formData, employee_contribution_rate: Number(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Employer Rate (%)</label>
                <Input 
                  type="number" 
                  step="0.01"
                  value={formData.employer_contribution_rate} 
                  onChange={e => setFormData({...formData, employer_contribution_rate: Number(e.target.value)})}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Notes / Statutory Reference</label>
              <Input 
                value={formData.version_notes || ''} 
                onChange={e => setFormData({...formData, version_notes: e.target.value})}
                placeholder="e.g. Gazette Notification 2023..."
              />
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} isLoading={saving}>Save Configuration</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}