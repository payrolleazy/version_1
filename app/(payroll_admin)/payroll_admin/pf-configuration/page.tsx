'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Loader from '@/components/ui/Loader';
import Modal from '@/components/Modal';
import Input from '@/components/ui/Input';

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================
interface PfConfiguration {
    id?: number; // bigint from DB, number in TS
    tenant_id?: string; // uuid from DB, string in TS
    wage_ceiling: number; // numeric
    employee_contribution_rate: number; // numeric
    employer_epf_rate: number; // numeric
    employer_eps_rate: number; // numeric
    eps_wage_ceiling: number; // numeric
    admin_charge_rate: number; // numeric
    edli_rate: number; // numeric
    edli_admin_rate: number; // numeric
    apply_wage_ceiling: boolean; // boolean
    proration_enabled: boolean; // boolean
    auto_enroll_new_employees: boolean; // boolean
    month_variance_threshold: number; // numeric
    statistical_sigma_threshold: number; // numeric
    trend_degradation_months: number; // integer
    default_interest_rate: number; // numeric
    default_interest_method: string; // text
    effective_from: string; // date (will store as ISO string)
    effective_to: string | null; // date (will store as ISO string)
    is_active: boolean; // boolean
    version: number; // integer
    created_at?: string; // timestamp with time zone (will store as ISO string)
    updated_at?: string; // timestamp with time zone (will store as ISO string)
    created_by?: string; // uuid (will store as string)
    emp_code?: string; // New: Employee code for who created the config
}

// ============================================================================
// 2. CONFIGURATION CONSTANTS (Gateway IDs from pf_frontend_prompt.txt)
// ============================================================================
const CONFIGS = {
  READ_ACTIVE_CONFIG: 'c37f0945-036f-4b87-bc9d-ff8779506d36',
  READ_CONFIG_HISTORY: '8b280dec-ae96-492e-8e50-9f7f499d0746',
  EDIT_CONFIG: '33df2134-0292-4d1b-b19a-dea6a957e82c', // Existing upsert for edit
  CREATE_NEW_VERSION: 'wcm-pf-update-config', // New pg function for new version
};

