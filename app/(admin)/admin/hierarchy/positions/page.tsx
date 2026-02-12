'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/Modal';
import Tabs from '@/components/Tabs';
import { DataTable, Pagination, Column } from '@/components/ui/DataTable';
import { LoadingState, ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { callPgFunction } from '@/lib/useGateway';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PAGINATION } from '@/lib/constants';

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================
interface Position {
  id: number;
  position_name: string;
  reporting_position_id: number | null;
  position_status: string;
  approval_status: 'approved' | 'pending' | 'rejected';
  created_at: string;
  // Enriched fields from the read gateway
  creator_emp_code?: string;
  [key: string]: any; // For dynamic custom fields
}

interface SchemaField {
  field_name: string;
  ui_label: string;
  data_type: 'string' | 'number' | 'boolean' | 'date';
  is_required: boolean;
}

// ============================================================================
// 2. EXISTING GATEWAY CONFIGURATION IDs (From your DB)
// ============================================================================
const CONFIG_IDS = {
  // Reads approved positions (IDX 126)
  READ_APPROVED: 'position-read-approved-ui', 
  // Reads pending positions (IDX 127)
  READ_PENDING: 'position-read-pending-ui', 
  // Reads custom field definition (IDX 128)
  READ_SCHEMA: 'position-read-schema', 
  // Approves positions (IDX 123)
  APPROVE: 'position-approve-universal', 
  // Rejects positions (IDX 129)
  REJECT: 'position-reject-universal', 
  // Uses hierarchy specific import to handle Path/Graph logic & Upserts (IDX 63)
  HIERARCHY_UPSERT: 'hierarchy_bulk_import' 
};

