'use client';

import React, { useState, useEffect } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/Modal';

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

// Simplified props for create-only modal
interface PayStructureFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const UPSERT_CONFIG_ID = '5821df0b-b5ad-4252-97f9-82bfade23a82';

export default function PayStructureFormModal({ isOpen, onClose, onSuccess }: PayStructureFormModalProps) {
  const { session } = useSessionContext();
  const [formData, setFormData] = useState<Partial<PayStructure>>({});
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // useEffect now only resets the form to a blank state when the modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        structure_code: '',
        name: '',
        description: '',
        pay_grade_id: null,
        applicability_rules: '[]',
        created_by: session?.user?.id || null,
        activated_by: null,
      });
      setError(null);
    }
  }, [isOpen, session]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? null : Number(value)) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);

    try {
      if (!session?.access_token) {
        throw new Error('Authentication required to save pay structure.');
      }

      const payload: Partial<PayStructure> = {
        ...formData,
        version: formData.version ? Number(formData.version) : 1,
        applicability_rules: JSON.parse(formData.applicability_rules as string || '[]'),
        pay_grade_id: formData.pay_grade_id === null ? null : Number(formData.pay_grade_id),
        activated_at: formData.activated_at ? new Date(formData.activated_at).toISOString() : null,
        created_by: session?.user?.id || null,
      };

      // Remove fields from the payload as requested
      delete payload.version;
      delete payload.status;
      delete payload.approval_status;
      delete payload.activated_at;

      // The logic for adding payload.id is removed

      const response = await fetch('/api/a_crud_universal_bulk_upsert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          config_id: UPSERT_CONFIG_ID,
          input_rows: [payload],
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();

      if (!response.ok || !Array.isArray(result) || result.length === 0 || !result[0].success) {
        throw new Error(result[0]?.message || 'Failed to save pay structure');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
      console.error('Form submission error:', err);
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Pay Structure">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Form fields remain the same */}
        <div>
          <label htmlFor="structure_code" className="block text-sm font-medium text-gray-700">Structure Code</label>
          <Input
            type="text"
            id="structure_code"
            name="structure_code"
            value={formData.structure_code || ''}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
          <Input
            type="text"
            id="name"
            name="name"
            value={formData.name || ''}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            id="description"
            name="description"
            rows={3}
            value={formData.description || ''}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          ></textarea>
        </div>
        <div>
          <label htmlFor="pay_grade_id" className="block text-sm font-medium text-gray-700">Pay Grade ID (Optional)</label>
          <Input
            type="number"
            id="pay_grade_id"
            name="pay_grade_id"
            value={formData.pay_grade_id || ''}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label htmlFor="applicability_rules" className="block text-sm font-medium text-gray-700">Applicability Rules (JSON)</label>
          <textarea
            id="applicability_rules"
            name="applicability_rules"
            rows={5}
            value={formData.applicability_rules as string || ''}
            onChange={handleInputChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono"
          ></textarea>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        <div className="flex justify-end space-x-2 mt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={formLoading}>
            {formLoading ? 'Saving...' : 'Create Pay Structure'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
