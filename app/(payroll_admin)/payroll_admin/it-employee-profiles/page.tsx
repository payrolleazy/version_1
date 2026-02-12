'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Loader from '@/components/ui/Loader';
import Tabs from '@/components/Tabs';
import Modal from '@/components/Modal';

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================

interface EmployeeSummary {
  user_id: string;
  employee_name: string;
  employee_code: string;
  selected_regime: 'OLD_REGIME' | 'NEW_REGIME';
  is_regime_locked: boolean;
  total_tds_ytd: number;
}

interface TaxProfileDetail {
  id: number;
  user_id: string;
  selected_regime: string;
  is_regime_locked: boolean;
  previous_employer_details: {
    employers: Array<{
      employer_name: string;
      gross_salary: number;
      tds_deducted: number;
    }>;
    total_gross_salary: number;
    total_tds_deducted: number;
  };
}

interface Perquisite {
  id: number;
  perquisite_type: string;
  description: string;
  taxable_value: number;
  effective_from: string;
  is_verified: boolean;
}

// ============================================================================
// 2. CONFIGURATION CONSTANTS
// ============================================================================
const CONFIGS = {
  // Reads
  READ_EMP_LIST: '7c259bc4-ca5e-451d-92b4-fb642f9672b7', // Using MV for list (has names)
  READ_PROFILE_DETAIL: 'a68f5a57-0b78-40bc-bbdc-e35e4efd6dea', // Detailed tax profile
  READ_PERQUISITES: 'b937454b-af89-4b74-9309-d6d78bc7b15d',

  // Actions
  CHANGE_REGIME: 'it-func-change-regime-001',
  COMPARE_REGIMES: 'it-func-compare-regime-001',
  IMPORT_PREV_EMP: 'it-func-import-prev-emp-001',
  
  // Note: For Perquisite Insert, we use generic bulk upsert as no specific RPC was in the list,
  // targeting 'wcm_it_perquisites_register' directly.
  UPSERT_PERQUISITE: 'wcm-it-upsert-perquisite' // Placeholder config ID for bulk upsert
};