// ============================================================================
// 3. MAIN PAGE COMPONENT
// ============================================================================
export default function PositionMasterPage() {
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'approved' | 'pending'>('approved');
  const [data, setData] = useState<Position[]>([]);
  const [schema, setSchema] = useState<SchemaField[]>([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [selectedForAction, setSelectedForAction] = useState<Position[]>([]);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGINATION.DEFAULT_PAGE_SIZE);
  const [totalRecords, setTotalRecords] = useState(0);

  // ========================== DATA FETCHING ==========================
  const fetchData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const configId = activeTab === 'approved' ? CONFIG_IDS.READ_APPROVED : CONFIG_IDS.READ_PENDING;
      
      // Using universal gateway v3 signature (calls position_attributes_read_universal_gateway)
      const result = await callPgFunction(
        configId, 
        { page_number: currentPage, page_size: pageSize }, 
        session.access_token
      );

      if (result.success) {
        // Universal Gateway v3 returns structure: { details: { data: [], total_records: X } }
        const details = result.data?.details || result.data;
        setData(details?.data || []);
        setTotalRecords(details?.total_records || 0);
      } else {
        throw new Error(result.error || 'Failed to fetch positions');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, activeTab, currentPage, pageSize]);

  const fetchSchema = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const result = await callPgFunction(CONFIG_IDS.READ_SCHEMA, {}, session.access_token);
      if (result.success) {
        // Schema gateway usually returns { data: [...] }
        setSchema(result.data?.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch custom fields schema:", err);
    }
  }, [session]);

  useEffect(() => {
    if (!isSessionLoading && !session) {
      router.push('/admin/auth/login');
    }
    if (session) {
      fetchData();
      fetchSchema();
    }
  }, [session, isSessionLoading, router, fetchData, fetchSchema]);

  // ========================== HANDLERS ==========================
  const handleOpenFormModal = (position?: Position) => {
    setEditingPosition(position || null);
    setIsFormModalOpen(true);
  };

  const handleOpenConfirmModal = (action: 'approve' | 'reject', positions: Position[]) => {
    setActionType(action);
    setSelectedForAction(positions);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!session?.access_token || !actionType || selectedForAction.length === 0) return;

    setActionLoading(true);
    try {
      const configId = actionType === 'approve' ? CONFIG_IDS.APPROVE : CONFIG_IDS.REJECT;
      
      // Status update gateway expects { input_rows: [{ id: ... }] }
      const result = await callPgFunction(
        configId,
        { input_rows: selectedForAction.map(p => ({ id: p.id })) },
        session.access_token
      );

      if (!result.success) {
        throw new Error(result.error || `Failed to ${actionType} positions.`);
      }
      
      setIsConfirmModalOpen(false);
      await fetchData(); // Refresh data
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTabChange = (tab: 'approved' | 'pending') => {
    setActiveTab(tab);
    setCurrentPage(1);
    setData([]);
    setTotalRecords(0);
  };

  // ========================== COLUMNS ==========================
  const columns: Column<Position>[] = [
    { key: 'position_name', header: 'Position Name', sortable: true },
    { key: 'reporting_position_id', header: 'Reports To (ID)', width: '150px' },
    { key: 'position_status', header: 'Status', render: (v) => <StatusBadge status={v || 'Inactive'} size="sm" /> },
    
    // Dynamic Columns from Schema
    ...schema.map((field): Column<Position> => ({
      key: field.field_name,
      header: field.ui_label,
      render: (val) => val === true ? 'Yes' : val === false ? 'No' : val || '-'
    })),
    
    // Creator Info (Enriched via backend)
    { key: 'creator_emp_code', header: 'Created By' },
    
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleOpenFormModal(row)}>Edit</Button>
          {activeTab === 'pending' && (
            <Button variant="secondary" size="sm" onClick={() => handleOpenConfirmModal('approve', [row])}>
              Approve
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (isSessionLoading) {
    return <LoadingState message="Initializing session..." />;
  }

  return (
    <ErrorBoundary>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Position Master</h1>
              <p className="text-gray-600 mt-1">Manage organizational hierarchy and job positions.</p>
            </div>
            <Button onClick={() => handleOpenFormModal()}>+ Add New Position</Button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Tabs & Table */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200">
            <Tabs>
              <Tabs.Tab label="Approved Positions" isActive={activeTab === 'approved'} onClick={() => handleTabChange('approved')} />
              <Tabs.Tab label="Pending Approvals" isActive={activeTab === 'pending'} onClick={() => handleTabChange('pending')} />
            </Tabs>
            <div className="p-4">
              <DataTable
                data={data}
                columns={columns}
                loading={loading}
                rowKey="id"
                emptyMessage="No positions found."
              />
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(totalRecords / pageSize)}
                totalItems={totalRecords}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {isFormModalOpen && (
        <PositionFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          onSuccess={fetchData}
          position={editingPosition}
          schema={schema}
        />
      )}

      {/* Confirmation Modal */}
      {isConfirmModalOpen && (
        <Modal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          title={`${actionType === 'approve' ? 'Approve' : 'Reject'} Position(s)`}
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to {actionType} <strong>{selectedForAction.length}</strong> selected position(s)?
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setIsConfirmModalOpen(false)}>Cancel</Button>
              <Button
                variant={actionType === 'approve' ? 'primary' : 'destructive'}
                onClick={handleConfirmAction}
                isLoading={actionLoading}
              >
                Confirm {actionType}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </ErrorBoundary>
  );
}

// ============================================================================
// 4. SUB-COMPONENT: Position Form Modal
// ============================================================================
interface PositionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  position: Position | null;
  schema: SchemaField[];
}

function PositionFormModal({ isOpen, onClose, onSuccess, position, schema }: PositionFormModalProps) {
  const { session } = useSessionContext();
  const [formData, setFormData] = useState<Partial<Position>>({});
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (position) {
      setFormData(position);
    } else {
      setFormData({
        position_name: '',
        position_status: 'Active',
        reporting_position_id: null,
      });
    }
  }, [position]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;

    setFormLoading(true);
    setFormError(null);

    try {
      // 1. Build Base Payload
      const basePayload: any = {
        id: position?.id || null, // null for create, ID for update
        position_name: formData.position_name,
        position_status: formData.position_status,
        reporting_position_id: formData.reporting_position_id,
        // Add required table columns that might be mandatory in schema
        position_title_internal: formData.position_name // Fallback if schema differs
      };

      // 2. Inject Dynamic Custom Fields
      schema.forEach(field => {
        basePayload[field.field_name] = formData[field.field_name];
      });

      // 3. Use HIERARCHY_UPSERT (api_hierarchy_bulk_import_positions) 
      // This function expects a "positions" array in the jsonb payload
      const payload = {
        positions: [basePayload]
      };
      
      const result = await callPgFunction(CONFIG_IDS.HIERARCHY_UPSERT, payload, session.access_token);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to save position.');
      }
      
      onSuccess();
      onClose();

    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const renderField = (field: SchemaField) => {
    const value = formData[field.field_name] ?? '';
    switch (field.data_type) {
      case 'number':
        return <Input type="number" value={value} onChange={e => handleChange(field.field_name, e.target.valueAsNumber)} required={field.is_required} />;
      case 'date':
        return <Input type="date" value={value} onChange={e => handleChange(field.field_name, e.target.value)} required={field.is_required} />;
      case 'boolean':
        return (
            <div className="flex items-center h-10">
                <input type="checkbox" checked={!!value} onChange={e => handleChange(field.field_name, e.target.checked)} className="h-5 w-5 text-blue-600 rounded" />
            </div>
        );
      default:
        return <Input type="text" value={value} onChange={e => handleChange(field.field_name, e.target.value)} required={field.is_required} />;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={position ? 'Edit Position' : 'Add New Position'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{formError}</div>}

        <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position Name *</label>
              <Input value={formData.position_name || ''} onChange={e => handleChange('position_name', e.target.value)} required placeholder="e.g. Senior Developer" />
            </div>
            <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
               <select 
                 className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                 value={formData.position_status || 'Active'}
                 onChange={e => handleChange('position_status', e.target.value)}
               >
                 <option value="Active">Active</option>
                 <option value="Inactive">Inactive</option>
               </select>
            </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reporting Position ID</label>
          <Input 
            type="number" 
            value={formData.reporting_position_id || ''} 
            onChange={e => handleChange('reporting_position_id', e.target.value ? parseInt(e.target.value) : null)} 
            placeholder="Parent Position ID (e.g. 101)"
          />
          <p className="text-xs text-gray-500 mt-1">Leave empty if this is a root node.</p>
        </div>

        {/* Dynamic Custom Fields Section */}
        {schema.length > 0 && (
            <div className="border-t pt-4 mt-2">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Additional Details</h3>
                <div className="space-y-4">
                    {schema.map(field => (
                    <div key={field.field_name}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.ui_label} {field.is_required && '*'}
                        </label>
                        {renderField(field)}
                    </div>
                    ))}
                </div>
            </div>
        )}
        
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={formLoading}>
            {position ? 'Update Position' : 'Create Position'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}