// D:\gemini_cli\version_1\components\WcmComponentDependenciesTab.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from './ui/Button';
import Input from './ui/Input';
import Loader from './ui/Loader';
import WcmComponentDependencyFormModal from './WcmComponentDependencyFormModal'; // Import the new modal

interface WcmComponentDependency {
  id: string;
  tenant_id: string;
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

const READ_DEPENDENCIES_CONFIG_ID = 'bd863906-a350-4ded-bb36-6c3cd6c286bc';
const READ_COMPONENTS_CONFIG_ID = '0872c31a-89cb-4b33-bff6-b5b3e954a705'; // Existing WCM Components Read Config ID
const UPSERT_DEPENDENCIES_CONFIG_ID = 'YOUR_DEPENDENCIES_UPSERT_CONFIG_ID'; // Placeholder for upsert config

export default function WcmComponentDependenciesTab() {
  const { session } = useSessionContext();
  const [dependencies, setDependencies] = useState<WcmComponentDependency[]>([]);
  const [wcmComponents, setWcmComponents] = useState<WcmComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingDependency, setEditingDependency] = useState<WcmComponentDependency | null>(null);

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

  // Function to fetch WCM Component Dependencies
  const fetchWcmComponentDependencies = useCallback(async () => {
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
          config_id: READ_DEPENDENCIES_CONFIG_ID,
          params: {},
          accessToken: session.access_token,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch WCM component dependencies');
      }
      setDependencies(result.data || []);
    } catch (err: any) {
      console.error('Error fetching WCM component dependencies:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchWcmComponents();
      fetchWcmComponentDependencies();
    }
  }, [session, fetchWcmComponents, fetchWcmComponentDependencies]);

  // Helper to get component name from ID
  const getComponentName = (id: string) => {
    const component = wcmComponents.find(comp => comp.id === id);
    return component ? `${component.name} (${component.component_code})` : id;
  };

  const handleEditClick = (dependency: WcmComponentDependency) => {
    setEditingDependency(dependency);
    setIsFormModalOpen(true);
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
        <h2 className="text-2xl font-bold">WCM Component Dependencies</h2>
        <Button onClick={() => { setEditingDependency(null); setIsFormModalOpen(true); }}>
          Add New Dependency
        </Button>
      </div>

      {dependencies.length === 0 ? (
        <p>No component dependencies found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b text-left">Source Component</th>
                <th className="py-2 px-4 border-b text-left">Dependent Component</th>
                <th className="py-2 px-4 border-b text-left">Processing Sequence</th>
                <th className="py-2 px-4 border-b text-left">Active</th>
                <th className="py-2 px-4 border-b text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dependencies.map((dep) => (
                <tr key={dep.id}>
                  <td className="py-2 px-4 border-b">{getComponentName(dep.source_component_id)}</td>
                  <td className="py-2 px-4 border-b">{getComponentName(dep.dependent_component_id)}</td>
                  <td className="py-2 px-4 border-b">{dep.processing_sequence}</td>
                  <td className="py-2 px-4 border-b">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${dep.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {dep.is_active ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="py-2 px-4 border-b">
                    <Button variant="ghost" size="sm" className="mr-2" onClick={() => handleEditClick(dep)}>Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dependency Form Modal */}
      <WcmComponentDependencyFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={() => {
          setIsFormModalOpen(false);
          fetchWcmComponentDependencies(); // Refresh the list after successful upsert
        }}
        initialData={editingDependency}
        session={session}
        wcmComponents={wcmComponents}
      />
    </div>
  );
}

