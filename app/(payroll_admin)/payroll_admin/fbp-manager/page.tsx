'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Tabs from '@/components/Tabs';

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================

// Payroll Component (For Dropdown)
interface PayrollComponent {
  id: string;
  component_code: string;
  name: string;
  is_active: boolean;
}

// FBP Benefit (Tab 1 Data)
interface FbpBenefit {
  id?: string;
  benefit_code: string;
  benefit_name: string;
  category: string;
  tax_section: string;
  limit_config: {
    per_month?: { max_amount: number };
    per_year?: { max_amount: number };
  };
  reimbursement_rules: {
    requires_bill: boolean;
    approval_required: boolean;
  };
  is_active: boolean;
}

// FBP Policy (Tab 2 Master)
interface FbpPolicy {
  id?: string;
  policy_code: string;
  policy_name: string;
  description: string;
  total_annual_limit: number;
  is_active: boolean;
}

// Policy-Benefit Mapping (Tab 2 Detail)
interface PolicyBenefitLink {
  id?: string;
  policy_id: string;
  benefit_id: string;
  default_annual_limit: number;
  is_mandatory: boolean;
  benefit_name?: string;
  benefit_code?: string; 
}

// --- New Types from Operations Page ---
interface Declaration {
  id: string;
  declaration_code: string;
  user_id: string;
  financial_year: string;
  status: string;
  total_declared_amount: number;
}

interface DeclarationItem {
  id: string;
  benefit_id: string;
  declared_annual_amount: number;
  benefit_name?: string;
}

interface Claim {
  id: string;
  claim_code: string;
  expense_date: string;
  claimed_amount: number;
  status: string;
  merchant_name?: string;
}

interface ClaimDoc {
  file_path: string;
  file_name: string;
}

interface BenefitMaster {
  id: string;
  benefit_name: string;
}


// ============================================================================
// 2. CONFIGURATION CONSTANTS (Gateway IDs)
// ============================================================================

const CONFIGS = {
  // Tab 1: Benefits
  READ_BENEFITS: 'ff5b1c8f-cced-46b4-8cad-828ddc203efa',
  UPSERT_BENEFITS: 'bd10d2d1-e505-45c7-a16a-b1ebf9e4e32c',
  READ_PAYROLL_COMPS: '0872c31a-89cb-4b33-bff6-b5b3e954a705',

  // Tab 2: Policies
  READ_POLICIES: 'b0bfe490-6814-4c47-8f8e-9b0cd6975960',
  UPSERT_POLICIES: 'fadc27b4-941f-4f63-afc7-56872da6c0e4',
  
  // Tab 2: Mapping
  READ_POLICY_BENEFITS: '1566e0e6-2be9-4d08-b913-97057417f20a',
  MAP_POLICY_BENEFITS: 'c2ef7191-aafc-47dc-8a7b-8bb698ea2183',

  // Tab 3 & 4: Operations
  READ_DECLARATIONS: '02c88864-cbdb-4e0e-a83b-66d5ff9826c8',
  REVIEW_DECLARATION: 'wcm-fbp-review-declaration',
  READ_CLAIMS: '71c91c0b-5895-405e-8be4-fa471381a5d2',
  APPROVE_CLAIM: 'wcm-fbp-approve-claim',
  READ_DEC_ITEMS: '4f39b2a8-e700-4016-a423-d78597d62fde',
  READ_CLAIM_DOCS: '3b2f82f1-af36-4803-bf19-94b31bca1ae5'
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
    throw new Error(result.message || 'API Request Failed');
  }
  return result;
}

// ============================================================================
// 4. MAIN PAGE COMPONENT
// ============================================================================

