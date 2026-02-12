import React, { useState, useEffect } from 'react';
import Modal from './Modal'; // Assuming a generic Modal component exists
import Button from './ui/Button';
import Input from './ui/Input';

interface WcmComponent {
  id?: string; // Optional for new components
  tenant_id?: string;
  component_code: string;
  name: string;
  component_type: string;
  rules: any;
  is_active: boolean;
  is_included_in_arrear_calc?: boolean; // Add this line
  effective_from?: string;
  effective_to?: string | null;
}

interface WcmComponentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: WcmComponent | null;
  session: any; // Add session prop
}

const UPSERT_CONFIG_ID = '8c2ce3d3-45cc-4afc-8253-03facd158c64';
const READ_RULE_TEMPLATE_CONFIG_ID = '3bceb2cc-fee0-4778-b8fc-b8e3a8ab9e77';

export default function WcmComponentFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  session, // Destructure session from props
}: WcmComponentFormModalProps) {
  const [componentCode, setComponentCode] = useState('');
  const [name, setName] = useState('');
  const [componentType, setComponentType] = useState('EARNING'); // Default value
  
  const [rules, setRules] = useState<string>('{}'); // Store as string, parse to JSONB on submit
  const [isActive, setIsActive] = useState(true);
  const [isIncludedInArrearCalc, setIsIncludedInArrearCalc] = useState(false); // New state
  const [effectiveFrom, setEffectiveFrom] = useState(''); // New state
  const [effectiveTo, setEffectiveTo] = useState(''); // New state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ruleTemplates, setRuleTemplates] = useState<{ template_id: string; description: string }[]>([]);
  const [selectedRuleTemplateId, setSelectedRuleTemplateId] = useState<string>('');

  useEffect(() => {
    if (initialData) {
      setComponentCode(initialData.component_code);
      setName(initialData.name);
      setComponentType(initialData.component_type);
      setRules(JSON.stringify(initialData.rules, null, 2)); // Pretty print JSON
      setIsActive(initialData.is_active);
      setIsIncludedInArrearCalc(initialData.is_included_in_arrear_calc || false); // Initialize new state
      setEffectiveFrom(initialData.effective_from || '');
      setEffectiveTo(initialData.effective_to || '');
    } else {
      // Reset form for new entry
      setComponentCode('');
      setName('');
      setComponentType('EARNING');
      
      setRules('{}');
      setIsActive(true);
      setIsIncludedInArrearCalc(false); // Reset new state
      setEffectiveFrom(new Date().toISOString().split('T')[0]); // Default to current date
      setEffectiveTo('');
      setSelectedRuleTemplateId(''); // Reset selected template
    }
    setError(null);
  }, [isOpen, session]);

  // Fetch and populate rules when a template is selected
  useEffect(() => {
    const fetchSelectedRuleTemplate = async () => {
      if (!selectedRuleTemplateId || !session?.access_token) {
        setRules('{}'); // Reset rules if no template is selected
        return;
      }

      try {
        const response = await fetch('/api/a_crud_universal_read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config_id: READ_RULE_TEMPLATE_CONFIG_ID,
            params: {
              filters: {
                template_id: selectedRuleTemplateId,
              },
            },
            accessToken: session.access_token,
          }),
        });
        const result = await response.json();

        if (response.ok && result.success && result.data && result.data.length > 0) {
          setRules(JSON.stringify(result.data[0].rule_template, null, 2));
        } else {
          console.error('Failed to fetch selected rule template:', result.message);
          setRules('{}'); // Reset rules on error
        }
      } catch (err) {
        console.error('Error fetching selected rule template:', err);
        setRules('{}'); // Reset rules on error
      }
    };

    fetchSelectedRuleTemplate();
  }, [selectedRuleTemplateId, session]);



  // Fetch rule templates on modal open
  useEffect(() => {
    const fetchRuleTemplates = async () => {
      if (!session?.access_token) return;

      try {
        const response = await fetch('/api/a_crud_universal_read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config_id: READ_RULE_TEMPLATE_CONFIG_ID,
            params: {
              orderBy: [['template_id', 'ASC']],
            },
            accessToken: session.access_token,
          }),
        });
        const result = await response.json();

        if (response.ok && result.success) {
          setRuleTemplates(result.data || []);
        } else {
          console.error('Failed to fetch rule templates:', result.message);
        }
      } catch (err) {
        console.error('Error fetching rule templates:', err);
      }
    };

    if (isOpen && session) {
      fetchRuleTemplates();
    }
  }, [isOpen, session]);

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
      let parsedRules;
      try {
        parsedRules = JSON.parse(rules);
      } catch (jsonError) {
        setError('Invalid JSON for rules.');
        setLoading(false);
        return;
      }

      const payload: WcmComponent = {
        component_code: componentCode,
        name: name,
        component_type: componentType,
        rules: parsedRules,
        is_active: isActive,
        is_included_in_arrear_calc: isIncludedInArrearCalc, // Include in payload
        effective_from: effectiveFrom,
        effective_to: effectiveTo || null,
      };

      // If editing, include the ID for upsert to match existing record
      if (initialData?.id) {
        payload.id = initialData.id;
      }

      // The tenant_id is handled by the backend function based on the user's session
      // No need to explicitly send it from the frontend unless the config requires it

      const response = await fetch('/api/a_crud_universal_bulk_upsert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          config_id: UPSERT_CONFIG_ID,
          input_rows: [payload],
          accessToken: session.access_token, // Pass accessToken for the Edge Function
        }),
      });

      const result = await response.json();

      if (!response.ok || !result || result.length === 0 || !result[0].success) {
        throw new Error(result[0]?.message || 'Failed to save WCM component');
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
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Edit WCM Component' : 'Create WCM Component'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="componentCode" className="block text-sm font-medium text-gray-700">Component Code</label>
          <Input
            id="componentCode"
            type="text"
            value={componentCode}
            onChange={(e) => setComponentCode(e.target.value)}
            required
            disabled={loading || !!initialData?.id} // Disable editing component code if it's an existing record
          />
        </div>
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="componentType" className="block text-sm font-medium text-gray-700">Component Type</label>
          <select
            id="componentType"
            value={componentType}
            onChange={(e) => setComponentType(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            disabled={loading}
          >
            <option value="EARNING">EARNING</option>
            <option value="DEDUCTION">DEDUCTION</option>
            <option value="BENEFIT">BENEFIT</option>
          </select>
        </div>


        {/* Rule Template Selection */}
        <div>
          <label htmlFor="ruleTemplateSelect" className="block text-sm font-medium text-gray-700">Select Rule Template</label>
          <select
            id="ruleTemplateSelect"
            value={selectedRuleTemplateId}
            onChange={(e) => setSelectedRuleTemplateId(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            disabled={loading}
          >
            <option value="">-- Select a template --</option>
            {ruleTemplates.map((template) => (
              <option key={template.template_id} value={template.template_id}>
                {template.template_id}
              </option>
            ))}
          </select>
        </div>

        {/* Rule Description Display */}
        {selectedRuleTemplateId && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Rule Description</label>
            <div className="mt-1 p-4 w-full bg-gradient-to-r from-[#faf7ff] to-[#f5f8ff] rounded-lg shadow-inner text-sm text-gray-700 h-24 overflow-y-auto border border-gray-200 text-justify">
              {ruleTemplates.find(t => t.template_id === selectedRuleTemplateId)?.description || 'No description available.'}
            </div>
          </div>
        )}
        <div>
          <label htmlFor="effectiveFrom" className="block text-sm font-medium text-gray-700">Effective From</label>
          <Input
            id="effectiveFrom"
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            required
            disabled={loading}
            readOnly={!!initialData}
          />
        </div>
        <div>
          <label htmlFor="effectiveTo" className="block text-sm font-medium text-gray-700">Effective To</label>
          <Input
            id="effectiveTo"
            type="date"
            value={effectiveTo}
            onChange={(e) => setEffectiveTo(e.target.value)}
            disabled={loading}
            readOnly={!!initialData}
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
        <div className="flex items-center justify-between">
          <label htmlFor="isIncludedInArrearCalc" className="text-sm font-medium text-gray-700">Is Included In Arrear Calculation</label>
          <button
            type="button"
            id="isIncludedInArrearCalc"
            name="isIncludedInArrearCalc"
            onClick={() => setIsIncludedInArrearCalc(!isIncludedInArrearCalc)}
            className={`${
              isIncludedInArrearCalc ? 'bg-gradient-to-r from-[#d0b9df] to-[#a9b9df]' : 'bg-gray-200'
            } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
            role="switch"
            aria-checked={isIncludedInArrearCalc}
            disabled={loading}
          >
            <span className="sr-only">Toggle Is Included In Arrear Calculation Status</span>
            <span
              aria-hidden="true"
              className={`${
                isIncludedInArrearCalc ? 'translate-x-5' : 'translate-x-0'
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
            {initialData ? 'Save Changes' : 'Create Component'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
