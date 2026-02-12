// D:\gemini_cli\version_1\components\ActivationResultModal.tsx
'use client';

import React from 'react';
import Modal from './Modal';
import Button from './ui/Button';

interface ActivationResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: {
    success: boolean;
    new_version?: number;
    components_versioned?: number;
    activation_timestamp?: string;
    error?: string;
    error_code?: string;
  } | null;
}

export default function ActivationResultModal({ isOpen, onClose, result }: ActivationResultModalProps) {
  if (!result) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Activation Result">
      <div className="space-y-4">
        {result.success ? (
          <div className="text-center p-4 bg-green-100 text-green-800 rounded-lg">
            <h3 className="text-lg font-semibold">Activation Successful!</h3>
            <p>Pay structure successfully activated to version {result.new_version}.</p>
            <p>{result.components_versioned} components versioned.</p>
            <p className="text-sm text-gray-600">Activated at: {new Date(result.activation_timestamp || '').toLocaleString()}</p>
          </div>
        ) : (
          <div className="text-center p-4 bg-red-100 text-red-800 rounded-lg">
            <h3 className="text-lg font-semibold">Activation Failed</h3>
            <p>{result.error || 'An unknown error occurred during activation.'}</p>
            {result.error_code && <p className="text-sm italic">Error Code: {result.error_code}</p>}
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}