// ============================================================================
// 3. HELPER: GENERIC API CALLER
// ============================================================================
async function callGateway(endpoint: string, payload: any, token: string) {
  const bodyToSend: any = { ...payload, accessToken: token };

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

// ============================================================================
// 4. MAIN PAGE COMPONENT
// ============================================================================

export default function PfConfigurationPage() {
  const { session } = useSessionContext();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeConfig, setActiveConfig] = useState<PfConfiguration | null>(null);
  const [configHistory, setConfigHistory] = useState<PfConfiguration[]>([]);
  
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Partial<PfConfiguration> | null>(null);
  const [viewingConfig, setViewingConfig] = useState<PfConfiguration | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [formMode, setFormMode] = useState<'edit' | 'newVersion' | null>(null);

  // ==========================
  // DATA FETCHING METHODS
  // ==========================

  const fetchData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);

    try {
      const [activeRes, historyRes] = await Promise.all([
        callGateway('/api/a_crud_universal_read', {
          config_id: CONFIGS.READ_ACTIVE_CONFIG,
          params: { limit: 1 }
        }, session.access_token),
        callGateway('/api/a_crud_universal_read', {
          config_id: CONFIGS.READ_CONFIG_HISTORY,
          params: { orderBy: [{ column: 'version', ascending: false }], limit: 50 }
        }, session.access_token)
      ]);
      setActiveConfig(activeRes.data?.[0] || null);
      setConfigHistory(historyRes.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) fetchData();
  }, [session, fetchData]);

  // ==========================
  // ACTION HANDLERS
  // ==========================

  const handleEditCurrent = (config: PfConfiguration) => {
    setFormMode('edit');
    setEditingConfig(config);
    setIsFormModalOpen(true);
  };

  const handleNewVersion = (baseConfig: Partial<PfConfiguration>) => {
    setFormMode('newVersion');
    const newVersionConfig: Partial<PfConfiguration> = {
      ...baseConfig,
      id: undefined,
      version: baseConfig.version,
      effective_from: new Date().toISOString().split('T')[0],
      effective_to: null,
      is_active: true,
      created_at: undefined,
      updated_at: undefined,
      created_by: undefined,
    };
    setEditingConfig(newVersionConfig);
    setIsFormModalOpen(true);
  };

  const handleViewHistory = (config: PfConfiguration) => {
    setViewingConfig(config);
    setIsViewModalOpen(true);
  };

  const handleUpdateConfig = async (configData: Partial<PfConfiguration>) => {
    if (!session?.access_token) return;
    setActionLoading(true);
    setError(null);

    const payload = { ...configData };
    delete payload.id; // Remove id as requested

    try {
      await callGateway('/api/a_crud_universal_bulk_upsert', {
        config_id: CONFIGS.EDIT_CONFIG,
        input_rows: [payload]
      }, session.access_token);
      
      setIsFormModalOpen(false);
      setEditingConfig(null);
      setFormMode(null);
      await fetchData();
    } catch(e: any) {
      setError(`Save failed: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateNewVersion = async (configData: Partial<PfConfiguration>) => {
    if (!session?.access_token) return;
    setActionLoading(true);
    setError(null);

    const payload = { ...configData };
    delete payload.id; // Also remove id for new version

    try {
      await callGateway('/api/a_crud_universal_pg_function_gateway', {
        config_id: CONFIGS.CREATE_NEW_VERSION,
        params: { 
          input_rows: [payload],
          config_id: payload.tenant_id 
        }
      }, session.access_token);
      
      setIsFormModalOpen(false);
      setEditingConfig(null);
      setFormMode(null);
      await fetchData();
    } catch(e: any) {
      setError(`Save failed: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveConfig = async (configData: Partial<PfConfiguration>) => {
    if (formMode === 'edit') {
      await handleUpdateConfig(configData);
    } else if (formMode === 'newVersion') {
      await handleCreateNewVersion(configData);
    } else {
      setError("Unknown form mode. Cannot save.");
    }
  };

  const handleFormModalClose = () => {
    setIsFormModalOpen(false);
    setEditingConfig(null);
    setFormMode(null);
  };
  
  const handleViewModalClose = () => {
      setIsViewModalOpen(false);
      setViewingConfig(null);
  };

  if (loading && !activeConfig && configHistory.length === 0) return <Loader />;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="mb-4">
        <a href="/payroll_admin/pf-dashboard" className="text-blue-600 hover:underline">&larr; Back to PF Dashboard</a>
      </div>
      <h1 className="text-3xl font-bold mb-6">PF Configuration Master</h1>
      <div className="flex justify-end mb-4">
        {!activeConfig && (
          <Button onClick={() => handleNewVersion({})}>Create New Configuration</Button>
        )}
      </div>

      {activeConfig && <CurrentConfigCard config={activeConfig} onEdit={handleEditCurrent} onNewVersion={() => handleNewVersion(activeConfig)} />}
      
      <div className="mt-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Configuration History</h2>
        <ConfigHistoryTable history={configHistory} onView={handleViewHistory} />
      </div>

      <ConfigFormModal
          isOpen={isFormModalOpen}
          onClose={handleFormModalClose}
          initialData={editingConfig}
          onSave={handleSaveConfig}
          isLoading={actionLoading}
        />

      <ViewConfigModal 
        isOpen={isViewModalOpen}
        onClose={handleViewModalClose}
        config={viewingConfig}
      />
    </div>
  );
}

// ============================================================================
// 5. SUB-COMPONENTS
// ============================================================================

const InfoItem = ({ label, value }: { label: string, value: string | number | React.ReactNode }) => (
    <div className="bg-gray-50 p-3 rounded-lg">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
    </div>
);

const ViewConfigModal = ({ isOpen, onClose, config }: { isOpen: boolean; onClose: () => void; config: PfConfiguration | null; }) => {
    if (!isOpen || !config) return null;

    const renderValue = (value: any, isBoolean = false) => {
        if (isBoolean) {
            return value ? <span className="text-green-600 font-bold">Yes</span> : <span className="text-red-600 font-bold">No</span>;
        }
        if (value === null || value === undefined || value === '') {
            return <span className="text-gray-500">N/A</span>;
        }
        return value;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`View Configuration (Version ${config.version})`}>
            <div className="p-6 bg-gradient-to-r from-[#faf7ff] to-[#f5f8ff] rounded-md shadow-inner">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-3"><h3 className="text-xl font-bold mt-4 mb-2 border-b-2 border-blue-200 pb-1">Key Metrics</h3></div>
                    <InfoItem label="Wage Ceiling (₹)" value={renderValue(config.wage_ceiling)} />
                    <InfoItem label="EPS Wage Ceiling (₹)" value={renderValue(config.eps_wage_ceiling)} />
                    <InfoItem label="Employee Rate (%)" value={renderValue(config.employee_contribution_rate)} />
                    <InfoItem label="Employer EPF Rate (%)" value={renderValue(config.employer_epf_rate)} />
                    <InfoItem label="Employer EPS Rate (%)" value={renderValue(config.employer_eps_rate)} />
                    <InfoItem label="Admin Charge Rate (%)" value={renderValue(config.admin_charge_rate)} />
                    <InfoItem label="EDLI Rate (%)" value={renderValue(config.edli_rate)} />
                    <InfoItem label="EDLI Admin Rate (%)" value={renderValue(config.edli_admin_rate)} />
                    
                    <div className="md:col-span-3"><h3 className="text-xl font-bold mt-4 mb-2 border-b-2 border-blue-200 pb-1">System Settings</h3></div>
                    <InfoItem label="Apply Wage Ceiling" value={renderValue(config.apply_wage_ceiling, true)} />
                    <InfoItem label="Proration Enabled" value={renderValue(config.proration_enabled, true)} />
                    <InfoItem label="Auto-enroll New Employees" value={renderValue(config.auto_enroll_new_employees, true)} />

                    <div className="md:col-span-3"><h3 className="text-xl font-bold mt-4 mb-2 border-b-2 border-blue-200 pb-1">Anomaly Detection</h3></div>
                    <InfoItem label="Month Variance Threshold (%)" value={renderValue(config.month_variance_threshold)} />
                    <InfoItem label="Statistical Sigma Threshold" value={renderValue(config.statistical_sigma_threshold)} />
                    <InfoItem label="Trend Degradation Months" value={renderValue(config.trend_degradation_months)} />

                    <div className="md:col-span-3"><h3 className="text-xl font-bold mt-4 mb-2 border-b-2 border-blue-200 pb-1">Arrears Settings</h3></div>
                    <InfoItem label="Default Interest Rate (%)" value={renderValue(config.default_interest_rate)} />
                    <InfoItem label="Default Interest Method" value={renderValue(config.default_interest_method)} />

                    <div className="md:col-span-3"><h3 className="text-xl font-bold mt-4 mb-2 border-b-2 border-blue-200 pb-1">Effective Dates & Status</h3></div>
                    <InfoItem label="Effective From" value={new Date(config.effective_from).toLocaleDateString()} />
                    <InfoItem label="Effective To" value={config.effective_to ? new Date(config.effective_to).toLocaleDateString() : 'Ongoing'} />
                    <InfoItem label="Is Active" value={renderValue(config.is_active, true)} />
                </div>
                <div className="flex justify-end space-x-2 mt-8">
                    <Button type="button" onClick={onClose}>Close</Button>
                </div>
            </div>
        </Modal>
    );
};


