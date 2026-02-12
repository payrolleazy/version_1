'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Loader from '@/components/ui/Loader';
import Modal from '@/components/Modal';
import { motion } from 'framer-motion';

// --- CONFIGURATION ---
const GATEWAY_URL = '/api/a_crud_universal_pg_function_gateway';
const READ_URL = '/api/a_crud_universal_read';

const CONFIGS = {
  // Config created in the SQL prerequisites step
  READ_HISTORY: 'lms-read-leave-requests', 
  // Maps to public.lms_action_update_leave_request via Gateway
  CANCEL_REQUEST: 'lms-action-update-leave-request' 
};

// --- TYPES ---
interface LeaveRequest {
  id: number; // bigint in DB
  application_number: string;
  leave_category: string | null;
  start_date: string;
  end_date: string;
  leave_duration_days: number;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reason: string;
  created_at: string;
}

export default function LeaveHistoryPage() {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const router = useRouter();

  // --- STATE ---
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Cancel Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // --- 1. FETCH HISTORY ---
  const fetchHistory = useCallback(async () => {
    if (!session?.access_token) return;
    
    setLoading(true);
    setError(null);

    try {
      // Build dynamic filters
      const filters: any = {};
      if (statusFilter !== 'ALL') {
        filters.status = statusFilter;
      }
      
      // Note: Universal Read generic filters usually support exact match. 
      // For date ranges (gte/lte), we rely on the backend config allowing it 
      // or we do client-side filtering if the generic read is simple.
      // Assuming simple exact match for now in the payload structure.
      
      const res = await fetch(READ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: CONFIGS.READ_HISTORY,
          params: { 
            filters,
            orderBy: [['created_at', 'DESC']],
            limit: 100 
          },
          accessToken: session.access_token
        })
      });

      const result = await res.json();
      
      if (!result.success) {
        throw new Error(result.message || "Failed to fetch history");
      }

      let data = result.data || [];

      // Manual client-side date filtering if the universal read doesn't support complex operators yet
      if (dateFrom) {
        data = data.filter((r: LeaveRequest) => r.start_date >= dateFrom);
      }
      if (dateTo) {
        data = data.filter((r: LeaveRequest) => r.end_date <= dateTo);
      }

      setRequests(data);

    } catch (e: any) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (session) fetchHistory();
  }, [session, fetchHistory]);


  // --- 2. CANCEL ACTION ---
  const handleCancel = async () => {
    if (!selectedRequest || !session) return;
    
    setCancelling(true);
    try {
      const res = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: CONFIGS.CANCEL_REQUEST,
          params: {
            p_action_payload: {
              request_id: selectedRequest.id,
              status: 'CANCELLED'
            }
          },
          accessToken: session.access_token
        })
      });

      const result = await res.json();
      const responseData = result.data || result;

      if (!result.success && !responseData.success) {
        throw new Error(responseData.message || "Cancellation failed");
      }

      // Success
      setIsCancelModalOpen(false);
      setSelectedRequest(null);
      fetchHistory(); // Refresh list

    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setCancelling(false);
    }
  };

  const openCancelModal = (req: LeaveRequest) => {
    setSelectedRequest(req);
    setIsCancelModalOpen(true);
  };

  // --- HELPERS ---
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      'APPROVED': 'bg-green-100 text-green-800',
      'PENDING_APPROVAL': 'bg-yellow-100 text-yellow-800',
      'REJECTED': 'bg-red-100 text-red-800',
      'CANCELLED': 'bg-gray-100 text-gray-600',
      'DRAFT': 'bg-blue-50 text-blue-600'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  // --- RENDER ---
  if (sessionLoading) return <div className="p-8 flex justify-center"><Loader /></div>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Leave History</h1>
          <p className="text-gray-500 text-sm">View and manage your past applications</p>
        </div>
        <Button variant="secondary" onClick={() => router.push('/employee/attendance/leave')}>
          Back to Dashboard
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-end">
        <div className="w-48">
          <label className="text-xs font-medium text-gray-500 mb-1 block">Status</label>
          <select 
            className="w-full border border-gray-300 rounded-md p-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING_APPROVAL">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div className="w-40">
           <label className="text-xs font-medium text-gray-500 mb-1 block">From</label>
           <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="w-40">
           <label className="text-xs font-medium text-gray-500 mb-1 block">To</label>
           <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <Button onClick={() => fetchHistory()} disabled={loading}>
          {loading ? 'Loading...' : 'Filter'}
        </Button>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded mb-6">{error}</div>}

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader /></div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No leave records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">App No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type / Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dates</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Duration</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-600">
                      {req.application_number}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{req.leave_category || 'Leave Request'}</div>
                      <div className="text-xs text-gray-500 truncate max-w-xs" title={req.reason}>
                        {req.reason}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(req.start_date).toLocaleDateString()} 
                      <span className="mx-2 text-gray-400">to</span> 
                      {new Date(req.end_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-700">
                      {req.leave_duration_days} Days
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {getStatusBadge(req.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                      {(req.status === 'PENDING_APPROVAL' || req.status === 'DRAFT') && (
                        <button 
                          onClick={() => openCancelModal(req)}
                          className="text-red-600 hover:text-red-800 hover:underline font-medium"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {isCancelModalOpen && selectedRequest && (
        <Modal 
          isOpen={isCancelModalOpen} 
          onClose={() => setIsCancelModalOpen(false)} 
          title="Cancel Request"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to cancel the leave request <strong>{selectedRequest.application_number}</strong>?
            </p>
            <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800">
              This action cannot be undone. If approved, the balance will be refunded.
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setIsCancelModalOpen(false)} disabled={cancelling}>
                No, Keep it
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleCancel} 
                isLoading={cancelling}
              >
                Yes, Cancel Request
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}