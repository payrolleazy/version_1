// D:\gemini_cli\version_1\components\WcmComponentDependencyFormModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './ui/Button';
import Input from './ui/Input';

interface WcmComponentDependency {
  id?: string; // Optional for new dependencies
  tenant_id?: string;
  source_component_id: string;
  dependent_component_id: string;
  processing_sequence: number;
  is_active: boolean;
}

interface WcmComponent {
  id: string;
  component_code: string;
  name: string;
  description?: string; // Added description field
}

interface WcmComponentDependencyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: WcmComponentDependency | null;
  session: any;
  wcmComponents: WcmComponent[]; // To populate dropdowns
}

const UPSERT_DEPENDENCIES_CONFIG_ID = '8c544c80-281d-48b7-9fb3-c01ffa4fde54';

export default function WcmComponentDependencyFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  session,
  wcmComponents,
}: WcmComponentDependencyFormModalProps) {
  const [sourceComponentId, setSourceComponentId] = useState('');
  const [dependentComponentId, setDependentComponentId] = useState('');
  const [processingSequence, setProcessingSequence] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setSourceComponentId(initialData.source_component_id);
      setDependentComponentId(initialData.dependent_component_id);
      setProcessingSequence(initialData.processing_sequence);
      setIsActive(initialData.is_active);
    } else {
      // Reset form for new entry
      setSourceComponentId('');
      setDependentComponentId('');
      setProcessingSequence(0);
      setIsActive(true);
    }
    setError(null);
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!session?.access_token) {
      setError('Authentication required.');
      setLoading(false);
      return;
    }

    // TODO: Replace with actual config_id for wcm_component_dependencies upsert
    if (UPSERT_DEPENDENCIES_CONFIG_ID === 'YOUR_DEPENDENCIES_UPSERT_CONFIG_ID') {
      setError('UPSERT_DEPENDENCIES_CONFIG_ID is not set. Please configure it.');
      setLoading(false);
      return;
    }

    try {
      const payload: WcmComponentDependency = {
        source_component_id: sourceComponentId,
        dependent_component_id: dependentComponentId,
        processing_sequence: processingSequence,
        is_active: isActive,
      };

      const response = await fetch('/api/a_crud_universal_bulk_upsert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          config_id: UPSERT_DEPENDENCIES_CONFIG_ID,
          input_rows: [payload],
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result || result.length === 0 || !result[0].success) {
        throw new Error(result[0]?.message || 'Failed to save WCM component dependency');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Edit Component Dependency' : 'Create Component Dependency'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="sourceComponent" className="block text-sm font-medium text-gray-700">Source Component</label>
          <select
            id="sourceComponent"
            value={sourceComponentId}
            onChange={(e) => setSourceComponentId(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            disabled={loading}
            required
          >
            <option value="">Select Source Component</option>
            {wcmComponents.map((comp) => (
              <option key={comp.id} value={comp.id}>
                {comp.name} ({comp.component_code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dependentComponent" className="block text-sm font-medium text-gray-700">Dependent Component</label>
          <select
            id="dependentComponent"
            value={dependentComponentId}
            onChange={(e) => setDependentComponentId(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            disabled={loading}
            required
          >
            <option value="">Select Dependent Component</option>
            {wcmComponents.map((comp) => (
              <option key={comp.id} value={comp.id}>
                {comp.name} ({comp.component_code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="processingSequence" className="block text-sm font-medium text-gray-700">Processing Sequence</label>
          <Input
            id="processingSequence"
            type="number"
            value={processingSequence}
            onChange={(e) => setProcessingSequence(parseInt(e.target.value))}
            required
            disabled={loading}
          />
        </div>
        <div className="flex items-center justify-between">
          <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Is Active</label>
          <button
            type="button"
            id="isActive"
            name="isActive"
            onClick={() => setIsActive(!isActive)}
            className={`${
              isActive ? 'bg-gradient-to-r from-[#d0b9df] to-[#a9b9df]' : 'bg-gray-200'
            } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
            role="switch"
            aria-checked={isActive}
            disabled={loading}
          >
            <span className="sr-only">Toggle Active Status</span>
            <span
              aria-hidden="true"
              className={`${
                isActive ? 'translate-x-5' : 'translate-x-0'
              } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out`}
            />
          </button>
        </div>
        {error && <p className="text-red-500 text-sm">Error: {error}</p>}
        <div className="flex justify-end space-x-2">
          <Button type="button" onClick={onClose} variant="secondary" disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading}>
            {initialData ? 'Save Changes' : 'Create Dependency'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
