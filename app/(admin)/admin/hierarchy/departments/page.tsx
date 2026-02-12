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
import { PAGINATION, HMS_GATEWAY_CONFIGS } from '@/lib/constants';
import BulkUpload from '@/components/BulkUpload';
import ExportUserRolesModal from '@/components/ExportUserRolesModal';

// ============================================================================
// Types
// ============================================================================
interface Department {
  id: number;
  department_name: string;
  approval_status: 'approved' | 'pending' | 'rejected';
  created_at: string;
  creator_emp_code?: string;
  custom_fields?: Record<string, any>;
  [key: string]: any;
}

interface SchemaField {
  field_name: string;
  ui_label: string;
  data_type: 'string' | 'number' | 'boolean' | 'date';
  is_required: boolean;
}

// ============================================================================
// Main Page Component
// ============================================================================
export default function DepartmentMasterPage() {
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const router = useRouter();

  // Data State
  const [activeTab, setActiveTab] = useState<'approved' | 'pending'>('approved');
  const [data, setData] = useState<Department[]>([]);
  const [schema, setSchema] = useState<SchemaField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false); // Using ExportUserRolesModal pattern

  // -- NEW: Metadata Modal State --
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false);
  const [metadataItem, setMetadataItem] = useState<Department | null>(null);

  // Action State
  const [editingItem, setEditingItem] = useState<Department | null>(null);
  const [selectedForAction, setSelectedForAction] = useState<Department[]>([]);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGINATION.DEFAULT_PAGE_SIZE);
  const [totalRecords, setTotalRecords] = useState(0);

  // --- Data Fetching ---

  const fetchData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const configId = activeTab === 'approved'
        ? HMS_GATEWAY_CONFIGS.DEPARTMENT_READ_APPROVED
        : HMS_GATEWAY_CONFIGS.DEPARTMENT_READ_PENDING;
      const result = await callPgFunction(
        configId, 
        { page_number: currentPage, page_size: pageSize }, 
        session.access_token
      );
      
      if (result.success) {
        const details = result.data?.details || result.data || {};
        setData(details?.data || []);
        setTotalRecords(details?.total_records || 0);
      } else {
        throw new Error(result.error || 'Failed to fetch departments');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, activeTab, currentPage, pageSize]);

  const fetchSchema = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const result = await callPgFunction(HMS_GATEWAY_CONFIGS.DEPARTMENT_READ_SCHEMA, {}, session.access_token);
      if (result.success) {
        setSchema(result.data?.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch schema:', err);
    }
  }, [session]);

  // Auth Check
  useEffect(() => {
    if (!isSessionLoading && !session) router.push('/admin/auth/login');
    if (session) { fetchData(); fetchSchema(); }
  }, [session, isSessionLoading, router, fetchData, fetchSchema]);

  // --- Handlers ---

  const handleOpenFormModal = (item?: Department) => {
    setEditingItem(item || null);
    setIsFormModalOpen(true);
  };

  const handleOpenConfirmModal = (action: 'approve' | 'reject', items: Department[]) => {
    setActionType(action);
    setSelectedForAction(items);
    setIsConfirmModalOpen(true);
  };

  // -- NEW: Metadata Handler --
  const handleViewMetadata = (item: Department) => {
    setMetadataItem(item);
    setIsMetadataModalOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!session?.access_token || !actionType || selectedForAction.length === 0) return;
    setActionLoading(true);
    try {
      const configId = actionType === 'approve' ? HMS_GATEWAY_CONFIGS.DEPARTMENT_APPROVE : HMS_GATEWAY_CONFIGS.DEPARTMENT_REJECT;
      const result = await callPgFunction(configId, { input_rows: selectedForAction.map(d => ({ id: d.id })) }, session.access_token);
      if (!result.success) throw new Error(result.error || `Failed to ${actionType} departments.`);
      setIsConfirmModalOpen(false);
      await fetchData();
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

  // Note: Export logic handles raw download via Gateway directly, UI handled by ExportUserRolesModal
  const handleDownloadTemplate = async () => {
    if (!session?.access_token) return;
    try {
      const result = await callPgFunction(HMS_GATEWAY_CONFIGS.DEPARTMENT_TEMPLATE_DOWNLOAD, {}, session.access_token);
      if (result.data?.downloadUrl) {
         window.open(result.data.downloadUrl, '_blank');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Columns definition matching Branch Master architecture
  const columns: Column<Department>[] = [
    { key: 'department_name', header: 'Department Name', sortable: true },
    
    // -- MODIFIED: Replaced spread schema columns with a single Metadata action column --
    {
      key: 'custom_fields',
      header: 'Meta Data',
      align: 'center',
      render: (_, row) => {
        // Check if custom_fields exists and has keys
        const hasData = row.custom_fields && Object.keys(row.custom_fields).length > 0;
        if (!hasData) return <span className="text-gray-400 text-xs">-</span>;
        return (
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewMetadata(row); }}>
            View
          </Button>
        );
      }
    },

    { key: 'creator_emp_code', header: 'Created By' },
    {
      key: 'approval_status', header: 'Status',
      render: (v) => (
        <span className={`capitalize px-2 py-0.5 rounded-full text-xs font-medium ${v === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
          {v}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleOpenFormModal(row)}>Edit</Button>
          {activeTab === 'pending' && (
            <>
              <Button variant="secondary" size="sm" onClick={() => handleOpenConfirmModal('approve', [row])}>Approve</Button>
              <Button variant="destructive" size="sm" onClick={() => handleOpenConfirmModal('reject', [row])}>Reject</Button>
            </>
          )}
        </div>
      ),
    },
  ];

  if (isSessionLoading) return <LoadingState message="Initializing session..." />;

  return (
    <ErrorBoundary>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Department Master</h1>
              <p className="text-gray-600 mt-1">Manage organizational departments.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="secondary" onClick={handleDownloadTemplate}>Download Template</Button>
              <Button variant="secondary" onClick={() => setIsBulkUploadOpen(true)}>Bulk Upload</Button>
              <Button variant="secondary" onClick={() => setIsExportModalOpen(true)}>Export to Excel</Button>
              <Button onClick={() => handleOpenFormModal()}>+ Add Department</Button>
            </div>
          </div>

          {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>}

          <div className="bg-white rounded-lg shadow-md border border-gray-200">
            <Tabs>
              <Tabs.Tab label="Approved" isActive={activeTab === 'approved'} onClick={() => handleTabChange('approved')} />
              <Tabs.Tab label="Pending Approvals" isActive={activeTab === 'pending'} onClick={() => handleTabChange('pending')} />
            </Tabs>
            <div className="p-4">
              <DataTable data={data} columns={columns} loading={loading} rowKey="id" emptyMessage="No departments found." />
              <Pagination currentPage={currentPage} totalPages={Math.ceil(totalRecords / pageSize)} totalItems={totalRecords} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {isFormModalOpen && (
        <DepartmentFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          onSuccess={fetchData}
          item={editingItem}
          schema={schema}
        />
      )}

      {/* Bulk Upload Modal - Updated to use 'departments-universal-excel-upload' */}
      {isBulkUploadOpen && (
        <Modal isOpen={isBulkUploadOpen} onClose={() => setIsBulkUploadOpen(false)} title="Bulk Upload Departments">
          <BulkUpload 
            config_id="departments-universal-excel-upload" // Updated config ID for universal upload
            onUploadSuccess={() => { setIsBulkUploadOpen(false); fetchData(); }} 
          />
        </Modal>
      )}

      {/* Export Modal */}
      {isExportModalOpen && (
        <ExportUserRolesModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          config_id={HMS_GATEWAY_CONFIGS.DEPARTMENT_EXPORT_EXCEL}
          title="Export Departments to Excel"
        />
      )}

      {/* Confirm Action Modal */}
      {isConfirmModalOpen && (
        <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title={`${actionType === 'approve' ? 'Approve' : 'Reject'} Department(s)`}>
          <div className="space-y-4">
            <p className="text-gray-600">Are you sure you want to {actionType} <strong>{selectedForAction.length}</strong> selected department(s)?</p>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setIsConfirmModalOpen(false)}>Cancel</Button>
              <Button variant={actionType === 'approve' ? 'primary' : 'destructive'} onClick={handleConfirmAction} isLoading={actionLoading}>
                Confirm {actionType}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* -- NEW: Metadata View Modal -- */}
      {isMetadataModalOpen && metadataItem && (
        <Modal
          isOpen={isMetadataModalOpen}
          onClose={() => setIsMetadataModalOpen(false)}
          title="Department Meta Data"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-bold text-gray-700 mb-3 border-b pb-2">{metadataItem.department_name} Details</h3>
              {metadataItem.custom_fields && Object.keys(metadataItem.custom_fields).length > 0 ? (
                <dl className="space-y-2 text-sm">
                  {Object.entries(metadataItem.custom_fields).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center border-b border-gray-100 last:border-0 pb-1">
                      <dt className="text-gray-500 font-medium capitalize">{key.replace(/_/g, ' ')}</dt>
                      <dd className="text-gray-900 font-semibold">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-gray-500 italic text-sm text-center py-2">No additional data available.</p>
              )}
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setIsMetadataModalOpen(false)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}

    </ErrorBoundary>
  );
}

// ============================================================================
// Form Modal Sub-Component
// ============================================================================
interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: Department | null;
  schema: SchemaField[];
}

function DepartmentFormModal({ isOpen, onClose, onSuccess, item, schema }: FormModalProps) {
  const { session } = useSessionContext();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      // Flatten custom_fields into formData for editing
      const flatData = { ...item, ...(item.custom_fields || {}) };
      setFormData(flatData);
    } else {
      setFormData({ department_name: '' });
    }
  }, [item]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setFormLoading(true);
    setFormError(null);
    try {
      const payload: any = { id: item?.id || null, department_name: formData.department_name };
      // Map dynamic schema fields
      schema.forEach(field => { 
        if (formData[field.field_name] !== undefined) {
            payload[field.field_name] = formData[field.field_name]; 
        }
      });
      
      const result = await callPgFunction(HMS_GATEWAY_CONFIGS.DEPARTMENT_BULK_INSERT, { input_rows: [payload] }, session.access_token);
      if (!result.success) throw new Error(result.error || 'Failed to save department.');
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
      case 'number': return <Input type="number" value={value} onChange={e => handleChange(field.field_name, e.target.valueAsNumber)} required={field.is_required} />;
      case 'date': return <Input type="date" value={value} onChange={e => handleChange(field.field_name, e.target.value)} required={field.is_required} />;
      case 'boolean': return <div className="flex items-center h-10"><input type="checkbox" checked={!!value} onChange={e => handleChange(field.field_name, e.target.checked)} className="h-5 w-5 text-blue-600 rounded" /></div>;
      default: return <Input type="text" value={value} onChange={e => handleChange(field.field_name, e.target.value)} required={field.is_required} />;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item ? 'Edit Department' : 'Add New Department'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{formError}</div>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Department Name *</label>
          <Input value={formData.department_name || ''} onChange={e => handleChange('department_name', e.target.value)} required placeholder="e.g. Engineering" />
        </div>
        {schema.length > 0 && (
          <div className="border-t pt-4 mt-2">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Additional Details</h3>
            <div className="space-y-4">
              {schema.map(field => (
                <div key={field.field_name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{field.ui_label} {field.is_required && '*'}</label>
                  {renderField(field)}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={formLoading}>{item ? 'Update Department' : 'Create Department'}</Button>
        </div>
      </form>
    </Modal>
  );
}