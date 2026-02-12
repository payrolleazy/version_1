'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import WcmComponentFormModal from '@/components/WcmComponentFormModal';
import ConfigureRulesModal from '@/components/ConfigureRulesModal';
import Tabs from '@/components/Tabs';
import WcmComponentDependenciesTab from '@/components/WcmComponentDependenciesTab';

interface WcmComponent {
  id: string;
  component_code: string;
  name: string;
  component_type: string;
  rules: any;
  is_active: boolean;
  rule_template?: any;
}

const READ_CONFIG_ID = '0872c31a-89cb-4b33-bff6-b5b3e954a705';
const UPSERT_CONFIG_ID = '8c2ce3d3-45cc-4afc-8253-03facd158c64';

export default function WcmComponentsPage() {
  const router = useRouter();
  const { session } = useSessionContext();
  const [wcmComponents, setWcmComponents] = useState<WcmComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [filterText, setFilterText] = useState('');
  const [filterColumn, setFilterColumn] = useState('name');
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('ASC');

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<WcmComponent | null>(null);

  const [isConfigureModalOpen, setIsConfigureModalOpen] = useState(false);
  const [selectedComponentForRules, setSelectedComponentForRules] = useState<WcmComponent | null>(null);
  const [isSavingRules, setIsSavingRules] = useState(false);

  const fetchWcmComponents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!session?.access_token) {
        throw new Error('Authentication required.');
      }

      const params: any = {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      };

      if (filterText && filterColumn) {
        params.filters = {
          [filterColumn]: filterText,
        };
      }

      if (sortColumn && sortDirection) {
        params.orderBy = [[sortColumn, sortDirection]];
      }

      const response = await fetch('/api/a_crud_universal_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: READ_CONFIG_ID,
          params: params,
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch WCM components');
      }

      setWcmComponents(result.data || []);
      setTotalRecords(result.total_records || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, currentPage, pageSize, filterText, filterColumn, sortColumn, sortDirection]);

  useEffect(() => {
    if (session) {
      fetchWcmComponents();
    }
  }, [session, fetchWcmComponents]);

  const handleSaveRules = async (updatedRules: any) => {
    if (!selectedComponentForRules || !session?.access_token) {
      setError('Component and session are required to save rules.');
      return;
    }

    setIsSavingRules(true);
    setError(null);

    try {
      const { id, ...componentWithoutId } = selectedComponentForRules;
      const payload = {
        ...componentWithoutId,
        rules: updatedRules,
      };

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

      if (!response.ok || !result || result.length === 0 || !result[0].success) {
        throw new Error(result[0]?.message || 'Failed to save WCM component rules');
      }

      setIsConfigureModalOpen(false);
      setSelectedComponentForRules(null);
      fetchWcmComponents();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSavingRules(false);
    }
  };


  const handlePageChange = (newPage: number) => {
    if (newPage < 1) return;
    setCurrentPage(newPage);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const handleFilterTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterText(e.target.value);
    setCurrentPage(1);
  };

  const handleFilterColumnChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterColumn(e.target.value);
    setCurrentPage(1);
  };

  const handleSortChange = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortColumn(column);
      setSortDirection('ASC');
    }
    setCurrentPage(1);
  };

  const handleEditClick = (component: WcmComponent) => {
    setEditingComponent(component);
    setIsFormModalOpen(true);
  };
  
  const handleConfigureClick = (component: WcmComponent) => {
    setSelectedComponentForRules(component);
    setIsConfigureModalOpen(true);
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading session...</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-white rounded-lg shadow-md">
      <Tabs>
        <Tabs.Tab label="WCM Components">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">WCM Components</h1>
            <Button onClick={() => { setEditingComponent(null); setIsFormModalOpen(true); }}>
              Create WCM Component
            </Button>
          </div>

          {/* Filter Controls */}
          <div className="flex w-full justify-end space-x-4 mb-4">
            <Input
              type="text"
              placeholder={`Filter by ${filterColumn}...`}
              value={filterText}
              onChange={handleFilterTextChange}
              className="w-64"
            />
            <select
              value={filterColumn}
              onChange={handleFilterColumnChange}
              className="px-3 py-2 pr-4 border border-gray-300 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none w-48"
            >
              <option value="name">Name</option>
              <option value="component_code">Component Code</option>
              <option value="component_type">Component Type</option>
              <option value="is_active">Status</option>
            </select>
          </div>

          {loading && <p>Loading...</p>}
          {error && <p className="text-red-500">Error: {error}</p>}

          {!loading && !error && wcmComponents.length === 0 && (
            <p>No WCM components found.</p>
          )}

          {!loading && !error && wcmComponents.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr>
                    <th className="py-2 px-4 border-b cursor-pointer text-left" onClick={() => handleSortChange('component_code')}>Component Code</th>
                    <th className="py-2 px-4 border-b cursor-pointer text-left" onClick={() => handleSortChange('name')}>Name</th>
                    <th className="py-2 px-4 border-b cursor-pointer text-left" onClick={() => handleSortChange('component_type')}>Component Type</th>
                    <th className="py-2 px-4 border-b cursor-pointer text-left" onClick={() => handleSortChange('is_active')}>Status</th>
                    <th className="py-2 px-4 border-b text-left">Rule Template</th>
                    <th className="py-2 px-4 border-b text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {wcmComponents.map((component) => (
                    <tr key={component.id}>
                      <td className="py-2 px-4 border-b">{component.component_code}</td>
                      <td className="py-2 px-4 border-b">{component.name}</td>
                      <td className="py-2 px-4 border-b">{component.component_type}</td>
                      <td className="py-2 px-4 border-b">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${component.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {component.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-2 px-4 border-b">
                        {component.rules && Object.keys(component.rules).length > 0 ? (
                          <Button onClick={() => handleConfigureClick(component)} variant="ghost" size="sm">
                            Configure
                          </Button>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="py-2 px-4 border-b">
                        <Button onClick={() => handleEditClick(component)} variant="ghost" size="sm">
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="flex justify-between items-center mt-4">
            <Button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              isLoading={loading}
            >
              Previous
            </Button>
            <span>
              Page {currentPage} of {Math.ceil(totalRecords / pageSize)}
            </span>
            <Button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage * pageSize >= totalRecords}
              isLoading={loading}
            >
              Next
            </Button>
          </div>
        </Tabs.Tab>
        <Tabs.Tab label="Component Dependencies">
          <WcmComponentDependenciesTab />
        </Tabs.Tab>
      </Tabs>

      {/* WCM Component Form Modal */}
      <WcmComponentFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={() => {
          setIsFormModalOpen(false);
          fetchWcmComponents();
        }}
        initialData={editingComponent}
        session={session}
      />

      {/* Configure Rules Modal */}
      {selectedComponentForRules && (
        <ConfigureRulesModal
          isOpen={isConfigureModalOpen}
          onClose={() => {
            setIsConfigureModalOpen(false);
            setSelectedComponentForRules(null);
          }}
          onSave={handleSaveRules}
          component={selectedComponentForRules}
          loading={isSavingRules}
        />
      )}
    </div>
  );
}