const CurrentConfigCard = ({ config, onEdit, onNewVersion }: { config: PfConfiguration, onEdit: (config: PfConfiguration) => void, onNewVersion: (config: PfConfiguration) => void }) => (
    <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-blue-500">
        <div className="flex justify-between items-start">
            <div>
                <h2 className="text-2xl font-bold">Active Configuration (Version {config.version})</h2>
                <p className="text-sm text-gray-500">Effective: {new Date(config.effective_from).toLocaleDateString()} - {config.effective_to ? new Date(config.effective_to).toLocaleDateString() : 'Ongoing'}</p>
            </div>
            <div className="flex space-x-2">
                <Button onClick={() => onEdit(config)} variant="outline">Edit</Button>
                <Button onClick={() => onNewVersion(config)}>New Version</Button>
            </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
            <InfoItem label="Wage Ceiling" value={`₹${config.wage_ceiling}`} />
            <InfoItem label="Employee Rate" value={`${config.employee_contribution_rate}%`} />
            <InfoItem label="Employer EPF" value={`${config.employer_epf_rate}%`} />
            <InfoItem label="Employer EPS" value={`${config.employer_eps_rate}%`} />
            <InfoItem label="Admin Charges" value={`${config.admin_charge_rate}%`} />
            <InfoItem label="EDLI Charges" value={`${config.edli_rate}%`} />
        </div>
    </div>
);

