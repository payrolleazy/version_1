'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Loader from '@/components/ui/Loader';
import Modal from '@/components/Modal';
import Tabs from '@/components/Tabs';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface FnfConfig {
  id: number;
  tenant_id: string;
  gratuity_config: {
    enabled: boolean;
    min_service_years: number;
    calculation_basis: string;
    max_amount?: number;
  };
  leave_encashment_global_config: {
    enabled: boolean;
    max_days?: number;
    calculation_basis: string;
  };
  notice_pay_config: {
    notice_period_days: number;
    recovery_basis: string;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ClearanceDepartment {
  id: number;
  tenant_id: string;
  department_name: string;
  description: string | null;
  concern_person_role_id: string | null;
  specific_user_id: string | null;
  is_mandatory: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface FnfWorksheet {
  id: number;
  resignation_request_id: number;
  tenant_id: string;
  user_id: string;
  leave_encashment_amount: number;
  gratuity_amount: number;
  bonus_amount: number;
  notice_period_shortfall_days: number;
  notice_period_recovery_amount: number;
  total_asset_recovery_amount: number;
  other_deductions: number;
  gross_payable_earnings: number;
  total_deductions: number;
  net_payable: number;
  is_negative_settlement: boolean;
  payment_mode: string;
  beneficiary_details: Record<string, any>;
  calculation_breakdown: Record<string, any>;
  config_snapshot_used: Record<string, any>;
  calculated_by: string | null;
  finalized_by: string | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
  // Enriched
  employee_name?: string;
  emp_code?: string;
}

interface ClearanceChecklist {
  id: number;
  resignation_request_id: number;
  tenant_id: string;
  user_id: string;
  department_name: string;
  assigned_role_id: string | null;
  assigned_user_email: string | null;
  status: string;
  recovery_amount: number;
  recovery_remarks: string | null;
  cleared_by: string | null;
  cleared_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CONFIG IDS
// ============================================================================

const CONFIGS = {
  // READ
  READ_FNF_CONFIG: '198b8c1d-7fe7-48ad-8635-e3d01accab0f',
  READ_CLEARANCE_CONFIG: '7e6829a2-d172-4fb4-8af0-80d60a8a0b67',
  READ_WORKSHEET: '9f97e8c1-d7ab-47e5-a180-6df84b869846',
  READ_CHECKLIST: 'a14c2c5c-e659-4cbc-b78e-b5beb926ccec',
  // UPSERT
  UPSERT_FNF_CONFIG: '57116e24-6ddf-49cc-9382-c53405cbeb4f',
  UPSERT_CLEARANCE_CONFIG: 'e3968b73-bee6-4ded-a66b-54805ae18e08',
  UPDATE_CLEARANCE: '767f9032-3c0d-45d3-8da7-757f4ac372dd',
  // RPC
  CALCULATE_SETTLEMENT: 'wcm_fnf_calculate_settlement',
  FINALIZE_SETTLEMENT: 'wcm_finalize_fnf_settlement',
};

// ============================================================================
// HELPER: API CALLER
// ============================================================================

async function callApi(endpoint: string, payload: any, token: string) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, accessToken: token }),
  });
  const result = await response.json();
  if (!response.ok || (result.hasOwnProperty('success') && !result.success)) {
    throw new Error(result.message || 'API Request Failed');
  }
  return result;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function FnfProcessingPage() {
  const { session } = useSessionContext();

  // Config state
  const [fnfConfig, setFnfConfig] = useState<FnfConfig | null>(null);
  const [clearanceDepts, setClearanceDepts] = useState<ClearanceDepartment[]>([]);

  // Processing state
  const [worksheets, setWorksheets] = useState<FnfWorksheet[]>([]);
  const [checklists, setChecklists] = useState<ClearanceChecklist[]>([]);
  const [selectedWorksheet, setSelectedWorksheet] = useState<FnfWorksheet | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<ClearanceDepartment | null>(null);
  const [clearanceModalOpen, setClearanceModalOpen] = useState(false);
  const [selectedClearance, setSelectedClearance] = useState<ClearanceChecklist | null>(null);

  // Form state for config
  const [configForm, setConfigForm] = useState({
    gratuity_enabled: true,
    gratuity_min_years: 5,
    gratuity_basis: 'LAST_DRAWN_BASIC',
    gratuity_max: 2000000,
    leave_enabled: true,
    leave_max_days: 30,
    leave_basis: 'BASIC_DA',
    notice_days: 30,
    notice_recovery_basis: 'GROSS_SALARY',
  });

  // Form state for department
  const [deptForm, setDeptForm] = useState({
    department_name: '',
    description: '',
    is_mandatory: true,
    display_order: 1,
  });

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchFnfConfig = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await callApi('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_FNF_CONFIG,
        params: { limit: 1 }
      }, session.access_token);

      if (res.data && res.data.length > 0) {
        const config = res.data[0];
        setFnfConfig(config);
        // Populate form
        setConfigForm({
          gratuity_enabled: config.gratuity_config?.enabled ?? true,
          gratuity_min_years: config.gratuity_config?.min_service_years ?? 5,
          gratuity_basis: config.gratuity_config?.calculation_basis ?? 'LAST_DRAWN_BASIC',
          gratuity_max: config.gratuity_config?.max_amount ?? 2000000,
          leave_enabled: config.leave_encashment_global_config?.enabled ?? true,
          leave_max_days: config.leave_encashment_global_config?.max_days ?? 30,
          leave_basis: config.leave_encashment_global_config?.calculation_basis ?? 'BASIC_DA',
          notice_days: config.notice_pay_config?.notice_period_days ?? 30,
          notice_recovery_basis: config.notice_pay_config?.recovery_basis ?? 'GROSS_SALARY',
        });
      }
    } catch (e: any) {
      console.error('Failed to fetch FNF config:', e);
    }
  }, [session]);

  const fetchClearanceDepts = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await callApi('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_CLEARANCE_CONFIG,
        params: { orderBy: [['display_order', 'ASC']], limit: 100 }
      }, session.access_token);
      setClearanceDepts(res.data || []);
    } catch (e: any) {
      console.error('Failed to fetch clearance depts:', e);
    }
  }, [session]);

  const fetchWorksheets = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await callApi('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_WORKSHEET,
        params: { orderBy: [['created_at', 'DESC']], limit: 100 }
      }, session.access_token);
      setWorksheets(res.data || []);
    } catch (e: any) {
      console.error('Failed to fetch worksheets:', e);
    }
  }, [session]);

  const fetchChecklists = useCallback(async (worksheetId?: number) => {
    if (!session?.access_token) return;
    try {
      const filters: any = {};
      if (worksheetId && selectedWorksheet) {
        filters.resignation_request_id = selectedWorksheet.resignation_request_id;
      }

      const res = await callApi('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_CHECKLIST,
        params: { filters, orderBy: [['department_name', 'ASC']], limit: 100 }
      }, session.access_token);
      setChecklists(res.data || []);
    } catch (e: any) {
      console.error('Failed to fetch checklists:', e);
    }
  }, [session, selectedWorksheet]);

  // Initial load
  useEffect(() => {
    if (session) {
      setLoading(true);
      Promise.all([
        fetchFnfConfig(),
        fetchClearanceDepts(),
        fetchWorksheets(),
        fetchChecklists()
      ]).finally(() => setLoading(false));
    }
  }, [session, fetchFnfConfig, fetchClearanceDepts, fetchWorksheets, fetchChecklists]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSaveConfig = async () => {
    if (!session?.access_token) return;
    setError(null);

    try {
      const payload = {
        gratuity_config: {
          enabled: configForm.gratuity_enabled,
          min_service_years: configForm.gratuity_min_years,
          calculation_basis: configForm.gratuity_basis,
          max_amount: configForm.gratuity_max,
        },
        leave_encashment_global_config: {
          enabled: configForm.leave_enabled,
          max_days: configForm.leave_max_days,
          calculation_basis: configForm.leave_basis,
        },
        notice_pay_config: {
          notice_period_days: configForm.notice_days,
          recovery_basis: configForm.notice_recovery_basis,
        },
        is_active: true,
      };

      await callApi('/api/a_crud_universal_bulk_upsert', {
        config_id: CONFIGS.UPSERT_FNF_CONFIG,
        input_rows: [payload]
      }, session.access_token);

      setConfigModalOpen(false);
      fetchFnfConfig();
      alert('FNF Configuration saved successfully!');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSaveDept = async () => {
    if (!session?.access_token || !deptForm.department_name) return;
    setError(null);

    try {
      const payload = {
        ...deptForm,
        ...(editingDept?.id && { id: editingDept.id }),
      };

      await callApi('/api/a_crud_universal_bulk_upsert', {
        config_id: CONFIGS.UPSERT_CLEARANCE_CONFIG,
        input_rows: [payload]
      }, session.access_token);

      setDeptModalOpen(false);
      setEditingDept(null);
      setDeptForm({ department_name: '', description: '', is_mandatory: true, display_order: 1 });
      fetchClearanceDepts();
      alert('Department saved successfully!');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUpdateClearance = async (status: string, recoveryAmount: number, remarks: string) => {
    if (!session?.access_token || !selectedClearance) return;
    setError(null);

    try {
      await callApi('/api/a_crud_universal_bulk_upsert', {
        config_id: CONFIGS.UPDATE_CLEARANCE,
        input_rows: [{
          id: selectedClearance.id,
          status,
          recovery_amount: recoveryAmount,
          recovery_remarks: remarks,
          cleared_by: session.user.id,
          cleared_at: new Date().toISOString(),
        }]
      }, session.access_token);

      setClearanceModalOpen(false);
      setSelectedClearance(null);
      fetchChecklists();
      alert('Clearance updated successfully!');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCalculateSettlement = async (worksheetId: number) => {
    if (!session?.access_token) return;
    setError(null);

    try {
      await callApi('/api/a_crud_universal_pg_function_gateway', {
        config_id: CONFIGS.CALCULATE_SETTLEMENT,
        params: { p_worksheet_id: worksheetId }
      }, session.access_token);

      fetchWorksheets();
      alert('Settlement calculated successfully!');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleFinalizeSettlement = async (worksheetId: number) => {
    if (!session?.access_token) return;
    if (!confirm('Are you sure you want to finalize this settlement? This action cannot be undone.')) return;
    setError(null);

    try {
      await callApi('/api/a_crud_universal_pg_function_gateway', {
        config_id: CONFIGS.FINALIZE_SETTLEMENT,
        params: { p_worksheet_id: worksheetId }
      }, session.access_token);

      fetchWorksheets();
      alert('Settlement finalized successfully!');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'CLEARED': 'bg-green-100 text-green-800',
      'RECOVERY_PENDING': 'bg-orange-100 text-orange-800',
      'WAIVED': 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!session) return <Loader />;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Full & Final Settlement (FNF)</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
            <button onClick={() => setError(null)} className="float-right font-bold">&times;</button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader /></div>
        ) : (
          <Tabs>
            {/* TAB 1: FNF CONFIGURATION */}
            <Tabs.Tab label="FNF Configuration">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Settlement Policy Configuration</h2>
                  <Button onClick={() => setConfigModalOpen(true)}>Edit Configuration</Button>
                </div>

                {fnfConfig ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Gratuity Config */}
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold text-gray-800 mb-3">Gratuity</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Enabled:</span>
                          <span className={fnfConfig.gratuity_config?.enabled ? 'text-green-600' : 'text-red-600'}>
                            {fnfConfig.gratuity_config?.enabled ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Min Service Years:</span>
                          <span>{fnfConfig.gratuity_config?.min_service_years || 5}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Basis:</span>
                          <span>{fnfConfig.gratuity_config?.calculation_basis || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Max Amount:</span>
                          <span>{formatCurrency(fnfConfig.gratuity_config?.max_amount || 2000000)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Leave Encashment Config */}
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold text-gray-800 mb-3">Leave Encashment</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Enabled:</span>
                          <span className={fnfConfig.leave_encashment_global_config?.enabled ? 'text-green-600' : 'text-red-600'}>
                            {fnfConfig.leave_encashment_global_config?.enabled ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Max Days:</span>
                          <span>{fnfConfig.leave_encashment_global_config?.max_days || 'Unlimited'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Basis:</span>
                          <span>{fnfConfig.leave_encashment_global_config?.calculation_basis || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Notice Pay Config */}
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold text-gray-800 mb-3">Notice Pay</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Notice Period:</span>
                          <span>{fnfConfig.notice_pay_config?.notice_period_days || 30} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Recovery Basis:</span>
                          <span>{fnfConfig.notice_pay_config?.recovery_basis || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No FNF configuration found. Click &quot;Edit Configuration&quot; to set up.</p>
                  </div>
                )}
              </div>
            </Tabs.Tab>

            {/* TAB 2: CLEARANCE DEPARTMENTS */}
            <Tabs.Tab label="Clearance Departments">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Department Clearance Setup</h2>
                  <Button onClick={() => {
                    setEditingDept(null);
                    setDeptForm({ department_name: '', description: '', is_mandatory: true, display_order: clearanceDepts.length + 1 });
                    setDeptModalOpen(true);
                  }}>
                    Add Department
                  </Button>
                </div>

                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mandatory</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {clearanceDepts.map((dept) => (
                        <tr key={dept.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-600">{dept.display_order}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{dept.department_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{dept.description || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            {dept.is_mandatory ? (
                              <span className="text-green-600">Yes</span>
                            ) : (
                              <span className="text-gray-400">No</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button variant="ghost" size="sm" onClick={() => {
                              setEditingDept(dept);
                              setDeptForm({
                                department_name: dept.department_name,
                                description: dept.description || '',
                                is_mandatory: dept.is_mandatory,
                                display_order: dept.display_order,
                              });
                              setDeptModalOpen(true);
                            }}>
                              Edit
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {clearanceDepts.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            No clearance departments configured yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Tabs.Tab>

            {/* TAB 3: ACTIVE FNF CASES */}
            <Tabs.Tab label={`Active Cases (${worksheets.filter(w => !w.finalized_at).length})`}>
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">FNF Settlement Cases</h2>

                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gross Earnings</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deductions</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Payable</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {worksheets.filter(w => !w.finalized_at).map((ws) => (
                        <tr key={ws.id} className={`hover:bg-gray-50 ${ws.is_negative_settlement ? 'bg-red-50' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{ws.emp_code || 'N/A'}</div>
                            <div className="text-xs text-gray-500">{ws.employee_name || ws.user_id.substring(0, 8)}</div>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-green-700 font-medium">
                            {formatCurrency(ws.gross_payable_earnings)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-red-700 font-medium">
                            {formatCurrency(ws.total_deductions)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-sm font-bold ${ws.net_payable >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {formatCurrency(ws.net_payable)}
                            </span>
                            {ws.is_negative_settlement && (
                              <div className="text-xs text-red-600">(Recovery Due)</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                              PENDING
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center space-x-1">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedWorksheet(ws)}>
                              View
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleCalculateSettlement(ws.id)}>
                              Recalculate
                            </Button>
                            <Button size="sm" onClick={() => handleFinalizeSettlement(ws.id)}>
                              Finalize
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {worksheets.filter(w => !w.finalized_at).length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                            No active FNF cases.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Tabs.Tab>

            {/* TAB 4: CLEARANCE STATUS */}
            <Tabs.Tab label="Clearance Status">
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Department Clearance Tracking</h2>

                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Recovery</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {checklists.map((cl) => (
                        <tr key={cl.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {cl.user_id.substring(0, 8)}...
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{cl.department_name}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(cl.status)}`}>
                              {cl.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            {cl.recovery_amount > 0 ? (
                              <span className="text-red-600 font-medium">{formatCurrency(cl.recovery_amount)}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {cl.status === 'PENDING' && (
                              <Button variant="ghost" size="sm" onClick={() => {
                                setSelectedClearance(cl);
                                setClearanceModalOpen(true);
                              }}>
                                Update
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {checklists.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            No clearance records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Tabs.Tab>

            {/* TAB 5: FINALIZED SETTLEMENTS */}
            <Tabs.Tab label={`Finalized (${worksheets.filter(w => w.finalized_at).length})`}>
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Finalized Settlements</h2>

                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Settlement</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Mode</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Finalized On</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {worksheets.filter(w => w.finalized_at).map((ws) => (
                        <tr key={ws.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{ws.emp_code || 'N/A'}</div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-sm font-bold ${ws.net_payable >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {formatCurrency(ws.net_payable)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{ws.payment_mode}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {ws.finalized_at ? new Date(ws.finalized_at).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedWorksheet(ws)}>
                              View Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {worksheets.filter(w => w.finalized_at).length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            No finalized settlements yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Tabs.Tab>
          </Tabs>
        )}
      </div>

      {/* CONFIG MODAL */}
      <Modal isOpen={configModalOpen} onClose={() => setConfigModalOpen(false)} title="Edit FNF Configuration">
        <div className="space-y-6">
          {/* Gratuity Section */}
          <div className="border-b pb-4">
            <h3 className="font-semibold mb-3">Gratuity Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={configForm.gratuity_enabled}
                    onChange={(e) => setConfigForm({ ...configForm, gratuity_enabled: e.target.checked })}
                  />
                  <span className="text-sm">Enable Gratuity Calculation</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Service Years</label>
                <Input
                  type="number"
                  value={configForm.gratuity_min_years}
                  onChange={(e) => setConfigForm({ ...configForm, gratuity_min_years: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount (INR)</label>
                <Input
                  type="number"
                  value={configForm.gratuity_max}
                  onChange={(e) => setConfigForm({ ...configForm, gratuity_max: parseInt(e.target.value) })}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Calculation Basis</label>
                <select
                  value={configForm.gratuity_basis}
                  onChange={(e) => setConfigForm({ ...configForm, gratuity_basis: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="LAST_DRAWN_BASIC">Last Drawn Basic</option>
                  <option value="LAST_DRAWN_BASIC_DA">Last Drawn Basic + DA</option>
                  <option value="AVERAGE_BASIC">Average Basic (Last 10 months)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Leave Encashment Section */}
          <div className="border-b pb-4">
            <h3 className="font-semibold mb-3">Leave Encashment Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={configForm.leave_enabled}
                    onChange={(e) => setConfigForm({ ...configForm, leave_enabled: e.target.checked })}
                  />
                  <span className="text-sm">Enable Leave Encashment</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Days</label>
                <Input
                  type="number"
                  value={configForm.leave_max_days}
                  onChange={(e) => setConfigForm({ ...configForm, leave_max_days: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Calculation Basis</label>
                <select
                  value={configForm.leave_basis}
                  onChange={(e) => setConfigForm({ ...configForm, leave_basis: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="BASIC_DA">Basic + DA</option>
                  <option value="GROSS">Gross Salary</option>
                  <option value="BASIC">Basic Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notice Pay Section */}
          <div>
            <h3 className="font-semibold mb-3">Notice Pay Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notice Period (Days)</label>
                <Input
                  type="number"
                  value={configForm.notice_days}
                  onChange={(e) => setConfigForm({ ...configForm, notice_days: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recovery Basis</label>
                <select
                  value={configForm.notice_recovery_basis}
                  onChange={(e) => setConfigForm({ ...configForm, notice_recovery_basis: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="GROSS_SALARY">Gross Salary</option>
                  <option value="BASIC_DA">Basic + DA</option>
                  <option value="CTC">CTC</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="ghost" onClick={() => setConfigModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveConfig}>Save Configuration</Button>
          </div>
        </div>
      </Modal>

      {/* DEPARTMENT MODAL */}
      <Modal isOpen={deptModalOpen} onClose={() => setDeptModalOpen(false)} title={editingDept ? 'Edit Department' : 'Add Department'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department Name *</label>
            <Input
              value={deptForm.department_name}
              onChange={(e) => setDeptForm({ ...deptForm, department_name: e.target.value })}
              placeholder="e.g., IT Department, Finance, HR"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <Input
              value={deptForm.description}
              onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
              placeholder="Brief description of clearance items"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
              <Input
                type="number"
                value={deptForm.display_order}
                onChange={(e) => setDeptForm({ ...deptForm, display_order: parseInt(e.target.value) })}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={deptForm.is_mandatory}
                  onChange={(e) => setDeptForm({ ...deptForm, is_mandatory: e.target.checked })}
                />
                <span className="text-sm">Mandatory Clearance</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="ghost" onClick={() => setDeptModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveDept}>Save Department</Button>
          </div>
        </div>
      </Modal>

      {/* CLEARANCE UPDATE MODAL */}
      {selectedClearance && (
        <ClearanceUpdateModal
          isOpen={clearanceModalOpen}
          onClose={() => { setClearanceModalOpen(false); setSelectedClearance(null); }}
          clearance={selectedClearance}
          onUpdate={handleUpdateClearance}
        />
      )}

      {/* WORKSHEET DETAIL MODAL */}
      {selectedWorksheet && (
        <WorksheetDetailModal
          isOpen={!!selectedWorksheet}
          onClose={() => setSelectedWorksheet(null)}
          worksheet={selectedWorksheet}
        />
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function ClearanceUpdateModal({ isOpen, onClose, clearance, onUpdate }: {
  isOpen: boolean;
  onClose: () => void;
  clearance: ClearanceChecklist;
  onUpdate: (status: string, amount: number, remarks: string) => void;
}) {
  const [status, setStatus] = useState('CLEARED');
  const [amount, setAmount] = useState(0);
  const [remarks, setRemarks] = useState('');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Update Clearance - ${clearance.department_name}`}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="CLEARED">Cleared - No Recovery</option>
            <option value="RECOVERY_PENDING">Cleared with Recovery</option>
            <option value="WAIVED">Waived</option>
          </select>
        </div>
        {status === 'RECOVERY_PENDING' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recovery Amount (INR)</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            rows={3}
            placeholder="Enter clearance remarks..."
          />
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onUpdate(status, amount, remarks)}>Update Clearance</Button>
        </div>
      </div>
    </Modal>
  );
}

function WorksheetDetailModal({ isOpen, onClose, worksheet }: {
  isOpen: boolean;
  onClose: () => void;
  worksheet: FnfWorksheet;
}) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(value);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="FNF Settlement Details">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-xs text-gray-500 uppercase">Employee</p>
            <p className="text-sm font-medium">{worksheet.emp_code || worksheet.user_id}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Payment Mode</p>
            <p className="text-sm font-medium">{worksheet.payment_mode}</p>
          </div>
        </div>

        {/* Earnings */}
        <div className="border rounded-lg p-4">
          <h4 className="font-semibold text-green-700 mb-3">Earnings</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Leave Encashment</span>
              <span>{formatCurrency(worksheet.leave_encashment_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Gratuity</span>
              <span>{formatCurrency(worksheet.gratuity_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Bonus</span>
              <span>{formatCurrency(worksheet.bonus_amount)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t pt-2 mt-2">
              <span>Gross Payable</span>
              <span className="text-green-700">{formatCurrency(worksheet.gross_payable_earnings)}</span>
            </div>
          </div>
        </div>

        {/* Deductions */}
        <div className="border rounded-lg p-4">
          <h4 className="font-semibold text-red-700 mb-3">Deductions</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Notice Period Recovery ({worksheet.notice_period_shortfall_days} days)</span>
              <span>{formatCurrency(worksheet.notice_period_recovery_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Asset Recovery</span>
              <span>{formatCurrency(worksheet.total_asset_recovery_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Other Deductions</span>
              <span>{formatCurrency(worksheet.other_deductions)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t pt-2 mt-2">
              <span>Total Deductions</span>
              <span className="text-red-700">{formatCurrency(worksheet.total_deductions)}</span>
            </div>
          </div>
        </div>

        {/* Net Payable */}
        <div className={`p-4 rounded-lg ${worksheet.is_negative_settlement ? 'bg-red-100' : 'bg-green-100'}`}>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-lg">Net Settlement</span>
            <span className={`text-2xl font-bold ${worksheet.net_payable >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(worksheet.net_payable)}
            </span>
          </div>
          {worksheet.is_negative_settlement && (
            <p className="text-sm text-red-600 mt-2">This is a negative settlement. Amount to be recovered from employee.</p>
          )}
        </div>

        {/* Calculation Breakdown */}
        {worksheet.calculation_breakdown && Object.keys(worksheet.calculation_breakdown).length > 0 && (
          <details className="group">
            <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-blue-600">
              View Calculation Breakdown
            </summary>
            <div className="mt-2 bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto">
              <pre className="text-xs">{JSON.stringify(worksheet.calculation_breakdown, null, 2)}</pre>
            </div>
          </details>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
