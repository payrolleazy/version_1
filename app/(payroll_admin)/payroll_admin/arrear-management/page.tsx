'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/Modal';
import Tabs from '@/components/Tabs';
import Loader from '@/components/ui/Loader';

// Config IDs based on our validation
const READ_ARREARS_CONFIG_ID = 'eb713ae5-8be6-43d2-82b6-0f8bbabef6b0';
const READ_BREAKDOWN_CONFIG_ID = 'b1b2b3b4-c1c2-d1d2-e1e2-f1f2f3f4f5f6';
const PROCESS_ARREAR_CONFIG_ID = 'wcm-process-admin-arrear-decision';

// Interfaces for our data structures
interface ArrearMaster {
  id: number;
  employee_name: string;
  emp_code: string;
  arrear_type_code: string;
  arrear_type_description: string;
  source_period: string;
  final_amount: number;
  created_at: string;
}

interface ArrearBreakdown {
  component_code: string;
  old_value: number;
  new_value: number;
  variance: number;
}

interface ModalData {
  arrear: ArrearMaster;
  breakdown: ArrearBreakdown[];
}

export default function ArrearManagementPage() {
  const { session } = useSessionContext();
  const [activeTab, setActiveTab] = useState('Salary Revisions');
  
  const [salaryArrears, setSalaryArrears] = useState<ArrearMaster[]>([]);
  const [lopArrears, setLopArrears] = useState<ArrearMaster[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [remarks, setRemarks] = useState('');

  const fetchPendingArrears = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!session) return;

    try {
      const response = await fetch('/api/wcm-read-arrears', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          config_id: READ_ARREARS_CONFIG_ID,
          params: {
            filters: { status: 'PENDING_ADMIN_APPROVAL' },
            orderBy: [['created_at', 'DESC']]
          }
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch arrears.');
      
      const allArrears: ArrearMaster[] = data.data || [];
      setSalaryArrears(allArrears.filter(a => a.arrear_type_code === 'SALARY_REVISED_RETROACTIVE'));
      setLopArrears(allArrears.filter(a => a.arrear_type_code === 'LOP' || a.arrear_type_code === 'LOP_REVERSAL'));

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchPendingArrears();
  }, [fetchPendingArrears]);

  const handleReview = async (arrear: ArrearMaster) => {
    setModalData(null);
    setIsModalOpen(true);
    setModalLoading(true);
    setRemarks('');
    setError(null);

    let breakdownData: ArrearBreakdown[] = [];

    if (arrear.arrear_type_code === 'SALARY_REVISED_RETROACTIVE') {
        try {
            // Placeholder: A dedicated RPC is the robust way to fetch this multi-level data.
            // For now, this part of the UI will show that the data is intended to be displayed here.
            const response = await fetch('/api/wcm-get-arrear-breakdown', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ p_arrear_master_id: arrear.id }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Failed to fetch breakdown details.');
            
            breakdownData = result.data || [];

        } catch (err: any) {
            setError(`Failed to fetch breakdown: ${err.message}`);
        }
    }

    setModalData({ arrear, breakdown: breakdownData });
    setModalLoading(false);
  };

  const handleApproveReject = async (action: 'APPROVE' | 'REJECT') => {
    if (!modalData) return;
    if (action === 'REJECT' && !remarks.trim()) {
        setError('Remarks are mandatory when rejecting an arrear.');
        return;
    }
    setActionLoading(true);
    setError(null);

    try {
        const response = await fetch('/api/wcm-process-arrear', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
                config_id: PROCESS_ARREAR_CONFIG_ID,
                params: {
                    p_arrear_master_id: modalData.arrear.id,
                    p_action: action,
                    p_remarks: remarks,
                }
            }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'An unknown error occurred');
        

        setIsModalOpen(false);
        setModalData(null);
        await fetchPendingArrears();

    } catch(err: any) {
        setError(err.message);
    } finally {
        setActionLoading(false);
    }
  };
  
  const ArrearsTable = ({ arrears, type }: { arrears: ArrearMaster[], type: string }) => (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-200">
        <thead className="bg-gray-100">
          <tr>
            <th className="py-2 px-4 border-b text-left">Employee</th>
            <th className="py-2 px-4 border-b text-left">{type === 'LOP' ? 'Adjustment Type' : 'Source Period'}</th>
            <th className="py-2 px-4 border-b text-right">Amount (INR)</th>
            <th className="py-2 px-4 border-b text-left">Date Created</th>
            <th className="py-2 px-4 border-b text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {arrears.length > 0 ? arrears.map((arrear) => (
            <tr key={arrear.id} className="hover:bg-gray-50">
              <td className="py-2 px-4 border-b">
                <div className="font-medium">{arrear.employee_name}</div>
                <div className="text-xs text-gray-500">{arrear.emp_code}</div>
              </td>
              <td className="py-2 px-4 border-b">{type === 'LOP' ? arrear.arrear_type_description : new Date(arrear.source_period).toLocaleDateString()}</td>
              <td className={`py-2 px-4 border-b text-right font-mono ${arrear.final_amount < 0 ? 'text-red-600' : 'text-green-600'}`}>{arrear.final_amount.toFixed(2)}</td>
              <td className="py-2 px-4 border-b">{new Date(arrear.created_at).toLocaleString()}</td>
              <td className="py-2 px-4 border-b text-center">
                <Button onClick={() => handleReview(arrear)} size="sm">Review</Button>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={5} className="text-center py-8 text-gray-500">No pending arrears of this type.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-8 bg-white rounded-lg shadow-md min-h-screen">
        <h1 className="text-3xl font-bold mb-4">Arrear Management</h1>
        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}
        
        <Tabs>
            <Tabs.Tab label={`Salary Revisions (${salaryArrears.length})`} isActive={activeTab === 'Salary Revisions'} onClick={() => setActiveTab('Salary Revisions')}>
                {loading ? <Loader /> : <ArrearsTable arrears={salaryArrears} type="Salary"/>}
            </Tabs.Tab>
            <Tabs.Tab label={`LOP & Attendance (${lopArrears.length})`} isActive={activeTab === 'LOP & Attendance'} onClick={() => setActiveTab('LOP & Attendance')}>
                {loading ? <Loader /> : <ArrearsTable arrears={lopArrears} type="LOP"/>}
            </Tabs.Tab>
        </Tabs>

        {isModalOpen && modalData && (
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Review Arrear for: ${modalData.arrear.employee_name}`}>
                {modalLoading ? <Loader /> : (
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold">{modalData.arrear.arrear_type_description}</h3>
                            <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                                <p><strong>Source Period:</strong> {new Date(modalData.arrear.source_period).toLocaleDateString()}</p>
                                <p><strong>Total Amount:</strong> <span className="font-bold text-lg font-mono">{modalData.arrear.final_amount.toFixed(2)}</span></p>
                            </div>
                        </div>
                        
                        {modalData.arrear.arrear_type_code === 'SALARY_REVISED_RETROACTIVE' && (
                             <div className="border-t pt-4">
                                <h3 className="text-lg font-semibold">Component-wise Arrear Breakdown</h3>
                                {modalLoading ? <Loader /> : modalData.breakdown && modalData.breakdown.length > 0 ? (
                                    <table className="min-w-full text-sm mt-2">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="text-left py-1 px-2">Component</th>
                                                <th className="text-right py-1 px-2">Old Value</th>
                                                <th className="text-right py-1 px-2">New Value</th>
                                                <th className="text-right py-1 px-2">Variance</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {modalData.breakdown.map(b => (
                                                <tr key={b.component_code} className="border-b">
                                                    <td className="py-1 px-2">{b.component_code}</td>
                                                    <td className="py-1 px-2 text-right font-mono">{b.old_value.toFixed(2)}</td>
                                                    <td className="py-1 px-2 text-right font-mono">{b.new_value.toFixed(2)}</td>
                                                    <td className={`py-1 px-2 text-right font-mono ${b.variance < 0 ? 'text-red-500' : 'text-green-600'}`}>{b.variance.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <p className="text-xs text-gray-500 mt-1">No component breakdown data available for this arrear type.</p>
                                )}
                            </div>
                        )}

                        <div className="border-t pt-4">
                            <label htmlFor="remarks" className="block text-sm font-medium text-gray-700">Remarks (Mandatory for Rejection)</label>
                            <textarea
                                id="remarks"
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                rows={3}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 sm:text-sm"
                            />
                        </div>
                        
                        <div className="flex justify-end space-x-3 mt-6">
                            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={actionLoading}>Cancel</Button>
                            <Button variant="destructive" onClick={() => handleApproveReject('REJECT')} isLoading={actionLoading} disabled={actionLoading}>Reject</Button>
                            <Button onClick={() => handleApproveReject('APPROVE')} isLoading={actionLoading} disabled={actionLoading}>Approve</Button>
                        </div>
                    </div>
                )}
            </Modal>
        )}
    </div>
  );
}