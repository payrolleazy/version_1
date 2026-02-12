'use client';

import React, { useState } from 'react';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';

interface ChangeRequest {
  id: number;
  target_table: string;
  target_record_id: string;
  change_type: string;
  status: string;
  created_at: string;
  proposed_data: any;
  review_remarks?: string;
}

interface ChangeRequestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ChangeRequest | null;
  onApprove: (request: ChangeRequest, remarks: string) => void;
  onReject: (request: ChangeRequest, remarks: string) => void;
  isProcessing: boolean;
}

export default function ChangeRequestDetailModal({
  isOpen,
  onClose,
  request,
  onApprove,
  onReject,
  isProcessing
}: ChangeRequestDetailModalProps) {
  const [remarks, setRemarks] = useState('');

  if (!request) return null;

  const handleApprove = () => {
    onApprove(request, remarks);
    setRemarks('');
  };

  const handleReject = () => {
    onReject(request, remarks);
    setRemarks('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Review Request #${request.id}`}>
      <div className="space-y-4">
        {/* Meta Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-semibold text-gray-500">Table:</span> {request.target_table}
          </div>
          <div>
            <span className="font-semibold text-gray-500">Record ID:</span> {request.target_record_id}
          </div>
          <div>
            <span className="font-semibold text-gray-500">Type:</span> {request.change_type}
          </div>
          <div>
            <span className="font-semibold text-gray-500">Submitted:</span> {new Date(request.created_at).toLocaleString()}
          </div>
        </div>

        {/* Proposed Data */}
        <div className="border rounded-md p-3 bg-gray-50 dark:bg-gray-900 overflow-auto max-h-60">
          <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Proposed Data:</h4>
          <pre className="text-xs font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
            {JSON.stringify(request.proposed_data, null, 2)}
          </pre>
        </div>

        {/* Remarks Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Review Remarks (Optional)
          </label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            rows={3}
            placeholder="Enter reason for approval or rejection..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleReject} 
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Reject'}
          </Button>
          <Button 
            variant="default" 
            className="bg-green-600 hover:bg-green-700 text-white" 
            onClick={handleApprove} 
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Approve'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