export default function FbpConfigurationPage() {
  const { session } = useSessionContext();
  
  // --- Shared State ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Tab 1 State (Benefits) ---
  const [benefits, setBenefits] = useState<FbpBenefit[]>([]);
  const [payrollComps, setPayrollComps] = useState<PayrollComponent[]>([]);
  const [isBenefitModalOpen, setIsBenefitModalOpen] = useState(false);
  const [editingBenefit, setEditingBenefit] = useState<FbpBenefit | null>(null);

  // --- Tab 2 State (Policies) ---
  const [policies, setPolicies] = useState<FbpPolicy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<FbpPolicy | null>(null);
  const [linkedBenefits, setLinkedBenefits] = useState<PolicyBenefitLink[]>([]);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<FbpPolicy | null>(null);
  
  // --- Tab 3 & 4 State (Operations) ---
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [reviewDec, setReviewDec] = useState<Declaration | null>(null);
  const [reviewDecItems, setReviewDecItems] = useState<DeclarationItem[]>([]);
  const [auditClaim, setAuditClaim] = useState<Claim | null>(null);
  const [claimDoc, setClaimDoc] = useState<ClaimDoc | null>(null);


  // ==========================
  // DATA FETCHING METHODS
  // ==========================

  // 1. Fetch Payroll Components (For Dropdown)
  const fetchPayrollComponents = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await callGateway('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_PAYROLL_COMPS,
        params: { filters: { is_active: true }, limit: 1000 }
      }, session.access_token);
      setPayrollComps(res.data || []);
    } catch (e: any) { console.error(e); }
  }, [session]);

  // 2. Fetch FBP Benefits
  const fetchBenefits = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await callGateway('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_BENEFITS,
        params: { limit: 100 }
      }, session.access_token);
      setBenefits(res.data || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [session]);

  // 3. Fetch Policies
  const fetchPolicies = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await callGateway('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_POLICIES,
        params: { limit: 100 }
      }, session.access_token);
      setPolicies(res.data || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [session]);

  // 4. Fetch Linked Benefits for a Policy
  const fetchPolicyLinks = useCallback(async (policyId: string) => {
    if (!session?.access_token) return;
    try {
      const res = await callGateway('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_POLICY_BENEFITS,
        params: { filters: { policy_id: policyId }, limit: 100 }
      }, session.access_token);
      
      const rawLinks = res.data || [];
      const mergedLinks = rawLinks.map((link: any) => {
        const master = benefits.find(b => b.id === link.benefit_id);
        return { ...link, benefit_name: master?.benefit_name, benefit_code: master?.benefit_code };
      });
      setLinkedBenefits(mergedLinks);
    } catch (e: any) { setError(e.message); }
  }, [session, benefits]);

  // --- New Fetching Methods from Operations Page ---

  const fetchDeclarations = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await callGateway('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_DECLARATIONS,
        params: { 
          filters: { status: 'SUBMITTED' },
          orderBy: [['total_declared_amount', 'DESC']]
        }
      }, session.access_token);
      setDeclarations(res.data || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [session]);

  const fetchClaims = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await callGateway('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_CLAIMS,
        params: { 
          filters: { status: 'UPLOADED' },
          orderBy: [['expense_date', 'DESC']]
        }
      }, session.access_token);
      setClaims(res.data || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [session]);


  // Initial Load
  useEffect(() => {
    if (session) {
      fetchPayrollComponents();
      fetchBenefits();
      fetchPolicies();
      fetchDeclarations();
      fetchClaims();
    }
  }, [session, fetchPayrollComponents, fetchBenefits, fetchPolicies, fetchDeclarations, fetchClaims]);

  // When a policy is selected
  useEffect(() => {
    if (selectedPolicy && selectedPolicy.id) {
      fetchPolicyLinks(selectedPolicy.id);
    } else {
      setLinkedBenefits([]);
    }
  }, [selectedPolicy, fetchPolicyLinks]);


  // ==========================
  // WRITE OPERATIONS
  // ==========================

  const handleSaveBenefit = async (data: FbpBenefit) => {
    try {
      await callGateway('/api/a_crud_universal_bulk_upsert', {
        config_id: CONFIGS.UPSERT_BENEFITS,
        input_rows: [data]
      }, session!.access_token);
      setIsBenefitModalOpen(false);
      fetchBenefits();
    } catch (e: any) { setError(e.message); }
  };

  const handleSavePolicy = async (data: FbpPolicy) => {
    try {
      const { id, ...payload } = data; // Remove id from the payload
      await callGateway('/api/a_crud_universal_bulk_upsert', {
        config_id: CONFIGS.UPSERT_POLICIES,
        input_rows: [payload]
      }, session!.access_token);
      setIsPolicyModalOpen(false);
      fetchPolicies();
    } catch (e: any) { setError(e.message); }
  };

  const handleSaveMapping = async (policyId: string, newLinks: PolicyBenefitLink[]) => {
    if (!policyId) return;
    try {
      const payload = newLinks.map(link => ({
        policy_id: policyId,
        benefit_id: link.benefit_id,
        default_annual_limit: Number(link.default_annual_limit),
        is_mandatory: link.is_mandatory
      }));

      await callGateway('/api/a_crud_universal_bulk_upsert', {
        config_id: CONFIGS.MAP_POLICY_BENEFITS,
        input_rows: payload
      }, session!.access_token);
      
      fetchPolicyLinks(policyId);
      alert('Mappings saved successfully');
    } catch (e: any) { setError(e.message); }
  };

  // --- New Write Operations from Operations Page ---

  const openDeclarationReview = async (dec: Declaration) => {
    setReviewDec(dec);
    try {
      const res = await callGateway('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_DEC_ITEMS,
        params: { filters: { declaration_id: dec.id } }
      }, session!.access_token);
      
      const items = (res.data || []).map((item: any) => ({
        ...item,
        benefit_name: benefits.find(b => b.id === item.benefit_id)?.benefit_name || 'Unknown Benefit'
      }));
      setReviewDecItems(items);
    } catch (e: any) { setError(e.message); }
  };

  const openClaimAudit = async (claim: Claim) => {
    setAuditClaim(claim);
    setClaimDoc(null);
    try {
      const res = await callGateway('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_CLAIM_DOCS,
        params: { filters: { claim_id: claim.id } }
      }, session!.access_token);
      if (res.data && res.data.length > 0) {
        setClaimDoc(res.data[0]);
      }
    } catch (e: any) { setError(e.message); }
  };

  const handleDeclarationAction = async (action: 'APPROVE' | 'REJECT', comments: string) => {
    if (!reviewDec) return;
    try {
      await callGateway('/api/a_crud_universal_pg_function_gateway', {
        config_id: CONFIGS.REVIEW_DECLARATION,
        params: {
          p_params: {
            p_declaration_id: reviewDec.id,
            p_reviewer_id: session!.user.id,
            p_action: action,
            p_comments: comments
          }
        }
      }, session!.access_token);
      
      setReviewDec(null);
      fetchDeclarations();
      alert(`Declaration ${action}D successfully`);
    } catch (e: any) { setError(e.message); }
  };

  const handleClaimAction = async (action: 'APPROVE' | 'REJECT', approvedAmount: number, comments: string) => {
    if (!auditClaim) return;
    try {
      const finalAmount = action === 'REJECT' ? 0 : approvedAmount;
      
      await callGateway('/api/a_crud_universal_pg_function_gateway', {
        config_id: CONFIGS.APPROVE_CLAIM,
        params: {
          p_params: {
            p_claim_id: auditClaim.id,
            p_approver_id: session!.user.id,
            p_approved_amount: finalAmount,
            p_approval_level: 1,
            p_comments: comments
          }
        }
      }, session!.access_token);

      setAuditClaim(null);
      fetchClaims();
      alert(`Claim ${action}D`);
    } catch (e: any) { setError(e.message); }
  };


  if (!session) return <div className="p-10">Loading Session...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">FBP Administration Hub</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error} <button onClick={() => setError(null)} className="float-right font-bold">×</button>
          </div>
        )}

        <Tabs>
          
          {/* TAB 1: BENEFIT MASTER */}
          <Tabs.Tab label="Benefit Configuration">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-semibold">Benefit Catalogue</h2>
              <Button onClick={() => { setEditingBenefit(null); setIsBenefitModalOpen(true); }}>
                + Add New Benefit
              </Button>
            </div>
            
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tax Section</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Limits</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {benefits.map((b) => (
                    <tr key={b.id || b.benefit_code}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-600">{b.benefit_code}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{b.benefit_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{b.tax_section}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {b.limit_config?.per_year?.max_amount ? `Max: ₹${b.limit_config.per_year.max_amount}/yr` : 'No Limit'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-500 cursor-pointer hover:underline"
                          onClick={() => { setEditingBenefit(b); setIsBenefitModalOpen(true); }}>
                        Edit
                      </td>
                    </tr>
                  ))}
                  {benefits.length === 0 && <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No benefits defined.</td></tr>}
                </tbody>
              </table>
            </div>
          </Tabs.Tab>

          {/* TAB 2: POLICY MANAGER */}
          <Tabs.Tab label="Policy Manager">
            <div className="flex h-[600px] gap-6">
              <div className="w-1/3 border-r pr-4 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-700">Policies</h3>
                  <Button size="sm" onClick={() => { setEditingPolicy(null); setIsPolicyModalOpen(true); }}>New</Button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {policies.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => setSelectedPolicy(p)}
                      className={`p-3 rounded-md cursor-pointer border transition-colors ${
                        selectedPolicy?.id === p.id ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium">{p.policy_name}</div>
                      <div className="text-xs text-gray-500 font-mono">{p.policy_code}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-2/3 flex flex-col">
                {!selectedPolicy ? (
                  <div className="flex-1 flex items-center justify-center text-gray-400">Select a policy to configure</div>
                ) : (
                  <>
                    <div className="mb-4 border-b pb-4">
                      <h2 className="text-xl font-bold">{selectedPolicy.policy_name}</h2>
                      <p className="text-sm text-gray-600">{selectedPolicy.description || 'No description'}</p>
                      <div className="mt-2 flex gap-2">
                         <Button size="sm" variant="ghost" onClick={() => { setEditingPolicy(selectedPolicy); setIsPolicyModalOpen(true); }}>
                           Edit Header
                         </Button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <h4 className="font-semibold mb-2 text-sm uppercase text-gray-500">Benefit Mapping</h4>
                      <BenefitMappingTable 
                         allBenefits={benefits} 
                         linkedBenefits={linkedBenefits} 
                         onSave={(newLinks: PolicyBenefitLink[]) => handleSaveMapping(selectedPolicy.id!, newLinks)}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </Tabs.Tab>

          {/* TAB 3: DECLARATION APPROVAL QUEUE */}
          <Tabs.Tab label={`Approvals (${declarations.length})`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ref Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">FY</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {declarations.map(d => (
                    <tr key={d.id}>
                      <td className="px-6 py-4 text-sm font-mono text-blue-600">{d.declaration_code}</td>
                      <td className="px-6 py-4 text-sm">{d.financial_year}</td>
                      <td className="px-6 py-4 text-sm font-bold">₹{d.total_declared_amount}</td>
                      <td className="px-6 py-4">
                        <Button size="sm" onClick={() => openDeclarationReview(d)}>Review</Button>
                      </td>
                    </tr>
                  ))}
                  {declarations.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-500">No pending declarations</td></tr>}
                </tbody>
              </table>
            </div>
          </Tabs.Tab>

          {/* TAB 4: CLAIMS AUDIT QUEUE */}
          <Tabs.Tab label={`Claims Audit (${claims.length})`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Claim Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {claims.map(c => (
                    <tr key={c.id}>
                      <td className="px-6 py-4 text-sm font-mono">{c.claim_code}</td>
                      <td className="px-6 py-4 text-sm">{c.expense_date}</td>
                      <td className="px-6 py-4 text-sm font-bold">₹{c.claimed_amount}</td>
                      <td className="px-6 py-4">
                        <Button size="sm" variant="outline" onClick={() => openClaimAudit(c)}>Audit</Button>
                      </td>
                    </tr>
                  ))}
                  {claims.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-500">No pending claims</td></tr>}
                </tbody>
              </table>
            </div>
          </Tabs.Tab>

        </Tabs>
      </div>

      {/* MODALS */}
      <BenefitModal 
        isOpen={isBenefitModalOpen} 
        onClose={() => setIsBenefitModalOpen(false)} 
        initialData={editingBenefit}
        payrollComps={payrollComps}
        onSave={handleSaveBenefit}
      />

      <PolicyModal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
        initialData={editingPolicy}
        onSave={handleSavePolicy}
      />
      
      {/* --- New Modals from Operations Page --- */}
      {reviewDec && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-[600px] max-h-[90vh] flex flex-col">
            <h2 className="text-xl font-bold mb-2">Review Declaration: {reviewDec.declaration_code}</h2>
            <div className="flex-1 overflow-y-auto border rounded mb-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Benefit</th>
                    <th className="p-2 text-right">Declared (Yearly)</th>
                    <th className="p-2 text-right">Monthly Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewDecItems.map(item => (
                    <tr key={item.id} className="border-b">
                      <td className="p-2">{item.benefit_name}</td>
                      <td className="p-2 text-right font-medium">₹{item.declared_annual_amount}</td>
                      <td className="p-2 text-right text-gray-500">₹{Math.round(item.declared_annual_amount / 12)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold">
                    <td className="p-2">TOTAL</td>
                    <td className="p-2 text-right">₹{reviewDec.total_declared_amount}</td>
                    <td className="p-2 text-right">₹{Math.round(reviewDec.total_declared_amount / 12)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setReviewDec(null)}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDeclarationAction('REJECT', 'Admin rejected via console')}>Reject</Button>
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleDeclarationAction('APPROVE', 'Admin approved via console')}>Approve & Sync</Button>
            </div>
          </div>
        </div>
      )}

      {auditClaim && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-[800px] h-[600px] flex gap-4">
            <div className="w-1/2 bg-gray-100 rounded flex items-center justify-center border">
              {claimDoc ? (
                <div className="text-center p-4">
                  <p className="font-mono text-xs mb-2">{claimDoc.file_name}</p>
                  <a href="#" className="text-blue-600 underline">Download/View Proof</a>
                </div>
              ) : (
                <span className="text-gray-400">No document attached</span>
              )}
            </div>
            <div className="w-1/2 flex flex-col">
              <h2 className="text-xl font-bold mb-4">Audit Claim</h2>
              <div className="space-y-2 text-sm mb-6">
                <div className="flex justify-between"><span className="text-gray-500">Code:</span> <span>{auditClaim.claim_code}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Date:</span> <span>{auditClaim.expense_date}</span></div>
                <div className="flex justify-between border-t pt-2 mt-2"><span className="font-bold">Claimed:</span> <span className="font-bold text-lg">₹{auditClaim.claimed_amount}</span></div>
              </div>
              <div className="mt-auto space-y-3">
                <div>
                   <label className="text-xs font-semibold text-gray-500 uppercase">Approved Amount</label>
                   <Input type="number" defaultValue={auditClaim.claimed_amount} id="approvedAmountInput" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="w-full bg-red-600 hover:bg-red-700 text-white" onClick={() => handleClaimAction('REJECT', 0, 'Rejected by admin')}>Reject</Button>
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white" 
                    onClick={() => {
                       const val = (document.getElementById('approvedAmountInput') as HTMLInputElement).value;
                       handleClaimAction('APPROVE', Number(val), 'Approved');
                    }}>
                    Approve
                  </Button>
                </div>
                <Button variant="ghost" className="w-full" onClick={() => setAuditClaim(null)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 5. SUB-COMPONENTS (MODALS & TABLES)
// ============================================================================

function BenefitModal({ isOpen, onClose, initialData, payrollComps, onSave }: any) {
  const [formData, setFormData] = useState<any>({});
  
  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        max_monthly: initialData.limit_config?.per_month?.max_amount || 0,
        max_yearly: initialData.limit_config?.per_year?.max_amount || 0,
        requires_bill: initialData.reimbursement_rules?.requires_bill || false,
        approval_required: initialData.reimbursement_rules?.approval_required || false
      });
    } else {
      setFormData({ 
        is_active: true, 
        category: 'FOOD_BEVERAGE', 
        tax_section: 'SECTION_17',
        max_monthly: 0, max_yearly: 0, requires_bill: true, approval_required: true
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = () => {
    const payload: FbpBenefit = {
      ...formData,
      limit_config: {
        per_month: { max_amount: Number(formData.max_monthly) },
        per_year: { max_amount: Number(formData.max_yearly) }
      },
      reimbursement_rules: {
        requires_bill: formData.requires_bill,
        approval_required: formData.reimbursement_rules?.approval_required || false
      }
    };
    delete (payload as any).max_monthly;
    delete (payload as any).max_yearly;
    
    onSave(payload);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-[600px] max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">{initialData ? 'Edit' : 'Create'} Benefit</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Code (Payroll ID)</label>
            <select 
              className="w-full border rounded p-2"
              value={formData.benefit_code || ''}
              onChange={e => setFormData({...formData, benefit_code: e.target.value})}
              disabled={!!initialData}
            >
              <option value="">Select Component...</option>
              {payrollComps.map((c: any) => (
                <option key={c.id} value={c.component_code}>{c.component_code} - {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Benefit Name</label>
            <Input value={formData.benefit_name || ''} onChange={(e) => setFormData({...formData, benefit_name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select className="w-full border rounded p-2" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
              <option value="FOOD_BEVERAGE">Food & Beverage</option>
              <option value="FUEL_CONVEYANCE">Fuel & Conveyance</option>
              <option value="TELECOMMUNICATION">Telecommunication</option>
              <option value="BOOKS_PERIODICALS">Books & Periodicals</option>
              <option value="GADGETS_DEVICES">Gadgets</option>
              <option value="TRAVEL_LTA">LTA</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tax Section</label>
            <select className="w-full border rounded p-2" value={formData.tax_section || ''} onChange={e => setFormData({...formData, tax_section: e.target.value})}>
              <option value="SECTION_10">Section 10</option>
              <option value="SECTION_17">Section 17</option>
              <option value="SECTION_80C">Section 80C</option>
              <option value="SECTION_80D">Section 80D</option>
              <option value="NOT_APPLICABLE">Not Applicable</option>
            </select>
          </div>
          <div>
             <label className="block text-sm font-medium mb-1">Monthly Limit (₹)</label>
             <Input type="number" value={formData.max_monthly} onChange={(e) => setFormData({...formData, max_monthly: e.target.value})} />
          </div>
          <div>
             <label className="block text-sm font-medium mb-1">Yearly Limit (₹)</label>
             <Input type="number" value={formData.max_yearly} onChange={(e) => setFormData({...formData, max_yearly: e.target.value})} />
          </div>
        </div>
        <div className="flex gap-4 mb-6">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={formData.requires_bill} onChange={e => setFormData({...formData, requires_bill: e.target.checked})} />
            Requires Bill
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={formData.approval_required} onChange={e => setFormData({...formData, approval_required: e.target.checked})} />
            Approval Req
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
            Active
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>Save</Button>
        </div>
      </div>
    </div>
  );
}

function PolicyModal({ isOpen, onClose, initialData, onSave }: any) {
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    setFormData(initialData || { is_active: true });
  }, [initialData, isOpen]);

  const handleSubmit = () => {
    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-[400px]">
        <h2 className="text-xl font-bold mb-4">{initialData ? 'Edit' : 'Create'} Policy</h2>
        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Policy Code</label>
            <Input value={formData.policy_code || ''} onChange={(e) => setFormData({...formData, policy_code: e.target.value})} disabled={!!initialData} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Policy Name</label>
            <Input value={formData.policy_name || ''} onChange={(e) => setFormData({...formData, policy_name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <Input value={formData.description || ''} onChange={(e) => setFormData({...formData, description: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Total Annual Limit (Optional)</label>
            <Input type="number" value={formData.total_annual_limit || ''} onChange={(e) => setFormData({...formData, total_annual_limit: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Elected Tax Regime</label>
            <select
              className="w-full border rounded p-2"
              value={formData.elected_tax_regime || 'OLD_REGIME'}
              onChange={e => setFormData({...formData, elected_tax_regime: e.target.value})}
            >
              <option value="OLD_REGIME">Old Regime</option>
              <option value="NEW_REGIME">New Regime</option>
              <option value="BOTH">Both</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>Save Header</Button>
        </div>
      </div>
    </div>
  );
}

function BenefitMappingTable({ allBenefits, linkedBenefits, onSave }: any) {
  const [localLinks, setLocalLinks] = useState<any[]>([]);

  useEffect(() => {
    const rows = allBenefits.map((b: FbpBenefit) => {
      const existing = linkedBenefits.find((l: PolicyBenefitLink) => l.benefit_id === b.id);
      return {
        benefit_id: b.id,
        benefit_name: b.benefit_name,
        benefit_code: b.benefit_code,
        isSelected: !!existing,
        default_annual_limit: existing?.default_annual_limit || 0,
        is_mandatory: existing?.is_mandatory || false
      };
    });
    setLocalLinks(rows);
  }, [allBenefits, linkedBenefits]);

  const handleSave = () => {
    const toSave = localLinks
      .filter(l => l.isSelected)
      .map(l => ({
        policy_id: l.policy_id,
        benefit_id: l.benefit_id,
        default_annual_limit: Number(l.default_annual_limit),
        is_mandatory: l.is_mandatory
      }));
    onSave(toSave);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto border rounded">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left w-10"></th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Benefit</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 w-32">Override Limit</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 w-20">Mandatory</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {localLinks.map((row, idx) => (
              <tr key={row.benefit_id} className={row.isSelected ? 'bg-blue-50' : ''}>
                <td className="px-3 py-2">
                  <input 
                    type="checkbox" 
                    checked={row.isSelected} 
                    onChange={e => {
                      const copy = [...localLinks];
                      copy[idx].isSelected = e.target.checked;
                      setLocalLinks(copy);
                    }}
                  />
                </td>
                <td className="px-3 py-2">
                  <div>{row.benefit_name}</div>
                  <div className="text-xs text-gray-500">{row.benefit_code}</div>
                </td>
                <td className="px-3 py-2">
                  {row.isSelected && (
                    <input 
                      type="number" 
                      className="w-full border rounded px-2 py-1 text-xs"
                      placeholder="Default"
                      value={row.default_annual_limit}
                      onChange={e => {
                        const copy = [...localLinks];
                        copy[idx].default_annual_limit = e.target.value;
                        setLocalLinks(copy);
                      }}
                    />
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                   {row.isSelected && (
                    <input 
                      type="checkbox" 
                      checked={row.is_mandatory}
                      onChange={e => {
                        const copy = [...localLinks];
                        copy[idx].is_mandatory = e.target.checked;
                        setLocalLinks(copy);
                      }}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pt-4 text-right">
        <Button onClick={handleSave}>Save Configuration</Button>
      </div>
    </div>
  );
}