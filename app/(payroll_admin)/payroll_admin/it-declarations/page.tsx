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

interface DeclarationItem {
  component_code: string;
  declared_amount: number;
  proof_doc_ids: number[]; // Array of document IDs
  remarks?: string;
  // Verification fields (for local state)
  verified_amount?: number;
  verification_status?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  verification_remarks?: string;
}

interface Declaration {
  id: number;
  user_id: string;
  financial_year: string;
  status: 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'FROZEN';
  submitted_at: string;
  total_declared_amount: number;
  chapter_via_details: DeclarationItem[]; // Deductions (80C, etc)
  other_exemptions: DeclarationItem[];   // Exemptions (HRA, etc)
  house_property_details: any;
  employee_name?: string; // Enriched via join if available, or placeholder
}

// ============================================================================
// 2. CONFIGURATION CONSTANTS
// ============================================================================
const CONFIGS = {
  // Config ID: 2ba53cfc-4e45-4b56-ac31-73fe92356bbc
  READ_DECLARATIONS: 'it-read-declarations',
  
  // Gateway Action ID
  VERIFY_ACTION: 'it-verify-declaration' 
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
export default function DeclarationVerificationPage() {
  const { session } = useSessionContext();
  const accessToken = session?.access_token;

  // --- State ---
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedDeclaration, setSelectedDeclaration] = useState<Declaration | null>(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('SUBMITTED');
  const [financialYear, setFinancialYear] = useState('FY2025-26');

  // ==========================
  // FETCH DATA
  // ==========================
  const fetchDeclarations = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await callGateway('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_DECLARATIONS,
        params: {
          filters: { 
            financial_year: financialYear,
            status: filterStatus 
          },
          orderBy: [['submitted_at', 'ASC']], // FIFO queue
          limit: 50
        }
      }, accessToken);

      // Note: In a real app, we would join with 'profiles' to get names.
      // Assuming 'user_id' is available, we will display that for now.
      setDeclarations(res.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, financialYear, filterStatus]);

  useEffect(() => {
    if (accessToken) fetchDeclarations();
  }, [accessToken, fetchDeclarations]);

  // ==========================
  // HANDLERS
  // ==========================
  const openVerification = (decl: Declaration) => {
    setSelectedDeclaration(decl);
    setIsVerifyModalOpen(true);
  };

  const handleVerificationComplete = () => {
    setIsVerifyModalOpen(false);
    setSelectedDeclaration(null);
    fetchDeclarations(); // Refresh queue
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen font-sans">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-3xl font-bold text-gray-800">Declaration Verification (12BB)</h1>
           <p className="text-gray-500">Verify investment proofs submitted by employees</p>
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
            <select 
                className="border rounded p-2 text-sm"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
            >
                <option value="SUBMITTED">Pending Verification</option>
                <option value="VERIFIED">Verified</option>
                <option value="REJECTED">Rejected</option>
            </select>
            <Button variant="secondary" onClick={() => fetchDeclarations()} size="sm">Refresh</Button>
        </div>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

      {loading ? <Loader /> : (
        <div className="bg-white rounded-lg shadow border overflow-hidden">
             <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left font-medium text-gray-500">Employee ID</th>
                        <th className="px-6 py-3 text-left font-medium text-gray-500">FY</th>
                        <th className="px-6 py-3 text-left font-medium text-gray-500">Submitted Date</th>
                        <th className="px-6 py-3 text-right font-medium text-gray-500">Declared Amount</th>
                        <th className="px-6 py-3 text-center font-medium text-gray-500">Status</th>
                        <th className="px-6 py-3 text-center font-medium text-gray-500">Action</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {declarations.length === 0 ? (
                        <tr><td colSpan={6} className="p-6 text-center text-gray-500">No declarations found for this filter.</td></tr>
                    ) : declarations.map(d => (
                        <tr key={d.id} className="hover:bg-blue-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-xs">{d.user_id}</td>
                            <td className="px-6 py-4">{d.financial_year}</td>
                            <td className="px-6 py-4">{d.submitted_at ? new Date(d.submitted_at).toLocaleDateString() : '-'}</td>
                            <td className="px-6 py-4 text-right font-bold">₹{d.total_declared_amount?.toLocaleString()}</td>
                            <td className="px-6 py-4 text-center">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    d.status === 'SUBMITTED' ? 'bg-yellow-100 text-yellow-800' :
                                    d.status === 'VERIFIED' ? 'bg-green-100 text-green-800' : 
                                    'bg-red-100 text-red-800'
                                }`}>
                                    {d.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <Button size="sm" onClick={() => openVerification(d)}>
                                    {d.status === 'SUBMITTED' ? 'Verify' : 'View'}
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
             </table>
        </div>
      )}

      {/* Verification Modal Component */}
      {isVerifyModalOpen && selectedDeclaration && (
        <VerificationModal 
            isOpen={isVerifyModalOpen} 
            onClose={() => setIsVerifyModalOpen(false)}
            declaration={selectedDeclaration}
            onSuccess={handleVerificationComplete}
            accessToken={accessToken}
        />
      )}
    </div>
  );
}

// ============================================================================
// 5. VERIFICATION MODAL COMPONENT (Complex Sub-component)
// ============================================================================

function VerificationModal({ isOpen, onClose, declaration, onSuccess, accessToken }: any) {
    const [loading, setLoading] = useState(false);
    
    // Flattened list of items with local verification state
    const [deductions, setDeductions] = useState<DeclarationItem[]>([]);
    const [exemptions, setExemptions] = useState<DeclarationItem[]>([]);
    const [overallRemarks, setOverallRemarks] = useState('');

    // Initialize state from prop
    useEffect(() => {
        if (declaration) {
            // Initialize with declared amount if verified amount is missing (default to ACCEPT)
            const initItem = (item: DeclarationItem) => ({
                ...item,
                verified_amount: item.verified_amount ?? item.declared_amount,
                verification_status: item.verification_status ?? 'PENDING',
                verification_remarks: item.verification_remarks ?? ''
            });

            setDeductions((declaration.chapter_via_details || []).map(initItem));
            setExemptions((declaration.other_exemptions || []).map(initItem));
        }
    }, [declaration]);

    // Handle line item change
    const updateItem = (listType: 'deductions' | 'exemptions', index: number, field: string, value: any) => {
        const setter = listType === 'deductions' ? setDeductions : setExemptions;
        setter(prev => {
            const newList = [...prev];
            newList[index] = { ...newList[index], [field]: value };
            
            // Auto-set status if amount matches
            if (field === 'verified_amount') {
               if (value === newList[index].declared_amount) newList[index].verification_status = 'ACCEPTED';
               else if (value === 0) newList[index].verification_status = 'REJECTED';
               else newList[index].verification_status = 'ACCEPTED'; // Partial acceptance
            }
            return newList;
        });
    };

    // Submit Logic
    const handleSubmit = async (finalStatus: 'VERIFIED' | 'REJECTED') => {
        setLoading(true);
        try {
            const payload = {
                declaration_id: declaration.id,
                user_id: session!.user.id, // Current admin
                tenant_id: declaration.tenant_id, // Need to ensure this is passed or fetched. Assuming session context.
                final_status: finalStatus,
                remarks: overallRemarks,
                verification_data: {
                    chapter_via_items: deductions,
                    exemption_items: exemptions,
                    summary: {
                        total_deductions_verified: deductions.reduce((s, i) => s + (i.verified_amount || 0), 0),
                        total_exemptions_verified: exemptions.reduce((s, i) => s + (i.verified_amount || 0), 0)
                    }
                }
            };

            // Using the Universal Gateway Action
            await callGateway('/api/a_crud_universal_pg_function_gateway', {
                config_id: CONFIGS.VERIFY_ACTION,
                params: payload
            }, accessToken);

            alert(`Declaration ${finalStatus} Successfully!`);
            onSuccess();
        } catch (e: any) {
            alert(`Verification Failed: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Helper to render a verification row
    const renderRow = (item: DeclarationItem, idx: number, type: 'deductions' | 'exemptions') => (
        <tr key={idx} className="border-b">
            <td className="p-3">
                <p className="font-semibold text-gray-800">{item.component_code}</p>
                {item.proof_doc_ids?.length > 0 ? (
                    <span className="text-xs text-blue-600 cursor-pointer hover:underline">
                        View Proof ({item.proof_doc_ids.length} docs)
                    </span>
                ) : (
                    <span className="text-xs text-red-500 italic">No Proof</span>
                )}
            </td>
            <td className="p-3 text-right text-gray-600">₹{item.declared_amount}</td>
            <td className="p-3">
                <Input 
                    type="number" 
                    value={item.verified_amount} 
                    onChange={e => updateItem(type, idx, 'verified_amount', parseFloat(e.target.value))}
                    className="text-right w-32"
                />
            </td>
            <td className="p-3">
                <div className="flex gap-1">
                    <button 
                        onClick={() => {
                            updateItem(type, idx, 'verification_status', 'ACCEPTED');
                            updateItem(type, idx, 'verified_amount', item.declared_amount);
                        }}
                        className={`p-1 rounded ${item.verification_status === 'ACCEPTED' ? 'bg-green-100 text-green-700 ring-1 ring-green-600' : 'bg-gray-100 text-gray-400 hover:bg-green-50'}`}
                        title="Accept Full Amount"
                    >
                        ✅
                    </button>
                    <button 
                         onClick={() => {
                            updateItem(type, idx, 'verification_status', 'REJECTED');
                            updateItem(type, idx, 'verified_amount', 0);
                        }}
                        className={`p-1 rounded ${item.verification_status === 'REJECTED' ? 'bg-red-100 text-red-700 ring-1 ring-red-600' : 'bg-gray-100 text-gray-400 hover:bg-red-50'}`}
                        title="Reject"
                    >
                        ❌
                    </button>
                </div>
            </td>
            <td className="p-3">
                <input 
                    type="text" 
                    placeholder="Notes..." 
                    className="w-full text-sm border-b focus:outline-none focus:border-blue-500"
                    value={item.verification_remarks || ''}
                    onChange={e => updateItem(type, idx, 'verification_remarks', e.target.value)}
                />
            </td>
        </tr>
    );

    if (!isOpen) return null;

    return (
        <Modal isOpen={true} onClose={onClose} title={`Verify Declaration #${declaration.id}`} maxWidth="max-w-5xl">
            <div className="flex flex-col h-[75vh]">
                
                {/* Header Stats */}
                <div className="flex justify-between bg-blue-50 p-4 rounded mb-4 text-sm">
                    <div><strong>Financial Year:</strong> {declaration.financial_year}</div>
                    <div><strong>Declared Total:</strong> ₹{declaration.total_declared_amount?.toLocaleString()}</div>
                    <div><strong>Submitted:</strong> {new Date(declaration.submitted_at).toLocaleDateString()}</div>
                </div>

                {/* Content Tabs */}
                <Tabs>
                    <Tabs.Tab label={`Deductions (${deductions.length})`}>
                        <div className="overflow-y-auto flex-1 border rounded h-[400px]">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="p-3 text-left">Component</th>
                                        <th className="p-3 text-right">Declared</th>
                                        <th className="p-3 text-right w-32">Verified</th>
                                        <th className="p-3 w-24">Action</th>
                                        <th className="p-3 text-left">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {deductions.map((item, idx) => renderRow(item, idx, 'deductions'))}
                                    {deductions.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-500">No deductions declared.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </Tabs.Tab>
                    <Tabs.Tab label={`Exemptions (${exemptions.length})`}>
                         <div className="overflow-y-auto flex-1 border rounded h-[400px]">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="p-3 text-left">Component</th>
                                        <th className="p-3 text-right">Declared</th>
                                        <th className="p-3 text-right w-32">Verified</th>
                                        <th className="p-3 w-24">Action</th>
                                        <th className="p-3 text-left">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {exemptions.map((item, idx) => renderRow(item, idx, 'exemptions'))}
                                    {exemptions.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-500">No exemptions declared.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </Tabs.Tab>
                    <Tabs.Tab label="House Property">
                        <div className="p-4 border rounded h-[400px] overflow-y-auto bg-gray-50">
                             <pre className="text-xs">{JSON.stringify(declaration.house_property_details, null, 2)}</pre>
                             <p className="text-gray-500 italic mt-4">House Property verification UI is simplified for this demo. Please verify amounts manually based on the data above.</p>
                        </div>
                    </Tabs.Tab>
                </Tabs>

                {/* Footer Actions */}
                <div className="mt-auto pt-4 border-t flex flex-col gap-4">
                    <div>
                        <label className="text-sm font-semibold">Overall Remarks:</label>
                        <textarea 
                            className="w-full border rounded p-2 text-sm mt-1 h-16" 
                            placeholder="Enter final remarks for the employee..."
                            value={overallRemarks}
                            onChange={e => setOverallRemarks(e.target.value)}
                        />
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
                        <Button 
                            variant="destructive" 
                            onClick={() => handleSubmit('REJECTED')} 
                            disabled={loading}
                        >
                            Reject All
                        </Button>
                        <Button 
                            onClick={() => handleSubmit('VERIFIED')} 
                            isLoading={loading}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            Finalize Verification
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}