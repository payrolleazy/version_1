'use client';

import React, { useState } from 'react';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';

interface ActionConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (comments: string) => Promise<void>;
  actionType: string;
  candidateName: string;
}

const ACTION_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  APPROVE: { label: 'Approve', color: 'bg-green-600 hover:bg-green-700', description: 'This will approve the candidate and start the onboarding workflow.' },
  REJECT: { label: 'Reject', color: 'bg-red-600 hover:bg-red-700', description: 'This will reject the candidate. The workflow will be terminated.' },
  ON_HOLD: { label: 'Put On Hold', color: 'bg-gray-600 hover:bg-gray-700', description: 'This will pause the onboarding process. It can be resumed later.' },
  RESTART: { label: 'Restart', color: 'bg-blue-600 hover:bg-blue-700', description: 'This will restart the onboarding workflow from the beginning.' },
  CANCEL: { label: 'Cancel Workflow', color: 'bg-red-600 hover:bg-red-700', description: 'This will permanently cancel the onboarding workflow.' },
};

export default function ActionConfirmModal({ isOpen, onClose, onConfirm, actionType, candidateName }: ActionConfirmModalProps) {
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const config = ACTION_CONFIG[actionType] || { label: actionType, color: 'bg-blue-600', description: '' };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onConfirm(comments);
      setComments('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${config.label} - ${candidateName}`} maxWidth="max-w-lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{config.description}</p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Add optional comments..."
          />
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${config.color}`}
          >
            {submitting ? 'Processing...' : config.label}
          </button>
        </div>
      </div>
    </Modal>
  );
}
