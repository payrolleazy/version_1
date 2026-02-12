'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/Modal';
import Loader from '@/components/ui/Loader';
import * as XLSX from 'xlsx';

// ============================================================================
// 1. TYPES
// ============================================================================

interface Challan {
  id: number;
  challan_code: string;
  payroll_period: string;
  computation_batch_id: number;
  total_employees: number;
  total_contribution: number;
  generation_status: 'DRAFT' | 'GENERATED' | 'PAID' | 'ERROR';
  due_date: string;
  payment_date?: string;
  bank_payment_reference?: string;
}

interface PaymentForm {
  payment_reference: string;
  payment_date: string;
  payment_amount: number;
}

// ============================================================================
// 2. CONFIGURATION CONSTANTS
// ============================================================================

const CONFIGS = {
  READ_CHALLANS: 'edf9b4b1-0bc6-43a9-8d5f-27e0811606c5',
  READ_LEDGER: '5edbb239-cee4-46c7-9fc5-fcb09bb4510e', // To generate ECR data
  RECONCILE_PAYMENT: 'wcm_esic_reconcile_payment'
};

// ============================================================================
// 3. PAGE COMPONENT
// ============================================================================

export default function EsicChallanPage() {
  const { session } = useSessionContext();
  
  const [challans, setChallans] = useState<Challan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payment Modal State
  const [selectedChallan, setSelectedChallan] = useState<Challan | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({ payment_reference: '', payment_date: '', payment_amount: 0 });
  const [processingPayment, setProcessingPayment] = useState(false);

  // ECR Download State
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // --------------------------------------------------------------------------
  // Data Fetching
  // --------------------------------------------------------------------------
  const fetchChallans = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/a_crud_universal_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: CONFIGS.READ_CHALLANS,
          params: { 
            limit: 50, 
            orderBy: [['created_at', 'DESC']] 
          },
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch challans');
      }

      setChallans(result.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) fetchChallans();
  }, [session, fetchChallans]);

  // --------------------------------------------------------------------------
  // Action: Download ECR (Client-Side Generation)
  // --------------------------------------------------------------------------
  const handleDownloadECR = async (challan: Challan) => {
    if (!session?.access_token) return;
    setDownloadingId(challan.id);

    try {
      // 1. Fetch Ledger Data for this Batch
      // We use the existing ledger read config to get the data needed for the Excel
      const response = await fetch('/api/a_crud_universal_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: CONFIGS.READ_LEDGER,
          params: { 
            filters: { batch_id: challan.computation_batch_id },
            limit: 5000 // Ensure we get all rows
          },
          p_enrich_with_employee_details: true, // Need IP Number and Names
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();
      if (!result.success) throw new Error("Failed to fetch ECR data");

      const ledgerData = result.data || [];

      // 2. Format for ESIC Portal (Standard Template)
      const ecrRows = ledgerData.map((row: any) => ({
        "IP Number": row.ip_number,
        "IP Name": row.full_name,
        "No of Days": row.worked_days,
        "Total Monthly Wages": row.esic_eligible_wages,
        "Reason Code for Zero Workings": row.worked_days === 0 ? "1" : "0", // 1=Leave, 0=None
        "Last Working Day": "" // Optional, typically for exits
      }));

      // 3. Generate Excel
      const worksheet = XLSX.utils.json_to_sheet(ecrRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Contribution");
      
      const fileName = `ECR_${challan.challan_code}.xlsx`;
      XLSX.writeFile(workbook, fileName);

    } catch (err: any) {
      alert(`Download Failed: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  // --------------------------------------------------------------------------
  // Action: Reconcile Payment
  // --------------------------------------------------------------------------
  const openPaymentModal = (challan: Challan) => {
    setSelectedChallan(challan);
    setPaymentForm({
      payment_reference: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_amount: challan.total_contribution // Default to exact amount
    });
  };

  const handleMarkPaid = async () => {
    if (!session?.access_token || !selectedChallan) return;
    
    if (paymentForm.payment_amount <= 0 || !paymentForm.payment_reference) {
      alert("Please enter valid payment details.");
      return;
    }

    setProcessingPayment(true);
    try {
      // Call the wrapper with the p_params signature we fixed
      const response = await fetch('/api/a_crud_universal_pg_function_gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: CONFIGS.RECONCILE_PAYMENT,
          params: {
            p_params: {
                challan_id: selectedChallan.id,
                payment_reference: paymentForm.payment_reference,
                payment_amount: Number(paymentForm.payment_amount),
                payment_date: paymentForm.payment_date
                // user_id injected by gateway
            }
          },
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();

      if (!response.ok || (result.data && result.data.success === false)) {
        throw new Error(result.data?.error || result.message || "Payment reconciliation failed");
      }

      setSelectedChallan(null);
      fetchChallans(); // Refresh list
      alert("Payment Recorded Successfully!");

    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setProcessingPayment(false);
    }
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  if (loading && challans.length === 0) return <Loader />;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Challan & ECR Manager</h1>
          <p className="text-sm text-gray-500">Download Government Returns and Track Payments.</p>
        </div>
        <Button onClick={fetchChallans} variant="secondary">Refresh</Button>
      </div>

      {error && <div className="p-4 mb-4 text-red-700 bg-red-100 rounded border border-red-400">{error}</div>}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Challan Code</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Employees</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {challans.map((challan) => (
              <tr key={challan.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(challan.payroll_period).toLocaleString('default', { month: 'long', year: 'numeric' })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                  {challan.challan_code}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-700">
                  {challan.total_employees}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-800">
                  ₹{challan.total_contribution.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${challan.generation_status === 'PAID' ? 'bg-green-100 text-green-800' : 
                      challan.generation_status === 'ERROR' ? 'bg-red-100 text-red-800' : 
                      'bg-yellow-100 text-yellow-800'}`}>
                    {challan.generation_status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                  {challan.generation_status !== 'ERROR' && (
                    <button 
                      onClick={() => handleDownloadECR(challan)}
                      disabled={downloadingId === challan.id}
                      className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                    >
                      {downloadingId === challan.id ? 'Downloading...' : 'Download ECR'}
                    </button>
                  )}
                  {challan.generation_status === 'GENERATED' && (
                    <button 
                      onClick={() => openPaymentModal(challan)}
                      className="text-green-600 hover:text-green-900"
                    >
                      Mark Paid
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {challans.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No challans generated yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Payment Modal */}
      {selectedChallan && (
        <Modal isOpen={!!selectedChallan} onClose={() => setSelectedChallan(null)} title="Record Payment">
          <div className="space-y-4 p-4">
            <div className="bg-blue-50 p-4 rounded-md mb-4">
              <p className="text-sm text-blue-800">Recording payment for <strong>{selectedChallan.challan_code}</strong></p>
              <p className="text-xs text-blue-600 mt-1">Expected Amount: ₹{selectedChallan.total_contribution}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Bank Reference Number</label>
              <Input 
                value={paymentForm.payment_reference} 
                onChange={e => setPaymentForm({...paymentForm, payment_reference: e.target.value})}
                placeholder="TRRN / UTR Number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Payment Date</label>
              <Input 
                type="date"
                value={paymentForm.payment_date} 
                onChange={e => setPaymentForm({...paymentForm, payment_date: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Amount Paid (₹)</label>
              <Input 
                type="number"
                value={paymentForm.payment_amount} 
                onChange={e => setPaymentForm({...paymentForm, payment_amount: Number(e.target.value)})}
              />
              {paymentForm.payment_amount !== selectedChallan.total_contribution && (
                <p className="text-xs text-yellow-600 mt-1">
                  Note: Amount differs from calculated total ({selectedChallan.total_contribution}). System will log a discrepancy.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <Button variant="ghost" onClick={() => setSelectedChallan(null)}>Cancel</Button>
              <Button onClick={handleMarkPaid} isLoading={processingPayment}>Confirm Payment</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}