// ============================================================================
// 3. HELPER: GENERIC API CALLER
// ============================================================================
async function callGateway(endpoint: string, payload: any, token: string) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, accessToken: token }),
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
export default function EmployeeProfilesPage() {
  const { session } = useSessionContext();
  const accessToken = session?.access_token;

  // --- State: List View ---
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [financialYear, setFinancialYear] = useState('FY2025-26');

  // --- State: Detail View (Selected Employee) ---
  const [selectedEmp, setSelectedEmp] = useState<EmployeeSummary | null>(null);
  const [profileDetail, setProfileDetail] = useState<TaxProfileDetail | null>(null);
  const [perquisites, setPerquisites] = useState<Perquisite[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // --- State: Modals & Actions ---
  const [compareResult, setCompareResult] = useState<any>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showPrevEmpModal, setShowPrevEmpModal] = useState(false);
  const [showPerqModal, setShowPerqModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forms
  const [prevEmpForm, setPrevEmpForm] = useState({ employer_name: '', gross_salary: 0, tds_deducted: 0, pf_employee_contribution: 0 });
  const [perqForm, setPerqForm] = useState({ type: 'MOTOR_CAR', description: '', taxable_value: 0, effective_from: new Date().toISOString().split('T')[0] });

  // ==========================
  // FETCH LIST
  // ==========================
  const fetchEmployeeList = useCallback(async () => {
    if (!accessToken) return;
    setLoadingList(true);
    try {
      // Using the Materialized View because it has joined names/codes
      const res = await callGateway('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_EMP_LIST,
        params: { 
          filters: { financial_year: financialYear },
          orderBy: [['employee_name', 'ASC']],
          limit: 100
        }
      }, accessToken);
      setEmployees(res.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingList(false);
    }
  }, [accessToken, financialYear]);

  useEffect(() => {
    if (accessToken) fetchEmployeeList();
  }, [accessToken, fetchEmployeeList]);

  // ==========================
  // FETCH DETAILS (When User Selected)
  // ==========================
  const fetchDetails = async (emp: EmployeeSummary) => {
    setLoadingDetail(true);
    setSelectedEmp(emp);
    setError(null);
    try {
      const [profRes, perqRes] = await Promise.all([
        callGateway('/api/a_crud_universal_read', {
          config_id: CONFIGS.READ_PROFILE_DETAIL,
          params: { filters: { user_id: emp.user_id, financial_year: financialYear } }
        }, accessToken!),
        callGateway('/api/a_crud_universal_read', {
          config_id: CONFIGS.READ_PERQUISITES,
          params: { filters: { user_id: emp.user_id, financial_year: financialYear } }
        }, accessToken!)
      ]);

      setProfileDetail(profRes.data?.[0] || null);
      setPerquisites(perqRes.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  // ==========================
  // ACTIONS
  // ==========================
  
  // 1. Change Regime
  const handleChangeRegime = async (newRegime: string) => {
    if (!selectedEmp || !accessToken) return;
    if (!confirm(`Are you sure you want to switch ${selectedEmp.employee_name} to ${newRegime}? This will trigger a tax recalculation.`)) return;

    setActionLoading(true);
    try {
      await callGateway('/api/a_crud_universal_pg_function_gateway', {
        config_id: CONFIGS.CHANGE_REGIME,
        params: {
          user_id: selectedEmp.user_id,
          tenant_id: selectedEmp.tenant_id,
          financial_year: financialYear,
          new_regime: newRegime,
          reason: 'Admin Override'
        }
      }, accessToken);
      
      // Refresh
      await fetchEmployeeList();
      await fetchDetails(selectedEmp); // Refresh details to show lock/unlock status if changed
      alert('Regime changed successfully.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Compare Regimes
  const handleCompareRegimes = async () => {
    if (!selectedEmp || !accessToken) return;
    setActionLoading(true);
    try {
      const res = await callGateway('/api/a_crud_universal_pg_function_gateway', {
        config_id: CONFIGS.COMPARE_REGIMES,
        params: {
          user_id: selectedEmp.user_id,
          tenant_id: selectedEmp.tenant_id,
          financial_year: financialYear
        }
      }, accessToken);
      setCompareResult(res);
      setShowCompareModal(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Save Previous Employer
  const handleSavePrevEmployer = async () => {
    if (!selectedEmp || !accessToken) return;
    setActionLoading(true);
    try {
      await callGateway('/api/a_crud_universal_pg_function_gateway', {
        config_id: CONFIGS.IMPORT_PREV_EMP,
        params: {
          user_id: selectedEmp.user_id,
          tenant_id: selectedEmp.tenant_id,
          financial_year: financialYear,
          previous_employer_data: prevEmpForm
        }
      }, accessToken);
      
      setShowPrevEmpModal(false);
      fetchDetails(selectedEmp);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Add Perquisite (Using Generic Bulk Upsert as specific RPC wasn't in config list)
  const handleAddPerquisite = async () => {
    if (!selectedEmp || !accessToken) return;
    setActionLoading(true);
    try {
      await callGateway('/api/a_crud_universal_bulk_upsert', {
        config_id: CONFIGS.UPSERT_PERQUISITE, // Assuming this is set up or we use generic table upsert
        target_table_name: 'wcm_it_perquisites_register', // Explicit table if using generic endpoint
        conflict_columns: ['id'], // ID autogenerated, usually handled by omission for insert
        input_rows: [{
          tenant_id: selectedEmp.tenant_id,
          user_id: selectedEmp.user_id,
          financial_year: financialYear,
          perquisite_type: perqForm.type,
          description: perqForm.description,
          taxable_value: Number(perqForm.taxable_value),
          effective_from: perqForm.effective_from,
          is_active: true,
          is_verified: true, // Admin entered
          // Dummy logic for now, real calculation happens via wcm_it_value_* functions
          valuation_method: 'MANUAL_ENTRY'
        }]
      }, accessToken);

      setShowPerqModal(false);
      fetchDetails(selectedEmp);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredEmployees = employees.filter(e => 
    e.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.employee_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 bg-gray-50 min-h-screen font-sans flex flex-col h-screen">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-3xl font-bold text-gray-800">Employee Tax Profiles</h1>
           <p className="text-gray-500">Manage Tax Regimes, Previous Employment & Perquisites</p>
        </div>
        <div className="w-48">
             <label className="text-xs text-gray-500">Financial Year</label>
             <Input value={financialYear} onChange={e => setFinancialYear(e.target.value)} />
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded relative">
          {error}
          <button onClick={() => setError(null)} className="absolute top-0 right-0 p-4 font-bold">×</button>
        </div>
      )}

      {/* MAIN CONTENT SPLIT */}
      <div className="flex flex-1 gap-6 overflow-hidden">
        
        {/* LEFT: EMPLOYEE LIST */}
        <div className="w-1/3 bg-white rounded-lg shadow flex flex-col">
          <div className="p-4 border-b">
            <Input 
              placeholder="Search employees..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="p-4"><Loader /></div>
            ) : filteredEmployees.length === 0 ? (
              <div className="p-4 text-gray-500 text-center">No employees found.</div>
            ) : (
              <div className="divide-y">
                {filteredEmployees.map(emp => (
                  <div 
                    key={emp.user_id}
                    onClick={() => fetchDetails(emp)}
                    className={`p-4 cursor-pointer hover:bg-blue-50 transition-colors ${selectedEmp?.user_id === emp.user_id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-800">{emp.employee_name}</p>
                        <p className="text-xs text-gray-500">{emp.employee_code}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${emp.selected_regime === 'NEW_REGIME' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                        {emp.selected_regime === 'NEW_REGIME' ? 'New' : 'Old'}
                      </span>
                    </div>
                    {emp.is_regime_locked && <p className="text-xs text-red-500 mt-1">🔒 Locked</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: DETAIL VIEW */}
        <div className="w-2/3 bg-white rounded-lg shadow flex flex-col p-6 overflow-y-auto">
          {!selectedEmp ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              Select an employee to view details
            </div>
          ) : loadingDetail ? (
            <Loader />
          ) : (
            <>
              <div className="flex justify-between items-start mb-6">
                <div>
                   <h2 className="text-2xl font-bold">{selectedEmp.employee_name}</h2>
                   <p className="text-gray-500">{selectedEmp.employee_code}</p>
                </div>
                <Button onClick={handleCompareRegimes} variant="outline" isLoading={actionLoading}>
                   📊 Compare Regimes
                </Button>
              </div>

              <Tabs>
                {/* TAB 1: REGIME */}
                <Tabs.Tab label="Tax Regime">
                  <div className="p-4 space-y-6">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <h3 className="font-semibold text-blue-900 mb-2">Current Selection</h3>
                      <div className="flex items-center justify-between">
                        <p className="text-lg">{profileDetail?.selected_regime || selectedEmp.selected_regime}</p>
                        <div className="flex gap-2">
                           <Button 
                             size="sm" 
                             variant={selectedEmp.selected_regime === 'OLD_REGIME' ? 'secondary' : 'primary'}
                             onClick={() => handleChangeRegime('NEW_REGIME')}
                             disabled={selectedEmp.selected_regime === 'NEW_REGIME' || actionLoading}
                           >
                             Switch to New
                           </Button>
                           <Button 
                             size="sm"
                             variant={selectedEmp.selected_regime === 'NEW_REGIME' ? 'secondary' : 'primary'}
                             onClick={() => handleChangeRegime('OLD_REGIME')}
                             disabled={selectedEmp.selected_regime === 'OLD_REGIME' || actionLoading}
                           >
                             Switch to Old
                           </Button>
                        </div>
                      </div>
                      {selectedEmp.is_regime_locked && (
                         <p className="text-xs text-red-600 mt-2">
                           Note: Regime is locked because TDS has already been deducted this year. Admin override will trigger a recalculation/adjustment in the next payroll.
                         </p>
                      )}
                    </div>
                  </div>
                </Tabs.Tab>

                {/* TAB 2: PREVIOUS EMPLOYER */}
                <Tabs.Tab label="Previous Employer">
                   <div className="p-4">
                      <div className="flex justify-between mb-4">
                        <h3 className="font-semibold text-gray-700">Salary from Previous Employment</h3>
                        <Button size="sm" onClick={() => setShowPrevEmpModal(true)}>+ Add Details</Button>
                      </div>
                      
                      {profileDetail?.previous_employer_details?.employers?.length ? (
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left">Employer</th>
                              <th className="px-4 py-2 text-right">Gross Salary</th>
                              <th className="px-4 py-2 text-right">TDS Deducted</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profileDetail.previous_employer_details.employers.map((prev, idx) => (
                              <tr key={idx} className="border-t">
                                <td className="px-4 py-2">{prev.employer_name}</td>
                                <td className="px-4 py-2 text-right">₹{prev.gross_salary}</td>
                                <td className="px-4 py-2 text-right">₹{prev.tds_deducted}</td>
                              </tr>
                            ))}
                            <tr className="bg-gray-50 font-semibold border-t">
                              <td className="px-4 py-2">Total</td>
                              <td className="px-4 py-2 text-right">₹{profileDetail.previous_employer_details.total_gross_salary}</td>
                              <td className="px-4 py-2 text-right">₹{profileDetail.previous_employer_details.total_tds_deducted}</td>
                            </tr>
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-gray-500 text-sm">No previous employer data found.</p>
                      )}
                   </div>
                </Tabs.Tab>

                {/* TAB 3: PERQUISITES */}
                <Tabs.Tab label="Perquisites">
                   <div className="p-4">
                      <div className="flex justify-between mb-4">
                        <h3 className="font-semibold text-gray-700">Taxable Perquisites</h3>
                        <Button size="sm" onClick={() => setShowPerqModal(true)}>+ Add Perquisite</Button>
                      </div>
                      
                      {perquisites.length > 0 ? (
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left">Type</th>
                              <th className="px-4 py-2 text-left">Description</th>
                              <th className="px-4 py-2 text-right">Taxable Value</th>
                              <th className="px-4 py-2 text-left">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {perquisites.map((p) => (
                              <tr key={p.id} className="border-t">
                                <td className="px-4 py-2">{p.perquisite_type.replace('_', ' ')}</td>
                                <td className="px-4 py-2">{p.description}</td>
                                <td className="px-4 py-2 text-right font-medium">₹{p.taxable_value}</td>
                                <td className="px-4 py-2">
                                  <span className={`px-2 py-1 rounded text-xs ${p.is_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {p.is_verified ? 'Verified' : 'Pending'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                         <p className="text-gray-500 text-sm">No perquisites assigned.</p>
                      )}
                   </div>
                </Tabs.Tab>
              </Tabs>
            </>
          )}
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* Compare Modal */}
      {showCompareModal && compareResult && (
        <Modal isOpen={true} onClose={() => setShowCompareModal(false)} title="Regime Comparison Analysis">
            <div className="p-4 grid grid-cols-2 gap-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-bold text-lg mb-2">Old Regime</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>Annual Tax:</span> <span className="font-mono">{compareResult.old_regime.annual_tax}</span></div>
                        <div className="flex justify-between"><span>Deductions:</span> <span className="font-mono">{compareResult.old_regime.deductions}</span></div>
                    </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="font-bold text-lg mb-2">New Regime</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>Annual Tax:</span> <span className="font-mono">{compareResult.new_regime.annual_tax}</span></div>
                        <div className="flex justify-between"><span>Exemptions:</span> <span className="font-mono">{compareResult.new_regime.exemptions}</span></div>
                    </div>
                </div>
            </div>
            <div className="p-4 bg-green-50 border-t border-green-200 mt-2">
                <p className="text-green-800 font-semibold">Recommendation: {compareResult.recommendation.regime.replace('_', ' ')}</p>
                <p className="text-sm text-green-700">{compareResult.recommendation.reason}</p>
                <p className="text-sm mt-1">Projected Savings: <span className="font-bold">₹{compareResult.recommendation.tax_difference}</span></p>
            </div>
            <div className="flex justify-end p-4">
                <Button onClick={() => setShowCompareModal(false)}>Close</Button>
            </div>
        </Modal>
      )}

      {/* Previous Employer Modal */}
      {showPrevEmpModal && (
        <Modal isOpen={true} onClose={() => setShowPrevEmpModal(false)} title="Add Previous Employer Data">
            <div className="p-4 space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Employer Name</label>
                    <Input value={prevEmpForm.employer_name} onChange={e => setPrevEmpForm({...prevEmpForm, employer_name: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Gross Salary (Before Exemptions)</label>
                    <Input type="number" value={prevEmpForm.gross_salary} onChange={e => setPrevEmpForm({...prevEmpForm, gross_salary: Number(e.target.value)})} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">TDS Deducted</label>
                    <Input type="number" value={prevEmpForm.tds_deducted} onChange={e => setPrevEmpForm({...prevEmpForm, tds_deducted: Number(e.target.value)})} />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="ghost" onClick={() => setShowPrevEmpModal(false)}>Cancel</Button>
                    <Button onClick={handleSavePrevEmployer} isLoading={actionLoading}>Save & Recalculate</Button>
                </div>
            </div>
        </Modal>
      )}

      {/* Add Perquisite Modal */}
      {showPerqModal && (
        <Modal isOpen={true} onClose={() => setShowPerqModal(false)} title="Add Perquisite">
            <div className="p-4 space-y-4">
                 <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select 
                        className="w-full border rounded p-2"
                        value={perqForm.type}
                        onChange={e => setPerqForm({...perqForm, type: e.target.value})}
                    >
                        <option value="MOTOR_CAR">Motor Car</option>
                        <option value="RENT_FREE_ACCOMMODATION">Rent Free Accommodation</option>
                        <option value="INTEREST_FREE_LOAN">Interest Free Loan</option>
                        <option value="OTHER">Other</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <Input value={perqForm.description} onChange={e => setPerqForm({...perqForm, description: e.target.value})} placeholder="e.g. Honda City (Company Leased)" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Taxable Value (Annual)</label>
                    <Input type="number" value={perqForm.taxable_value} onChange={e => setPerqForm({...perqForm, taxable_value: Number(e.target.value)})} />
                    <p className="text-xs text-gray-500">Calculate this based on Rule 3 valuation</p>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="ghost" onClick={() => setShowPerqModal(false)}>Cancel</Button>
                    <Button onClick={handleAddPerquisite} isLoading={actionLoading}>Save</Button>
                </div>
            </div>
        </Modal>
      )}

    </div>
  );
}