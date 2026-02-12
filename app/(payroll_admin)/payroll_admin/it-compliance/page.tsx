'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Loader from '@/components/ui/Loader';
import Modal from '@/components/Modal';
import Tabs from '@/components/Tabs';

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================

interface Challan {
  id: number;
  challan_serial_number: string;
  financial_year: string;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  total_tds_amount: number;
  total_amount_paid: number;
  status: 'DRAFT' | 'GENERATED' | 'PAID' | 'FAILED';
  cin_number?: string;
  bsr_code?: string;
  challan_date: string;
  employee_count: number;
}

interface Form16 {
  id: number;
  certificate_number: string;
  user_id: string; // Ideally enriched with name
  financial_year: string;
  total_tax_computed: number;
  is_released_to_employee: boolean;
  generated_at: string;
  pdf_file_path?: string;
}

// ============================================================================
// 2. CONFIGURATION CONSTANTS
// ============================================================================
const CONFIGS = {
  // Read Configs
  READ_CHALLANS: '7c21e597-01da-4eb8-baa5-67fbfe57428f', // wcm-it-read-challans
  READ_FORM16: 'c5baec2c-f819-4440-99d0-98333ebe9919',    // wcm-it-read-form16

  // Gateway Actions
  GENERATE_CHALLAN: 'it-func-gen-challan-001',
  MARK_PAID: 'it-func-mark-challan-paid-001',
  GENERATE_FORM16: 'it-func-bulk-form16-001'
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
export default function ComplianceHubPage() {
  const { session } = useSessionContext();
  const accessToken = session?.access_token;

  // --- State ---
  const [activeTab, setActiveTab] = useState('TDS Challans');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data State
  const [challans, setChallans] = useState<Challan[]>([]);
  const [form16s, setForm16s] = useState<Form16[]>([]);
  const [financialYear, setFinancialYear] = useState('FY2025-26');

  // Modal State (Challan)
  const [isChallanModalOpen, setIsChallanModalOpen] = useState(false);
  const [challanQuarter, setChallanQuarter] = useState('Q1');
  
  // Modal State (Payment)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedChallan, setSelectedChallan] = useState<Challan | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    cin: '',
    date: new Date().toISOString().split('T')[0],
    mode: 'ONLINE',
    ref: ''
  });

  // ==========================
  // FETCH DATA
  // ==========================
  const fetchChallans = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await callGateway('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_CHALLANS,
        params: {
          filters: { financial_year: financialYear },
          orderBy: [['created_at', 'DESC']]
        }
      }, accessToken);
      setChallans(res.data || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [accessToken, financialYear]);

  const fetchForm16s = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await callGateway('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_FORM16,
        params: {
          filters: { financial_year: financialYear },
          orderBy: [['certificate_number', 'ASC']],
          limit: 100
        },
        p_enrich_with_employee_details: true // Get names
      }, accessToken);
      setForm16s(res.data || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [accessToken, financialYear]);

  useEffect(() => {
    if (activeTab === 'TDS Challans') fetchChallans();
    else fetchForm16s();
  }, [activeTab, fetchChallans, fetchForm16s]);

  // ==========================
  // ACTIONS: CHALLAN
  // ==========================
  const handleGenerateChallan = async () => {
    setActionLoading(true);
    try {
      await callGateway('/api/a_crud_universal_pg_function_gateway', {
        config_id: CONFIGS.GENERATE_CHALLAN,
        params: {
          p_tenant_id: session!.user.user_metadata.tenant_id,
          p_financial_year: financialYear,
          p_quarter: challanQuarter,
          p_created_by: session!.user.id
        }
      }, accessToken!);
      
      setIsChallanModalOpen(false);
      fetchChallans();
      alert('Challan Generated Successfully');
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(false); }
  };

  const handleMarkPaid = async () => {
    if (!selectedChallan) return;
    setActionLoading(true);
    try {
      await callGateway('/api/a_crud_universal_pg_function_gateway', {
        config_id: CONFIGS.MARK_PAID,
        params: {
          p_challan_id: selectedChallan.id,
          p_cin_number: paymentForm.cin,
          p_payment_date: paymentForm.date,
          p_payment_mode: paymentForm.mode,
          p_payment_reference: paymentForm.ref
        }
      }, accessToken!);

      setIsPaymentModalOpen(false);
      setSelectedChallan(null);
      fetchChallans();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(false); }
  };

  // ==========================
  // ACTIONS: FORM 16
  // ==========================
  const handleBulkGenerateForm16 = async () => {
    if (!confirm('This will generate Form 16s for ALL eligible employees for ' + financialYear + '. Continue?')) return;
    setActionLoading(true);
    try {
      const res = await callGateway('/api/a_crud_universal_pg_function_gateway', {
        config_id: CONFIGS.GENERATE_FORM16,
        params: {
          p_tenant_id: session!.user.user_metadata.tenant_id,
          p_financial_year: financialYear,
          p_generated_by: session!.user.id
        }
      }, accessToken!);

      alert(res.message || 'Bulk generation queued successfully.');
      fetchForm16s();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(false); }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-3xl font-bold text-gray-800">Compliance Hub</h1>
           <p className="text-gray-500">Manage TDS Payments and Tax Certificates</p>
        </div>
        <div className="flex gap-2">
            <select 
                className="border rounded p-2 text-sm"
                value={financialYear}
                onChange={e => setFinancialYear(e.target.value)}
            >
                <option>FY2025-26</option>
                <option>FY2024-25</option>
            </select>
        </div>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

      <Tabs>
        
        {/* TAB 1: TDS CHALLANS */}
        <Tabs.Tab label="TDS Challans" isActive={activeTab === 'TDS Challans'} onClick={() => setActiveTab('TDS Challans')}>
             <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between mb-4">
                    <h2 className="text-lg font-semibold">Payment History</h2>
                    <Button onClick={() => setIsChallanModalOpen(true)}>+ Generate Quarterly Challan</Button>
                </div>
                
                {loading ? <Loader /> : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left">Quarter</th>
                                    <th className="px-4 py-3 text-left">Challan Serial</th>
                                    <th className="px-4 py-3 text-right">TDS Amount</th>
                                    <th className="px-4 py-3 text-right">Employees</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {challans.map(c => (
                                    <tr key={c.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-bold">{c.quarter}</td>
                                        <td className="px-4 py-3 font-mono">{c.challan_serial_number}</td>
                                        <td className="px-4 py-3 text-right font-medium">₹{c.total_tds_amount?.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right">{c.employee_count}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                c.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {c.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {c.status !== 'PAID' && (
                                                <Button size="sm" onClick={() => { setSelectedChallan(c); setIsPaymentModalOpen(true); }}>
                                                    Mark Paid
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {challans.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-500">No challans found.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
             </div>
        </Tabs.Tab>

        {/* TAB 2: FORM 16 */}
        <Tabs.Tab label="Form 16 Issuance" isActive={activeTab === 'Form 16 Issuance'} onClick={() => setActiveTab('Form 16 Issuance')}>
             <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between mb-4">
                    <h2 className="text-lg font-semibold">Generated Certificates</h2>
                    <Button variant="secondary" onClick={handleBulkGenerateForm16} isLoading={actionLoading}>
                        Run Bulk Generation
                    </Button>
                </div>

                {loading ? <Loader /> : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left">Certificate No.</th>
                                    <th className="px-4 py-3 text-left">Employee ID</th>
                                    <th className="px-4 py-3 text-right">Tax Computed</th>
                                    <th className="px-4 py-3 text-center">Released?</th>
                                    <th className="px-4 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {form16s.map(f => (
                                    <tr key={f.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-mono">{f.certificate_number}</td>
                                        <td className="px-4 py-3">{f.user_id}</td>
                                        <td className="px-4 py-3 text-right">₹{f.total_tax_computed?.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-center">
                                            {f.is_released_to_employee ? '✅' : '❌'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <a href="#" className="text-blue-600 hover:underline text-xs">Download PDF</a>
                                        </td>
                                    </tr>
                                ))}
                                {form16s.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-500">No certificates generated yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
             </div>
        </Tabs.Tab>

      </Tabs>

      {/* GENERATE CHALLAN MODAL */}
      {isChallanModalOpen && (
        <Modal isOpen={true} onClose={() => setIsChallanModalOpen(false)} title="Generate TDS Challan">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Financial Year</label>
                    <Input value={financialYear} disabled />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Select Quarter</label>
                    <select 
                        className="w-full border rounded p-2"
                        value={challanQuarter}
                        onChange={e => setChallanQuarter(e.target.value)}
                    >
                        <option value="Q1">Q1 (Apr - Jun)</option>
                        <option value="Q2">Q2 (Jul - Sep)</option>
                        <option value="Q3">Q3 (Oct - Dec)</option>
                        <option value="Q4">Q4 (Jan - Mar)</option>
                    </select>
                </div>
                <div className="bg-yellow-50 p-3 text-sm text-yellow-800 rounded">
                    This will aggregate all TDS deducted in the selected quarter and create a challan entry.
                </div>
                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="ghost" onClick={() => setIsChallanModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleGenerateChallan} isLoading={actionLoading}>Generate</Button>
                </div>
            </div>
        </Modal>
      )}

      {/* PAYMENT MODAL */}
      {isPaymentModalOpen && selectedChallan && (
        <Modal isOpen={true} onClose={() => setIsPaymentModalOpen(false)} title="Record Payment Details">
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded text-sm">
                    <div>
                        <span className="text-gray-500">Challan No:</span>
                        <p className="font-mono">{selectedChallan.challan_serial_number}</p>
                    </div>
                    <div>
                        <span className="text-gray-500">Amount Due:</span>
                        <p className="font-bold">₹{selectedChallan.total_amount_paid?.toLocaleString()}</p>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">CIN Number (17 chars)</label>
                    <Input 
                        value={paymentForm.cin} 
                        onChange={e => setPaymentForm({...paymentForm, cin: e.target.value})} 
                        maxLength={17}
                        placeholder="e.g. 00000000000000000"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Payment Date</label>
                    <Input 
                        type="date" 
                        value={paymentForm.date} 
                        onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Bank Reference / Ref No.</label>
                    <Input 
                        value={paymentForm.ref} 
                        onChange={e => setPaymentForm({...paymentForm, ref: e.target.value})} 
                    />
                </div>

                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="ghost" onClick={() => setIsPaymentModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleMarkPaid} isLoading={actionLoading}>Confirm Payment</Button>
                </div>
            </div>
        </Modal>
      )}
    </div>
  );
}