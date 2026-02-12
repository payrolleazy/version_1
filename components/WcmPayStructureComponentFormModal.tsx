// D:\gemini_cli\version_1\components\WcmPayStructureComponentFormModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './ui/Button';
import Input from './ui/Input';
import DynamicJsonForm from './DynamicJsonForm'; // Import the new component

interface WcmPayStructureComponent {
  id?: string;
  pay_structure_id: string;
  component_id: string;
  tenant_id?: string; // Will be set by backend
  override_rules: any;
  eligibility_rules: any;
  display_order: number;
}

interface WcmComponent {
  id: string;
  component_code: string;
  name: string;
  description?: string;
  rules?: any; // Added rules property
}

interface PayStructure {
  id: string;
  name: string;
}

interface WcmPayStructureComponentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: WcmPayStructureComponent | null;
  session: any;
  wcmComponents: WcmComponent[]; // To populate component dropdown
  payStructures: PayStructure[]; // To populate pay structure dropdown
}

const UPSERT_PAY_STRUCTURE_COMPONENTS_CONFIG_ID = 'ad561470-20b5-4bb2-b415-b3332836896d';

export default function WcmPayStructureComponentFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  session,
  wcmComponents,
  payStructures,
}: WcmPayStructureComponentFormModalProps) {
  const [payStructureId, setPayStructureId] = useState('');
  const [componentId, setComponentId] = useState('');
  const [overrideRules, setOverrideRules] = useState<any>({}); // Changed to object
  const [eligibilityRules, setEligibilityRules] = useState('{}');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setPayStructureId(initialData.pay_structure_id);
      setComponentId(initialData.component_id);
      setOverrideRules(initialData.override_rules || {}); // Set as object
      setEligibilityRules(JSON.stringify(initialData.eligibility_rules || {}, null, 2));
      setDisplayOrder(initialData.display_order);
    } else {
      // Reset form for new entry
      setPayStructureId('');
      setComponentId('');
      setOverrideRules({}); // Set as object
      setEligibilityRules('{}');
      setDisplayOrder(0);
    }
    setError(null);
  }, [initialData, isOpen]);

  // Effect to auto-populate overrideRules when componentId changes
  useEffect(() => {
    if (componentId && wcmComponents.length > 0) {
      const selectedComponent = wcmComponents.find(comp => String(comp.id) === componentId);
      if (selectedComponent) {
        setOverrideRules(selectedComponent.rules || {}); // Set as object
      }
    } else if (!componentId) { // If no component is selected
      setOverrideRules({}); // Set as object
    }
  }, [componentId, wcmComponents]);

  const handleOverrideRulesChange = (updatedRules: any) => {
    setOverrideRules(updatedRules);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!session?.access_token) {
      setError('Authentication required.');
      setLoading(false);
      return;
    }

    try {
      // overrideRules is already an object, no need to parse
      const finalOverrideRules = overrideRules;

      let parsedEligibilityRules;
      try {
        parsedEligibilityRules = JSON.parse(eligibilityRules);
      } catch (jsonError) {
        setError('Invalid JSON for eligibility rules.');
        setLoading(false);
        return;
      }

      const payload: WcmPayStructureComponent = {
        pay_structure_id: payStructureId,
        component_id: componentId,
        override_rules: finalOverrideRules,
        eligibility_rules: parsedEligibilityRules,
        display_order: displayOrder,
      };

      // Do NOT send ID for update as per previous instructions for dependencies
      // if (initialData?.id) {
      //   payload.id = initialData.id;
      // }

      const response = await fetch('/api/a_crud_universal_bulk_upsert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          config_id: UPSERT_PAY_STRUCTURE_COMPONENTS_CONFIG_ID,
          input_rows: [payload],
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result || result.length === 0 || !result[0].success) {
        throw new Error(result[0]?.message || 'Failed to save WCM Pay Structure Component');
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
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Edit Pay Structure Component' : 'Create Pay Structure Component'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="payStructure" className="block text-sm font-medium text-gray-700">Pay Structure</label>
          <select
            id="payStructure"
            value={payStructureId}
            onChange={(e) => setPayStructureId(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            disabled={loading}
            required
          >
            <option value="">Select Pay Structure</option>
            {payStructures.map((ps) => (
              <option key={ps.id} value={ps.id}>
                {ps.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="component" className="block text-sm font-medium text-gray-700">Component</label>
          <select
            id="component"
            value={componentId}
            onChange={(e) => setComponentId(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            disabled={loading}
            required
          >
            <option value="">Select Component</option>
            {wcmComponents.map((comp) => (
              <option key={comp.id} value={comp.id}>
                {comp.name} ({comp.component_code})
              </option>
            ))}
          </select>
          {componentId && wcmComponents.find(comp => comp.id === componentId)?.description && (
            <div className="mt-1 p-2 w-full bg-gray-50 rounded-md text-sm text-gray-600">
              {wcmComponents.find(comp => comp.id === componentId)?.description}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="overrideRules" className="block text-sm font-medium text-gray-700">Override Rules (JSON)</label>
          <DynamicJsonForm
            formData={overrideRules}
            onFormChange={handleOverrideRulesChange}
            loading={loading}
          />
        </div>
        <div>
          <label htmlFor="eligibilityRules" className="block text-sm font-medium text-gray-700">Eligibility Rules (JSON)</label>
          <textarea
            id="eligibilityRules"
            value={eligibilityRules}
            onChange={(e) => setEligibilityRules(e.target.value)}
            rows={3}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:focus:border-indigo-500 sm:text-sm"
            disabled={loading}
          ></textarea>
        </div>
        <div>
          <label htmlFor="displayOrder" className="block text-sm font-medium text-gray-700">Display Order</label>
          <Input
            id="displayOrder"
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(parseInt(e.target.value))}
            required
            disabled={loading}
          />
        </div>
        {error && <p className="text-red-500 text-sm">Error: {error}</p>}
        <div className="flex justify-end space-x-2">
          <Button type="button" onClick={onClose} variant="secondary" disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading}>
            {initialData ? 'Save Changes' : 'Create Pay Structure Component'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
