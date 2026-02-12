'use client';

import React, { useState, useEffect } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/Modal';

interface PayrollArea {
  id: number;
  tenant_id: string;
  area_code: string;
  description: string | null;
  periodicity: string;
  currency_code: string;
  country_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface PayrollAreaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: PayrollArea; // Optional: for editing existing payroll areas
}

const UPSERT_CONFIG_ID = 'b7f91d1b-a1e6-43e2-81a9-c17432cdedb6';

export default function PayrollAreaFormModal({ isOpen, onClose, onSuccess, initialData }: PayrollAreaFormModalProps) {
  const { session } = useSessionContext();
  const [formData, setFormData] = useState<Partial<PayrollArea>>({});
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData(initialData);
      } else {
        setFormData({
          area_code: '',
          description: '',
          periodicity: 'MONTHLY',
          currency_code: 'INR',
          country_code: 'IN',
          is_active: true,
          created_by: session?.user?.id || null,
        });
      }
      setError(null);
    }
  }, [isOpen, initialData, session]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    setFormData(prev => ({
      ...prev,
      [name]: isCheckbox ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);

    try {
      if (!session?.access_token) {
        throw new Error('Authentication required.');
      }

      const payload: Partial<PayrollArea> = {
        ...formData,
        created_by: session?.user?.id || null,
      };

      // If initialData is present, it's an update, so include the ID
      if (initialData && initialData.id) {
        payload.id = initialData.id;
      }

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
        throw new Error(result[0]?.message || 'Failed to save payroll area');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const modalTitle = initialData ? 'Edit Payroll Area' : 'Create New Payroll Area';
  const submitButtonText = initialData ? 'Update Payroll Area' : 'Create Payroll Area';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="area_code" className="block text-sm font-medium text-gray-700">Area Code</label>
          <Input type="text" id="area_code" name="area_code" value={formData.area_code || ''} onChange={handleInputChange} required={!initialData} disabled={!!initialData} />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
          <textarea id="description" name="description" rows={3} value={formData.description || ''} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
        </div>
        <div>
          <label htmlFor="periodicity" className="block text-sm font-medium text-gray-700">Periodicity</label>
          <select id="periodicity" name="periodicity" value={formData.periodicity || 'MONTHLY'} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required>
            <option value="MONTHLY">MONTHLY</option>
            <option value="WEEKLY">WEEKLY</option>
            <option value="BI_WEEKLY">BI_WEEKLY</option>
            <option value="QUARTERLY">QUARTERLY</option>
            <option value="ANNUAL">ANNUAL</option>
            <option value="ADHOC">ADHOC</option>
          </select>
        </div>
        <div>
          <label htmlFor="currency_code" className="block text-sm font-medium text-gray-700">Currency Code</label>
          <Input type="text" id="currency_code" name="currency_code" value={formData.currency_code || ''} onChange={handleInputChange} required />
        </div>
        <div>
          <label htmlFor="country_code" className="block text-sm font-medium text-gray-700">Country Code</label>
          <Input type="text" id="country_code" name="country_code" value={formData.country_code || ''} onChange={handleInputChange} required />
        </div>
        <div className="flex items-center justify-between">
          <label htmlFor="is_active" className="block text-sm font-medium text-gray-700">Is Active?</label>
          <button
            type="button"
            id="is_active"
            name="is_active"
            onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
            className={`${
              formData.is_active ? 'bg-gradient-to-r from-[#d0b9df] to-[#a9b9df]' : 'bg-gray-200'
            } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
            role="switch"
            aria-checked={formData.is_active}
          >
            <span className="sr-only">Is Active?</span>
            <span
              aria-hidden="true"
              className={`${
                formData.is_active ? 'translate-x-5' : 'translate-x-0'
              } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
            />
          </button>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        <div className="flex justify-end space-x-2 mt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={formLoading}>{submitButtonText}</Button>
        </div>
      </form>
    </Modal>
  );
}
