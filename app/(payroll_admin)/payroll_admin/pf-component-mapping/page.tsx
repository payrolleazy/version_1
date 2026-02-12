'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Loader from '@/components/ui/Loader';
import Input from '@/components/ui/Input';
import Modal from '@/components/Modal';

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================
interface InclusionRules {
    always_include: boolean;
    exclude_if_overtime: boolean;
    exclude_if_bonus: boolean;
    proration_applicable: boolean;
    ceiling_applicable: boolean;
}

interface ComponentMapping {
  component_id: number;
  component_code: string;
  component_name: string;
  component_type: 'EARNINGS' | 'STATUTORY_DEDUCTION' | 'ALLOWANCE' | 'REIMBURSEMENT' | string;
  is_pf_eligible: boolean;
  is_eps_eligible: boolean;
  mapping_effective_from: string;
  mapping_effective_to: string | null;
  component_is_active: boolean;
  allow_override: boolean;
  inclusion_rules?: InclusionRules | null; 
  is_dirty?: boolean;
}

type FilterStatus = 'All' | 'Active' | 'Inactive';

// ============================================================================
// 2. CONFIGURATION CONSTANTS
// ============================================================================
const CONFIGS = {
  READ_MAPPINGS_CONFIG: 'a2a2ea4c-c673-4f49-82f9-f1ebe8a66b2c',
  UPSERT_MAPPING_CONFIG: '9ac65616-5b40-4205-833f-ab44f5b64d21',
};

const DEFAULT_INCLUSION_RULES: InclusionRules = {
    always_include: false,
    exclude_if_overtime: false,
    exclude_if_bonus: false,
    proration_applicable: false,
    ceiling_applicable: false
};

// ============================================================================
// 3. HELPER FUNCTIONS & COMPONENTS
// ============================================================================
async function callGateway(endpoint: string, payload: any, token: string) {
  const bodyToSend = { ...payload, accessToken: token };
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(bodyToSend),
  });
  
  const result = await response.json();
  if (!response.ok || (result.hasOwnProperty('success') && !result.success)) {
    throw new Error(result.message || result.error || 'API Request Failed');
  }
  return result;
}

