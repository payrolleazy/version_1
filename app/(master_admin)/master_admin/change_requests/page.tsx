'use client';

import { useEffect, useState } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import ChangeRequestTable from '@/components/ChangeRequestTable';
import ChangeRequestDetailModal from '@/components/ChangeRequestDetailModal';
import Loader from '@/components/ui/Loader';

// Define the configuration IDs as constants
const READ_CONFIG_ID = '6a3fac50-56c6-4244-9700-3a8574894d4b';
const GATEWAY_CONFIG_ID = 'wcm_pay_structure_approve';

export default function ChangeRequestsPage() {
  const { supabaseClient, session } = useSessionContext();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch pending requests
  const fetchRequests = async () => {
    if (!session) return; // Guard against running without a session

    setLoading(true);
    try {
      const response = await fetch('/api/a_crud_universal_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: READ_CONFIG_ID,
          params: {
            filters: { status: 'PENDING_APPROVAL' },
            orderBy: [{ created_at: 'DESC' }]
          },
          accessToken: session.access_token
        })
      });

      const data = await response.json();

      if (data && data.success) {
        setRequests(data.data || []);
      } else {
        console.error('Failed to fetch requests:', data?.message);
      }
    } catch (err: any) {
      console.error('Error fetching requests:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // The effect will re-run if the session becomes available.
    if (session) {
      fetchRequests();
    } else {
      // If there's no session on initial load, stop loading.
      // The session context provider will trigger a re-render when the session is fetched.
      setLoading(false);
    }
  }, [session]);

  const handleProcessRequest = async (request: any, action: 'APPROVE' | 'REJECT', remarks: string = '') => {
    if (!session) {
      alert('Session expired. Please login again.');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch('/api/a_crud_universal_pg_function_gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: GATEWAY_CONFIG_ID,
          params: {
            change_request_id: request.id,
            action: action,
            remarks: remarks
          },
          accessToken: session.access_token
        })
      });

      const data = await response.json();

      if (data && data.success) {
        // Refresh the list and close modal
        await fetchRequests();
        closeModal();
      } else {
        alert(`Failed to ${action.toLowerCase()} request: ${data?.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error(`Error processing request:`, err);
      alert(`Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const openModal = (request: any) => {
    setSelectedRequest(request);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedRequest(null);
  };

  // Render a loading state if the session is still being determined
  if (!session && loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Change Requests</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Review and approve pending changes.</p>
        </div>
        <button 
          onClick={fetchRequests} 
          disabled={loading}
          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh List'}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader />
        </div>
      ) : (
        <ChangeRequestTable
          requests={requests}
          onView={openModal}
          onApprove={openModal} // Open modal for approval to add remarks
          onReject={openModal}  // Open modal for rejection to add remarks
        />
      )}

      <ChangeRequestDetailModal
        isOpen={isModalOpen}
        onClose={closeModal}
        request={selectedRequest}
        onApprove={(req, remarks) => handleProcessRequest(req, 'APPROVE', remarks)}
        onReject={(req, remarks) => handleProcessRequest(req, 'REJECT', remarks)}
        isProcessing={processing}
      />
    </div>
  );
}
