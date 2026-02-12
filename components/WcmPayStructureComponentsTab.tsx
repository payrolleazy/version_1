// D:\gemini_cli\version_1\components\WcmPayStructureComponentsTab.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from './ui/Button';
import Input from './ui/Input';
import Loader from './ui/Loader';
import WcmPayStructureComponentFormModal from './WcmPayStructureComponentFormModal'; // Import the new form modal
import ConfigurePayStructureComponentRulesModal from './WcmPayStructureComponentRulesModal'; // Import the new rules modal

interface WcmPayStructureComponent {
  id: string;
  pay_structure_id: string;
  component_id: string;
  tenant_id: string;
  override_rules: any;
  eligibility_rules: any;
  display_order: number;
  created_at: string;
  updated_at: string;
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
  // ... other relevant fields for mapping IDs to names
}

const READ_PAY_STRUCTURE_COMPONENTS_CONFIG_ID = '1e7ebd84-bcfa-4e07-b47b-6500eb0efba5';
const UPSERT_PAY_STRUCTURE_COMPONENTS_CONFIG_ID = 'ad561470-20b5-4bb2-b415-b3332836896d';
const READ_COMPONENTS_CONFIG_ID = '0872c31a-89cb-4b33-bff6-b5b3e954a705'; // Existing WCM Components Read Config ID
const READ_PAY_STRUCTURES_CONFIG_ID = '6a8b60fc-5c09-4f2f-ab73-9869d3245dff';

export default function WcmPayStructureComponentsTab() {
  const { session } = useSessionContext();
  const [payStructureComponents, setPayStructureComponents] = useState<WcmPayStructureComponent[]>([]);
  const [wcmComponents, setWcmComponents] = useState<WcmComponent[]>([]);
  const [payStructures, setPayStructures] = useState<PayStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for form modal
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingPayStructureComponent, setEditingPayStructureComponent] = useState<WcmPayStructureComponent | null>(null);

  // State for rules modal
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [configuringPayStructureComponent, setConfiguringPayStructureComponent] = useState<WcmPayStructureComponent | null>(null);

  // Function to fetch WCM Components (to map IDs to names)
  const fetchWcmComponents = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const response = await fetch('/api/a_crud_universal_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: READ_COMPONENTS_CONFIG_ID,
          params: {
            limit: 9999,
          },
          accessToken: session.access_token,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch WCM components for mapping');
      }
      setWcmComponents(result.data || []);
    } catch (err: any) {
      console.error('Error fetching WCM components:', err);
      setError(err.message);
    }
  }, [session]);

  // Function to fetch Pay Structures (to map IDs to names)
  const fetchPayStructures = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const response = await fetch('/api/a_crud_universal_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: READ_PAY_STRUCTURES_CONFIG_ID,
          params: {
            limit: 9999,
          },
          accessToken: session.access_token,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch Pay Structures for mapping');
      }
      setPayStructures(result.data || []);
    } catch (err: any) {
      console.error('Error fetching Pay Structures:', err);
      setError(err.message);
    }
  }, [session]);


  // Function to fetch WCM Pay Structure Components
  const fetchWcmPayStructureComponents = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!session?.access_token) {
      setError('Authentication required.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/a_crud_universal_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: READ_PAY_STRUCTURE_COMPONENTS_CONFIG_ID,
          params: {}, // No specific filters/sorting for now
          accessToken: session.access_token,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch WCM Pay Structure Components');
      }
      setPayStructureComponents(result.data || []);
    } catch (err: any) {
      console.error('Error fetching WCM Pay Structure Components:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchWcmComponents();
      fetchPayStructures();
      fetchWcmPayStructureComponents();
    }
  }, [session, fetchWcmComponents, fetchPayStructures, fetchWcmPayStructureComponents]);

  // Helper to get component name from ID
  const getComponentName = (id: string) => {
    const component = wcmComponents.find(comp => comp.id === id);
    return component ? `${component.name} (${component.component_code})` : id;
  };

  // Helper to get pay structure name from ID
  const getPayStructureName = (id: string) => {
    const payStructure = payStructures.find(ps => ps.id === id);
    return payStructure ? payStructure.name : id;
  };

  const handleEditClick = (payStructureComponent: WcmPayStructureComponent) => {
    setEditingPayStructureComponent(payStructureComponent);
    setIsFormModalOpen(true);
  };

  const handleConfigureRulesClick = (payStructureComponent: WcmPayStructureComponent) => {
    setConfiguringPayStructureComponent(payStructureComponent);
    setIsRulesModalOpen(true);
  };

  const handleSaveOverrideRules = async (updatedOverrideRules: any) => {
    if (!configuringPayStructureComponent || !session?.access_token) {
      setError('Authentication required or no component selected.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { id, ...restOfComponent } = configuringPayStructureComponent;
      const payload: WcmPayStructureComponent = {
        ...restOfComponent,
        override_rules: updatedOverrideRules,
      };

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
        throw new Error(result[0]?.message || 'Failed to save override rules');
      }

      fetchWcmPayStructureComponents(); // Refresh the list
      setIsRulesModalOpen(false); // Close the rules modal
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return <p className="text-red-500">Error: {error}</p>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">WCM Pay Structure Components</h2>
        <Button onClick={() => { setEditingPayStructureComponent(null); setIsFormModalOpen(true); }}>
          Add New Pay Structure Component
        </Button>
      </div>

      {payStructureComponents.length === 0 ? (
        <p>No pay structure components found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b text-left">ID</th>
                <th className="py-2 px-4 border-b text-left">Pay Structure</th>
                <th className="py-2 px-4 border-b text-left">Component</th>
                <th className="py-2 px-4 border-b text-left">Display Order</th>
                <th className="py-2 px-4 border-b text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payStructureComponents.map((psc) => (
                <tr key={String(psc.id)}>
                  <td className="py-2 px-4 border-b">{psc.id}</td>
                  <td className="py-2 px-4 border-b">{getPayStructureName(psc.pay_structure_id)}</td>
                  <td className="py-2 px-4 border-b">{getComponentName(psc.component_id)}</td>
                  <td className="py-2 px-4 border-b">{psc.display_order}</td>
                  <td className="py-2 px-4 border-b">
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEditClick(psc)}>Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleConfigureRulesClick(psc)}>Configure Rules</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pay Structure Component Form Modal */}
      <WcmPayStructureComponentFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={() => {
          setIsFormModalOpen(false);
          fetchWcmPayStructureComponents();
        }}
        initialData={editingPayStructureComponent}
        session={session}
        wcmComponents={wcmComponents}
        payStructures={payStructures}
      />

      {/* Configure Rules Modal */}
      {configuringPayStructureComponent && (
        <ConfigurePayStructureComponentRulesModal
          isOpen={isRulesModalOpen}
          onClose={() => setIsRulesModalOpen(false)}
          onSave={handleSaveOverrideRules}
          initialOverrideRules={configuringPayStructureComponent.override_rules}
          baseComponentRules={wcmComponents.find(comp => comp.id === configuringPayStructureComponent.component_id)?.rules || {}}
          componentName={getComponentName(configuringPayStructureComponent.component_id)}
          loading={loading}
        />
      )}
    </div>
  );
}