const ConfigHistoryTable = ({ history, onView }: { history: PfConfiguration[], onView: (config: PfConfiguration) => void }) => (
    <div className="overflow-x-auto">
        <table className="min-w-full">
            <thead className="bg-gray-50">
                <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Effective From</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Effective To</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created By</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created At</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {history.map(h => (
                    <tr key={h.version}>
                        <td className="px-4 py-3 text-sm font-medium">{h.version}</td>
                        <td className="px-4 py-3 text-sm">{new Date(h.effective_from).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm">{h.effective_to ? new Date(h.effective_to).toLocaleDateString() : 'Ongoing'}</td>
                        <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 text-xs rounded-full ${h.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                {h.is_active ? 'Active' : 'Expired'}
                            </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{h.emp_code || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm">{h.created_at ? new Date(h.created_at).toLocaleDateString() : 'N/A'}</td>
                        <td className="px-4 py-3 text-sm flex space-x-2">
                            <Button size="sm" variant="ghost" onClick={() => onView(h)}>View</Button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);


const FormItem = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        {children}
    </div>
);

interface FormFieldProps {
    name: string;
    label: string;
    value: any;
    type?: string;
    step?: string;
    min?: string;
    max?: string;
    isCheckbox?: boolean;
    isSelect?: boolean;
    options?: { value: string; label: string }[];
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

const FormField = ({ name, label, value, type = 'text', step, min, max, isCheckbox = false, isSelect = false, options = [], handleChange }: FormFieldProps) => (
    <FormItem label={label}>
        {isSelect ? (
            <select
                name={name}
                value={value}
                onChange={handleChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
                {options.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
        ) : isCheckbox ? (
            <input
                name={name}
                type="checkbox"
                checked={value}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
        ) : (
            <Input
                name={name}
                type={type}
                value={value}
                onChange={handleChange}
                required={type !== 'date' || (type === 'date' && label !== 'Effective To (Optional)')}
                min={min}
                max={max}
                step={step}
            />
        )}
    </FormItem>
);

const ConfigFormModal = ({ isOpen, onClose, initialData, onSave, isLoading }: { isOpen: boolean; onClose: () => void; initialData: Partial<PfConfiguration> | null; onSave: (data: Partial<PfConfiguration>) => void; isLoading: boolean; }) => {
    const [formData, setFormData] = useState<Partial<PfConfiguration>>({});

    useEffect(() => {
        const baseData = initialData ? JSON.parse(JSON.stringify(initialData)) : {};

        setFormData({
            wage_ceiling: 0,
            employee_contribution_rate: 0,
            employer_epf_rate: 0,
            employer_eps_rate: 0,
            eps_wage_ceiling: 0,
            admin_charge_rate: 0,
            edli_rate: 0,
            edli_admin_rate: 0,
            apply_wage_ceiling: false,
            proration_enabled: false,
            auto_enroll_new_employees: false,
            month_variance_threshold: 0,
            statistical_sigma_threshold: 0,
            trend_degradation_months: 0,
            default_interest_rate: 0,
            default_interest_method: 'SIMPLE',
            is_active: true,
            effective_from: new Date().toISOString().split('T')[0],
            effective_to: null,

            ...baseData,
            effective_from: baseData.effective_from?.split('T')[0] || new Date().toISOString().split('T')[0],
            effective_to: baseData.effective_to ? baseData.effective_to.split('T')[0] : null,
        });
    }, [initialData, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = (e.target as HTMLInputElement).type === 'checkbox';
        const checked = (e.target as HTMLInputElement).checked;

        setFormData(prev => ({
            ...prev,
            [name]: isCheckbox ? checked : value
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const dataToSave: Partial<PfConfiguration> = {
            ...formData,
            wage_ceiling: parseFloat(formData.wage_ceiling as any),
            employee_contribution_rate: parseFloat(formData.employee_contribution_rate as any),
            employer_epf_rate: parseFloat(formData.employer_epf_rate as any),
            employer_eps_rate: parseFloat(formData.employer_eps_rate as any),
            eps_wage_ceiling: parseFloat(formData.eps_wage_ceiling as any),
            admin_charge_rate: parseFloat(formData.admin_charge_rate as any),
            edli_rate: parseFloat(formData.edli_rate as any),
            edli_admin_rate: parseFloat(formData.edli_admin_rate as any),
            month_variance_threshold: parseFloat(formData.month_variance_threshold as any),
            statistical_sigma_threshold: parseFloat(formData.statistical_sigma_threshold as any),
            trend_degradation_months: parseInt(formData.trend_degradation_months as any, 10),
            default_interest_rate: parseFloat(formData.default_interest_rate as any),
        };
        onSave(dataToSave);
    }

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData?.id ? `Edit Configuration (Version ${initialData.version})` : 'Create New Configuration Version'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField name="wage_ceiling" label="Wage Ceiling (₹)" value={formData.wage_ceiling || 0} type="number" min="0" handleChange={handleChange} />
                    <FormField name="eps_wage_ceiling" label="EPS Wage Ceiling (₹)" value={formData.eps_wage_ceiling || 0} type="number" min="0" handleChange={handleChange} />
                    <FormField name="employee_contribution_rate" label="Employee Rate (%)" value={formData.employee_contribution_rate || 0} type="number" step="0.01" min="0" max="100" handleChange={handleChange} />
                    <FormField name="employer_epf_rate" label="Employer EPF Rate (%)" value={formData.employer_epf_rate || 0} type="number" step="0.01" min="0" max="100" handleChange={handleChange} />
                    <FormField name="employer_eps_rate" label="Employer EPS Rate (%)" value={formData.employer_eps_rate || 0} type="number" step="0.01" min="0" max="100" handleChange={handleChange} />
                    <FormField name="admin_charge_rate" label="Admin Charge Rate (%)" value={formData.admin_charge_rate || 0} type="number" step="0.01" min="0" max="100" handleChange={handleChange} />
                    <FormField name="edli_rate" label="EDLI Rate (%)" value={formData.edli_rate || 0} type="number" step="0.01" min="0" max="100" handleChange={handleChange} />
                     <FormField name="edli_admin_rate" label="EDLI Admin Rate (%)" value={formData.edli_admin_rate || 0} type="number" step="0.01" min="0" max="100" handleChange={handleChange} />

                    <div className="md:col-span-2">
                        <h3 className="text-lg font-semibold mt-4 mb-2">System Settings</h3>
                    </div>
                    <FormField name="apply_wage_ceiling" label="Apply Wage Ceiling" value={formData.apply_wage_ceiling || false} isCheckbox={true} handleChange={handleChange} />
                    <FormField name="proration_enabled" label="Proration Enabled" value={formData.proration_enabled || false} isCheckbox={true} handleChange={handleChange} />
                    <FormField name="auto_enroll_new_employees" label="Auto-enroll New Employees" value={formData.auto_enroll_new_employees || false} isCheckbox={true} handleChange={handleChange} />

                    <div className="md:col-span-2">
                        <h3 className="text-lg font-semibold mt-4 mb-2">Anomaly Detection Thresholds</h3>
                    </div>
                    <FormField name="month_variance_threshold" label="Month Variance Threshold (%)" value={formData.month_variance_threshold || 0} type="number" step="0.01" min="0" max="100" handleChange={handleChange} />
                    <FormField name="statistical_sigma_threshold" label="Statistical Sigma Threshold" value={formData.statistical_sigma_threshold || 0} type="number" step="0.01" min="0" handleChange={handleChange} />
                    <FormField name="trend_degradation_months" label="Trend Degradation Months" value={formData.trend_degradation_months || 0} type="number" min="0" handleChange={handleChange} />

                    <div className="md:col-span-2">
                        <h3 className="text-lg font-semibold mt-4 mb-2">Arrears Settings</h3>
                    </div>
                    <FormField name="default_interest_rate" label="Default Interest Rate (%)" value={formData.default_interest_rate || 0} type="number" step="0.01" min="0" max="100" handleChange={handleChange} />
                    <FormField
                        name="default_interest_method"
                        label="Default Interest Method"
                        value={formData.default_interest_method || 'SIMPLE'}
                        isSelect={true}
                        options={[{ value: 'SIMPLE', label: 'SIMPLE' }, { value: 'COMPOUND', label: 'COMPOUND' }, { value: 'FLAT', label: 'FLAT' }]}
                        handleChange={handleChange}
                    />

                    <div className="md:col-span-2">
                        <h3 className="text-lg font-semibold mt-4 mb-2">Effective Dates</h3>
                    </div>
                    <FormField name="effective_from" label="Effective From" value={formData.effective_from?.split('T')[0] || ''} type="date" handleChange={handleChange} />
                    <FormField name="effective_to" label="Effective To (Optional)" value={formData.effective_to?.split('T')[0] || ''} type="date" handleChange={handleChange} />
                    <FormField name="is_active" label="Is Active" value={formData.is_active || false} isCheckbox={true} handleChange={handleChange} />
                </div>
                 <div className="flex justify-end space-x-2">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
                    <Button type="submit" isLoading={isLoading}>Save Configuration</Button>
                </div>
            </form>
        </Modal>
    );
};