const ComponentTypeBadge = ({ type }: { type: string }) => {
    const typeStyles: Record<string, string> = {
        EARNINGS: 'bg-green-100 text-green-800',
        STATUTORY_DEDUCTION: 'bg-red-100 text-red-800',
        ALLOWANCE: 'bg-blue-100 text-blue-800',
        REIMBURSEMENT: 'bg-purple-100 text-purple-800',
    };
    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${typeStyles[type] || 'bg-gray-100 text-gray-800'}`}>
            {type.replace(/_/g, ' ')}
        </span>
    );
};

const StatusBadge = ({ isActive }: { isActive: boolean }) => (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
        {isActive ? 'Active' : 'Inactive'}
    </span>
);

// --- Custom Toggle Switch (Matches your reference code) ---
interface ToggleSwitchProps {
    id: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
}

const ToggleSwitch = ({ id, checked, onChange, label, disabled = false }: ToggleSwitchProps) => {
    return (
        <div className="flex items-center justify-between py-2">
            {label && <label htmlFor={id} className={`text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>{label}</label>}
            <button
                type="button"
                id={id}
                disabled={disabled}
                onClick={() => !disabled && onChange(!checked)}
                className={`${
                    checked ? 'bg-gradient-to-r from-[#d0b9df] to-[#a9b9df]' : 'bg-gray-200'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                role="switch"
                aria-checked={checked}
            >
                <span className="sr-only">Toggle {label}</span>
                <span
                    aria-hidden="true"
                    className={`${
                        checked ? 'translate-x-5' : 'translate-x-0'
                    } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out`}
                />
            </button>
        </div>
    );
};

// ============================================================================
// 4. MAIN PAGE COMPONENT
// ============================================================================

const PfComponentMappingPage = () => {
  const { session } = useSessionContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mappings, setMappings] = useState<ComponentMapping[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('All');
  
  // Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<ComponentMapping | null>(null);

  // --------------------------------------------------------------------------
  // Data Fetching
  // --------------------------------------------------------------------------
  const fetchMappings = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);

    try {
      const response = await callGateway('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_MAPPINGS_CONFIG,
        params: {
          filters: [],
          orderBy: [{ column: 'component_code', ascending: true }]
        }
      }, session.access_token);

      const rawData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      
      // Sanitize data to ensure booleans are never null/undefined
      const sanitizedData = rawData.map((row: any) => ({
          ...row,
          is_pf_eligible: !!row.is_pf_eligible, 
          is_eps_eligible: !!row.is_eps_eligible, 
          component_is_active: !!row.component_is_active,
          allow_override: !!row.allow_override
      }));

      setMappings(sanitizedData);
    } catch (e: any) {
      setError(`Failed to fetch mappings: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchMappings();
    }
  }, [session, fetchMappings]);

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------
  const handleToggle = (componentId: number, field: 'is_pf_eligible' | 'is_eps_eligible', value: boolean) => {
    setMappings(prev =>
      prev.map(m => {
        if (m.component_id === componentId) {
          const updated = { ...m, [field]: value, is_dirty: true };
          if (field === 'is_pf_eligible' && !value) {
            updated.is_eps_eligible = false;
          }
          return updated;
        }
        return m;
      })
    );
  };
  
  const handleSaveChanges = async () => {
    if (!session?.access_token) return;
    
    const dirtyMappings = mappings.filter(m => m.is_dirty);
    if (dirtyMappings.length === 0) return;

    setActionLoading(true);
    setError(null);

    const payload = dirtyMappings.map(m => {
        let rulesToSave = m.inclusion_rules;
        if (typeof rulesToSave === 'string') {
             try { rulesToSave = JSON.parse(rulesToSave); } catch { rulesToSave = DEFAULT_INCLUSION_RULES; }
        }
        if (!rulesToSave) rulesToSave = DEFAULT_INCLUSION_RULES;

        return {
            component_id: m.component_id,
            is_pf_eligible: m.is_pf_eligible,
            is_eps_eligible: m.is_eps_eligible,
            inclusion_rules: rulesToSave,
            allow_override: m.allow_override,
            effective_from: m.mapping_effective_from,
            effective_to: m.mapping_effective_to,
            is_active: m.component_is_active
        };
    });

    try {
      await callGateway('/api/a_crud_universal_bulk_upsert', {
        config_id: CONFIGS.UPSERT_MAPPING_CONFIG,
        operation: 'wcm-pf-upsert-wage-mapping', 
        input_rows: payload
      }, session.access_token);
      
      await fetchMappings(); 
    } catch (e: any) {
      setError(`Save failed: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (component: ComponentMapping) => {
    const copy = JSON.parse(JSON.stringify(component));
    
    if (typeof copy.inclusion_rules === 'string') {
        try { copy.inclusion_rules = JSON.parse(copy.inclusion_rules); } catch { copy.inclusion_rules = null; }
    }

    if (!copy.inclusion_rules || typeof copy.inclusion_rules !== 'object') {
        copy.inclusion_rules = { ...DEFAULT_INCLUSION_RULES };
    } else {
        copy.inclusion_rules = { ...DEFAULT_INCLUSION_RULES, ...(copy.inclusion_rules as object) };
    }

    if (copy.mapping_effective_from) {
        copy.mapping_effective_from = copy.mapping_effective_from.split('T')[0];
    }
    if (copy.mapping_effective_to) {
        copy.mapping_effective_to = copy.mapping_effective_to.split('T')[0];
    }
    
    setEditingComponent(copy);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditingComponent(null);
    setIsEditModalOpen(false);
  };

  const saveEditModalChanges = () => {
      if (!editingComponent) return;
      setMappings(prev => prev.map(m => 
        m.component_id === editingComponent.component_id 
            ? { ...editingComponent, is_dirty: true } 
            : m
      ));
      closeEditModal();
  };

  // --------------------------------------------------------------------------
  // Logic & Render
  // --------------------------------------------------------------------------
  const filteredMappings = useMemo(() => {
    return mappings.filter(m => {
        const matchesSearch = searchText.length > 0 ? 
            m.component_name.toLowerCase().includes(searchText.toLowerCase()) || 
            m.component_code.toLowerCase().includes(searchText.toLowerCase()) : true;
        
        const matchesStatus = filterStatus !== 'All' ? 
            (filterStatus === 'Active' ? m.component_is_active : !m.component_is_active) : true;
        return matchesSearch && matchesStatus;
    });
  }, [mappings, searchText, filterStatus]);

  const dirtyCount = mappings.filter(m => m.is_dirty).length;

  if (loading && mappings.length === 0) return <Loader />;

  return (
    <div className="p-8 bg-gray-50 min-h-screen font-sans">
      <div className="mb-4">
        <a href="/payroll_admin/pf-dashboard" className="text-blue-600 hover:underline">&larr; Back to PF Dashboard</a>
      </div>

      <h1 className="text-3xl font-bold text-gray-800 mb-6">Component Mapping Manager</h1>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
            {error}
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-blue-500">
        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 md:space-x-4 mb-6">
            <div className="flex items-center space-x-2 w-full md:w-1/2">
                <Input 
                    type="text"
                    placeholder="Search by code or name..."
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                />
            </div>
            <div className="flex items-center space-x-2 w-full md:w-auto">
                <select 
                    value={filterStatus} 
                    onChange={e => setFilterStatus(e.target.value as FilterStatus)} 
                    className="p-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="All">Status: All</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                </select>
                <Button onClick={fetchMappings} variant="secondary" size="sm">Refresh</Button>
            </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="p-3 text-left font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="p-3 text-left font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="p-3 text-center font-medium text-gray-500 uppercase tracking-wider">PF Eligible</th>
                        <th className="p-3 text-center font-medium text-gray-500 uppercase tracking-wider">EPS Eligible</th>
                        <th className="p-3 text-left font-medium text-gray-500 uppercase tracking-wider">Effective</th>
                        <th className="p-3 text-left font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="p-3 text-right font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredMappings.length === 0 ? (
                         <tr>
                            <td colSpan={7} className="p-8 text-center text-gray-500">No components found matching your filters.</td>
                        </tr>
                    ) : (
                        filteredMappings.map(m => (
                            <tr key={m.component_id} className={`hover:bg-gray-50 transition-colors ${m.is_dirty ? 'bg-yellow-50' : ''}`}>
                                <td className="p-3 text-gray-900 font-medium">{m.component_name}</td>
                                <td className="p-3"><ComponentTypeBadge type={m.component_type} /></td>
                                <td className="p-3 text-center">
                                    <div className="flex justify-center">
                                        <ToggleSwitch
                                            id={`table_pf_${m.component_id}`}
                                            checked={!!m.is_pf_eligible}
                                            onChange={(val) => handleToggle(m.component_id, 'is_pf_eligible', val)}
                                        />
                                    </div>
                                </td>
                                <td className="p-3 text-center">
                                    <div className="flex justify-center">
                                        <ToggleSwitch
                                            id={`table_eps_${m.component_id}`}
                                            disabled={!m.is_pf_eligible}
                                            checked={!!m.is_eps_eligible}
                                            onChange={(val) => handleToggle(m.component_id, 'is_eps_eligible', val)}
                                        />
                                    </div>
                                </td>
                                <td className="p-3 text-gray-600 text-xs">
                                    <div>{m.mapping_effective_from}</div>
                                    <div className="text-gray-400">{m.mapping_effective_to ? `to ${m.mapping_effective_to}` : '(Ongoing)'}</div>
                                </td>
                                <td className="p-3"><StatusBadge isActive={m.component_is_active} /></td>
                                <td className="p-3 text-right">
                                    <div className="flex justify-end space-x-2">
                                        <Button onClick={() => openEditModal(m)} variant="secondary" size="sm">Edit</Button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>
      
      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4 border-t z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-end items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-3">
                <Button 
                    onClick={handleSaveChanges} 
                    disabled={dirtyCount === 0 || actionLoading} 
                    isLoading={actionLoading}
                    variant="primary"
                >
                    Save Changes ({dirtyCount})
                </Button>
            </div>
        </div>
      </div>
      
      {/* Edit Modal */}
      {isEditModalOpen && editingComponent && (
          <Modal 
            isOpen={true} 
            title={`Edit: ${editingComponent.component_name} (${editingComponent.component_code})`} 
            onClose={closeEditModal}
            maxWidth="max-w-2xl"
          >
              <div className="space-y-6">
                  {/* Eligibility Grid */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-2">
                     <ToggleSwitch
                        id="modal_pf_eligible"
                        label="PF Eligible"
                        checked={!!editingComponent.is_pf_eligible}
                        onChange={(val) => setEditingComponent(p => ({
                            ...p!,
                            is_pf_eligible: val,
                            is_eps_eligible: p!.is_eps_eligible && val // Disable EPS if PF off
                        }))}
                     />
                     <ToggleSwitch
                        id="modal_eps_eligible"
                        label="EPS Eligible"
                        disabled={!editingComponent.is_pf_eligible}
                        checked={!!editingComponent.is_eps_eligible}
                        onChange={(val) => setEditingComponent(p => ({...p!, is_eps_eligible: val}))}
                     />
                  </div>

                  {/* Inclusion Rules */}
                  <fieldset className="border border-gray-200 p-4 rounded-md">
                      <legend className="font-semibold text-sm text-blue-600 px-2">Wage Definition Rules</legend>
                      <div className="space-y-1 mt-2">
                        {Object.keys(DEFAULT_INCLUSION_RULES).map(key => (
                            <ToggleSwitch
                                key={key}
                                id={key}
                                label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} // Title Case
                                checked={(editingComponent.inclusion_rules as any)?.[key] || false}
                                onChange={(val) => {
                                    const currentRules = (editingComponent.inclusion_rules as object) || DEFAULT_INCLUSION_RULES;
                                    setEditingComponent(p => ({
                                        ...p!, 
                                        inclusion_rules: {
                                            ...currentRules, 
                                            [key]: val
                                        }
                                    }));
                                }}
                            />
                        ))}
                      </div>
                  </fieldset>

                  {/* Override Toggle */}
                  <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                    <ToggleSwitch
                        id="allow_override"
                        label="Allow Pay Structure Override"
                        checked={!!editingComponent.allow_override}
                        onChange={(val) => setEditingComponent(p => ({...p!, allow_override: val}))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Effective From</label>
                          <Input type="date" value={editingComponent.mapping_effective_from} onChange={e => setEditingComponent(p => ({...p!, mapping_effective_from: e.target.value}))} />
                      </div>
                       <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Effective To</label>
                          <Input type="date" value={editingComponent.mapping_effective_to || ''} onChange={e => setEditingComponent(p => ({...p!, mapping_effective_to: e.target.value}))} />
                      </div>
                  </div>

                  <div className="flex justify-end pt-4 space-x-3 border-t">
                      <Button variant="ghost" onClick={closeEditModal}>Cancel</Button>
                      <Button onClick={saveEditModalChanges}>Apply</Button>
                  </div>
              </div>
          </Modal>
      )}
      
      <div className="h-24"></div>
    </div>
  );
};

export default PfComponentMappingPage;