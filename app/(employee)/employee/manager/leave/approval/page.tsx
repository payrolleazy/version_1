'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';
import Loader from '@/components/ui/Loader';
import Modal from '@/components/Modal';

// --- CONFIGURATION ---
const GATEWAY_URL = '/api/a_crud_universal_pg_function_gateway';
// This matches the function: public.lms_get_manager_dashboard
const CONFIG_READ_DASHBOARD = 'lms-manager-dashboard'; 
// This matches the function: public.lms_process_approval_advanced
const CONFIG_PROCESS_APPROVAL = 'lms-process-approval-advanced';

// --- TYPES ---
interface PendingRequest {
  id: number;
  application_number: string;
  applicant_name: string;
  applicant_emp_code: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  leave_duration_days: number;
  duration_days: number;
  reason: string;
  is_emergency: boolean;
  current_level: number;
  total_levels: number;
  submitted_at: string;
  days_pending: number;
}

interface TeamSummary {
  total_team_members: number;
  on_leave_today: number;
  pending_approvals_count: number;
  emergency_requests: number;
}

export default function ManagerLeaveApprovalsPage() {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const router = useRouter();
  const initialLoadComplete = useRef(false);

  // --- STATE ---
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [teamSummary, setTeamSummary] = useState<TeamSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [processing, setProcessing] = useState(false);

  // --- FETCH DATA ---
  // Calls public.lms_get_manager_dashboard via Gateway
  const fetchDashboard = useCallback(async () => {
    if (!session?.access_token) return;
    
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: CONFIG_READ_DASHBOARD,
          params: {
            user_id: session.user.id,
            tenant_id: session.user.user_metadata.tenant_id,
            page_size: 100, // Fetch up to 100 pending items
            page: 1
          },
          accessToken: session.access_token
        })
      });

      const result = await res.json();
      
      if (!result.success && !result.data?.success) {
        throw new Error(result.message || "Failed to load manager dashboard");
      }

      // The function returns a structured JSONB object
      const data = result.data?.data || result.data;
      
      setPendingRequests(data.pending_approvals || []);
      setTeamSummary(data.team_summary || null);

    } catch (e: any) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) fetchDashboard();
  }, [session, fetchDashboard]);

  // --- APPROVE / REJECT HANDLER ---
  // Calls public.lms_process_approval_advanced via Gateway
  const handleProcess = async () => {
    if (!selectedRequest || !actionType || !session) return;
    
    // Validation: Rejection requires remarks
    if (actionType === 'reject' && !remarks.trim()) {
      alert("Remarks are mandatory for rejection.");
      return;
    }

    setProcessing(true);

    try {
      const res = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: CONFIG_PROCESS_APPROVAL,
          params: {
            user_id: session.user.id,
            tenant_id: session.user.user_metadata.tenant_id,
            request_id: selectedRequest.id,
            action: actionType, // 'approve' or 'reject'
            remarks: remarks,
            delegate_to_position_id: null // Not using delegation in this UI yet
          },
          accessToken: session.access_token
        })
      });

      const result = await res.json();
      const responseData = result.data || result;

      if (!result.success && !responseData.success) {
        throw new Error(responseData.message || "Processing failed");
      }

      // Success
      setIsModalOpen(false);
      setSelectedRequest(null);
      setRemarks('');
      fetchDashboard(); // Refresh list

    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const openModal = (req: PendingRequest, type: 'approve' | 'reject') => {
    setSelectedRequest(req);
    setActionType(type);
    setRemarks('');
    setIsModalOpen(true);
  };

  // --- RENDER ---
  
  // Session check logic (same as previous screens)
  useEffect(() => {
    if (!sessionLoading && session && !loading) {
      initialLoadComplete.current = true;
    }
  }, [sessionLoading, session, loading]);

  if (sessionLoading) return <div className="p-8 flex justify-center"><Loader /></div>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Team Leave Approvals</h1>
          <p className="text-gray-600 text-sm">Manage leave requests for your direct reports</p>
        </div>
        <Button variant="secondary" onClick={fetchDashboard}>
          Refresh List
        </Button>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-6">{error}</div>}

      {/* Summary Cards (Data from lms_get_manager_dashboard) */}
      {teamSummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 uppercase font-bold">Pending Actions</p>
            <p className="text-2xl font-bold text-blue-600">{teamSummary.pending_approvals_count}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
             <p className="text-xs text-gray-500 uppercase font-bold">On Leave Today</p>
             <p className="text-2xl font-bold text-green-600">{teamSummary.on_leave_today}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
             <p className="text-xs text-gray-500 uppercase font-bold">Team Size</p>
             <p className="text-2xl font-bold text-gray-800">{teamSummary.total_team_members}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
             <p className="text-xs text-gray-500 uppercase font-bold">Emergency Req.</p>
             <p className="text-2xl font-bold text-red-600">{teamSummary.emergency_requests}</p>
          </div>
        </div>
      )}

      {/* Requests List */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader /></div>
        ) : pendingRequests.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="bg-green-50 p-4 rounded-full mb-3">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-gray-800 font-medium">All caught up!</p>
            <p className="text-gray-500 text-sm">You have no pending leave requests to review.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pendingRequests.map((req) => (
              <motion.div 
                key={req.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  
                  {/* Left: Applicant Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                       <span className="font-bold text-lg text-gray-900">{req.applicant_name}</span>
                       <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{req.applicant_emp_code}</span>
                       {req.is_emergency && (
                         <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-bold animate-pulse">EMERGENCY</span>
                       )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                       <div>
                         <p className="text-xs text-gray-400 uppercase">Leave Type</p>
                         <p className="font-medium text-blue-700">{req.leave_type_name}</p>
                       </div>
                       <div>
                         <p className="text-xs text-gray-400 uppercase">Duration</p>
                         <p className="font-medium">{req.leave_duration_days} Days</p>
                       </div>
                       <div>
                         <p className="text-xs text-gray-400 uppercase">From</p>
                         <p>{new Date(req.start_date).toLocaleDateString()}</p>
                       </div>
                       <div>
                         <p className="text-xs text-gray-400 uppercase">To</p>
                         <p>{new Date(req.end_date).toLocaleDateString()}</p>
                       </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 italic border-l-4 border-gray-300">
                       &quot;{req.reason}&quot;
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-col justify-center gap-2 min-w-[140px]">
                    <Button 
                      className="bg-green-600 hover:bg-green-700 text-white w-full" 
                      onClick={() => openModal(req, 'approve')}
                    >
                      Approve
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="w-full"
                      onClick={() => openModal(req, 'reject')}
                    >
                      Reject
                    </Button>
                    <p className="text-xs text-center text-gray-400 mt-2">
                      Level {req.current_level} / {req.total_levels}
                    </p>
                  </div>

                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {isModalOpen && selectedRequest && (
        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title={`${actionType === 'approve' ? 'Approve' : 'Reject'} Request`}
        >
           <div className="space-y-4">
             <div className="bg-gray-50 p-4 rounded text-sm">
                <p><strong>Employee:</strong> {selectedRequest.applicant_name}</p>
                <p><strong>Request:</strong> {selectedRequest.leave_type_name} ({selectedRequest.leave_duration_days} days)</p>
             </div>

             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">
                 Remarks {actionType === 'reject' && <span className="text-red-500">*</span>}
               </label>
               <textarea 
                 className="w-full border border-gray-300 rounded-md p-2 text-sm"
                 rows={3}
                 placeholder={actionType === 'reject' ? "Please provide a reason for rejection..." : "Optional comments..."}
                 value={remarks}
                 onChange={e => setRemarks(e.target.value)}
               />
             </div>

             <div className="flex justify-end gap-3 pt-2">
               <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={processing}>Cancel</Button>
               <Button 
                 onClick={handleProcess} 
                 isLoading={processing}
                 className={actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
               >
                 Confirm {actionType === 'approve' ? 'Approval' : 'Rejection'}
               </Button>
             </div>
           </div>
        </Modal>
      )}

    </div>
  );
}