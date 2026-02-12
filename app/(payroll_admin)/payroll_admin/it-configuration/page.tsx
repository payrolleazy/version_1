'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Loader from '@/components/ui/Loader';
import Tabs from '@/components/Tabs';
import Modal from '@/components/Modal';

// ============================================================================
// 1. TYPES
// ============================================================================

interface TaxSlab {
    min: number;
    max: number | null;
    rate: number; // 0.05 for 5%
}

interface FiscalPolicy {
    id: number;
    financial_year: string;
    is_active: boolean;
    is_frozen: boolean;
    global_rules: {
        standard_deduction: number;
        cess_rate: number;
        rebate_87a_limit: Record<string, number>;
        rebate_87a_amount: Record<string, number>;
    };
    regime_slabs: {
        OLD_REGIME: TaxSlab[];
        NEW_REGIME: TaxSlab[];
    };
}

// ============================================================================
// 2. CONFIGURATION
// ============================================================================
const CONFIGS = {
  // Config ID: 21ce79f5-eec1-40ff-9a72-6cb834a5a0a5
  READ_POLICY: '21ce79f5-eec1-40ff-9a72-6cb834a5a0a5',
  
  // Config ID: it-func-initialize-001
  INIT_NEW_FY: 'it-func-initialize-001'
};

// ============================================================================
// 3. HELPER
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
// 4. MAIN COMPONENT
// ============================================================================
export default function ITConfigurationPage() {
  const { session } = useSessionContext();
  const accessToken = session?.access_token;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [policy, setPolicy] = useState<FiscalPolicy | null>(null);
  const [financialYear, setFinancialYear] = useState('FY2025-26');
  
  // Init Modal
  const [isInitModalOpen, setIsInitModalOpen] = useState(false);
  const [newFy, setNewFy] = useState('');
  const [initLoading, setInitLoading] = useState(false);

  // --- FETCH POLICY ---
  const fetchPolicy = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await callGateway('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_POLICY,
        params: {
          filters: { financial_year: financialYear },
          limit: 1
        }
      }, accessToken);
      
      setPolicy(res.data?.[0] || null);
    } catch (e: any) {
      setError(e.message);
      setPolicy(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, financialYear]);

  useEffect(() => {
    if (accessToken) fetchPolicy();
  }, [accessToken, fetchPolicy]);

  // --- ACTIONS ---
  const handleInitializeFy = async () => {
    if (!newFy.match(/^FY\d{4}-\d{2}$/)) return alert('Invalid Format. Use FY2026-27');
    
    setInitLoading(true);
    try {
        await callGateway('/api/a_crud_universal_pg_function_gateway', {
            config_id: CONFIGS.INIT_NEW_FY,
            params: {
                p_tenant_id: session!.user.user_metadata.tenant_id,
                p_financial_year: newFy
            }
        }, accessToken!);
        
        alert(`Successfully initialized ${newFy}`);
        setIsInitModalOpen(false);
        setFinancialYear(newFy); // Switch to new view
    } catch(e: any) {
        alert(e.message);
    } finally {
        setInitLoading(false);
    }
  };

  if (loading && !policy) return <Loader />;

  return (
    <div className="p-8 bg-gray-50 min-h-screen font-sans">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-3xl font-bold text-gray-800">Tax Configuration</h1>
           <p className="text-gray-500">View and manage fiscal policies for {financialYear}</p>
        </div>
        <div className="flex gap-2">
            <select 
                className="border rounded p-2"
                value={financialYear}
                onChange={e => setFinancialYear(e.target.value)}
            >
                <option>FY2025-26</option>
                <option>FY2024-25</option>
            </select>
            <Button variant="secondary" onClick={() => setIsInitModalOpen(true)}>Initialize New FY</Button>
        </div>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-4 mb-4 rounded">{error}</div>}

      {!policy ? (
        <div className="text-center p-10 bg-white rounded shadow text-gray-500">
            No configuration found for {financialYear}. Click &quot;Initialize New FY&quot; to setup.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 1. Global Rules */}
            <div className="bg-white p-6 rounded-lg shadow lg:col-span-1">
                <h3 className="font-bold text-lg mb-4 text-blue-800 border-b pb-2">Global Settings</h3>
                <div className="space-y-4">
                    <div className="flex justify-between border-b pb-2">
                        <span className="text-gray-600">Status</span>
                        <span className={`font-bold ${policy.is_active ? 'text-green-600' : 'text-red-500'}`}>
                            {policy.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                        <span className="text-gray-600">Standard Deduction</span>
                        <span className="font-mono font-bold">₹{policy.global_rules.standard_deduction.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                        <span className="text-gray-600">Health & Edu Cess</span>
                        <span className="font-mono font-bold">{(policy.global_rules.cess_rate * 100)}%</span>
                    </div>
                    
                    <div className="pt-2">
                        <p className="font-semibold text-gray-700 mb-2">Rebate u/s 87A Limit</p>
                        <div className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                            <span>Old Regime: ₹{policy.global_rules.rebate_87a_limit.OLD_REGIME?.toLocaleString()}</span>
                            <span>New Regime: ₹{policy.global_rules.rebate_87a_limit.NEW_REGIME?.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Tax Slabs */}
            <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
                 <h3 className="font-bold text-lg mb-4 text-blue-800 border-b pb-2">Income Tax Slabs</h3>
                 <Tabs>
                    <Tabs.Tab label="New Regime">
                        <SlabTable slabs={policy.regime_slabs.NEW_REGIME} />
                    </Tabs.Tab>
                    <Tabs.Tab label="Old Regime">
                        <SlabTable slabs={policy.regime_slabs.OLD_REGIME} />
                    </Tabs.Tab>
                 </Tabs>
            </div>

        </div>
      )}

      {/* Initialization Modal */}
      {isInitModalOpen && (
          <Modal isOpen={true} onClose={() => setIsInitModalOpen(false)} title="Initialize New Financial Year">
              <div className="space-y-4 p-2">
                  <p className="text-sm text-gray-600">
                    This will clone the structure of the previous year and apply standard statutory defaults for the new year.
                  </p>
                  <div>
                      <label className="block text-sm font-medium mb-1">Financial Year (e.g. FY2026-27)</label>
                      <input 
                        className="w-full border p-2 rounded" 
                        placeholder="FYYYYY-YY"
                        value={newFy}
                        onChange={e => setNewFy(e.target.value.toUpperCase())}
                      />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                      <Button variant="ghost" onClick={() => setIsInitModalOpen(false)}>Cancel</Button>
                      <Button onClick={handleInitializeFy} isLoading={initLoading}>Initialize</Button>
                  </div>
              </div>
          </Modal>
      )}

    </div>
  );
}

// --- SUB-COMPONENT: SLAB TABLE ---
function SlabTable({ slabs }: { slabs: TaxSlab[] }) {
    if(!slabs || slabs.length === 0) return <div className="p-4 text-gray-500">No slabs defined.</div>;

    return (
        <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="px-4 py-2 text-left">From (₹)</th>
                        <th className="px-4 py-2 text-left">To (₹)</th>
                        <th className="px-4 py-2 text-right">Tax Rate</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y">
                    {slabs.map((slab, i) => (
                        <tr key={i}>
                            <td className="px-4 py-2 font-mono">{slab.min.toLocaleString()}</td>
                            <td className="px-4 py-2 font-mono">
                                {slab.max ? slab.max.toLocaleString() : 'Above'}
                            </td>
                            <td className="px-4 py-2 text-right font-bold">
                                {(slab.rate * 100)}%
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}