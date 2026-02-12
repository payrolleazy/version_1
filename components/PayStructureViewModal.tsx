
'use client';

import React, { useState, useEffect } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Modal from '@/components/Modal';

// Define the PayStructure interface directly in the file
interface PayStructure {
  id: string;
  tenant_id: string;
  structure_code: string;
  name: string;
  description: string | null;
  version: number;
  status: string;
  pay_grade_id: number | null;
  applicability_rules: any;
  approval_status: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  activated_at: string | null;
  activated_by: string | null;
  deleted_at: string | null;
}

interface PayStructureViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  payStructure: PayStructure | null;
}

export default function PayStructureViewModal({ isOpen, onClose, payStructure }: PayStructureViewModalProps) {
  const { session } = useSessionContext();
  const [fullPayStructure, setFullPayStructure] = useState<PayStructure | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFullPayStructure = async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/a_crud_universal_read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config_id: '6a8b60fc-5c09-4f2f-ab73-9869d3245dff', // Assuming this config fetches all fields
            params: { filters: { id: id } },
            accessToken: session?.access_token,
          }),
        });
        const result = await response.json();
        if (result.success && result.data.length > 0) {
          setFullPayStructure(result.data[0]);
        } else {
          throw new Error(result.message || 'Failed to fetch pay structure details');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && payStructure?.id) {
      fetchFullPayStructure(payStructure.id);
    }
  }, [isOpen, payStructure, session]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="View Pay Structure">
      {loading && <div className="p-8 text-center">Loading...</div>}
      {error && <div className="p-8 text-center text-red-500">Error: {error}</div>}
      {fullPayStructure && !loading && (
        <div className="p-8 bg-gradient-to-r from-[#faf7ff] to-[#f5f8ff] rounded-lg shadow-inner">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Pay Structure Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-gray-700">
            
            <div><strong>Structure Code:</strong> {fullPayStructure.structure_code}</div>
            <div><strong>Name:</strong> {fullPayStructure.name}</div>
            <div><strong>Status:</strong> <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${fullPayStructure.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{fullPayStructure.status}</span></div>
            <div><strong>Version:</strong> {fullPayStructure.version}</div>
            <div><strong>Pay Grade ID:</strong> {fullPayStructure.pay_grade_id || 'N/A'}</div>
            <div><strong>Approval Status:</strong> {fullPayStructure.approval_status || 'N/A'}</div>

            <div className="md:col-span-2 mt-4">
                <h3 className="text-lg font-semibold mb-2 text-gray-800">Description</h3>
                <p className="text-gray-600">{fullPayStructure.description || 'No description provided.'}</p>
            </div>

            <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold mb-2 text-gray-800">Applicability Rules</h3>
              <pre className="p-4 mt-1 bg-gray-100 rounded border border-gray-200 shadow-inner text-sm whitespace-pre-wrap overflow-auto">
                {JSON.stringify(fullPayStructure.applicability_rules, null, 2)}
              </pre>
            </div>

            <div className="md:col-span-2 mt-4 border-t pt-4">
                <h3 className="text-lg font-semibold mb-2 text-gray-800">Metadata</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-500">
                    <div><strong>ID:</strong> {fullPayStructure.id}</div>
                    <div><strong>Created At:</strong> {new Date(fullPayStructure.created_at).toLocaleString()}</div>
                    <div><strong>Updated At:</strong> {new Date(fullPayStructure.updated_at).toLocaleString()}</div>
                </div>
            </div>

          </div>
        </div>
      )}
    </Modal>
  );
}
