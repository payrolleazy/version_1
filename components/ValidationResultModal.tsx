// D:\gemini_cli\version_1\components\ValidationResultModal.tsx
'use client';

import React from 'react';
import Modal from './Modal';
import Button from './ui/Button';

interface ValidationResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: {
    is_valid: boolean;
    errors: Array<{ error: string; message: string; affected_components?: string[] }>;
    component_count: number;
  } | null;
}

export default function ValidationResultModal({ isOpen, onClose, result }: ValidationResultModalProps) {
  if (!result) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Validation Result">
      <div className="space-y-4">
        {result.is_valid ? (
          <div className="text-center p-4 bg-green-100 text-green-800 rounded-lg">
            <h3 className="text-lg font-semibold">Validation Successful!</h3>
            <p>This pay structure is valid and ready for activation.</p>
            <p>Total components checked: {result.component_count}</p>
          </div>
        ) : (
          <div className="text-center p-4 bg-red-100 text-red-800 rounded-lg">
            <h3 className="text-lg font-semibold">Validation Failed</h3>
            <p>Please resolve the following errors before activating:</p>
            <ul className="mt-2 text-left list-disc list-inside">
              {result.errors.map((err, index) => (
                <li key={index} className="mt-1">
                  <strong>{err.error}:</strong> {err.message}
                  {err.affected_components && (
                    <span className="text-sm italic"> (Components: {err.affected_components.join(', ')})</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}