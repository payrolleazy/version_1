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

interface Location {
  id: number;
  location_name: string;
  approval_status: 'approved' | 'pending' | 'rejected';
  created_at: string;
  creator_emp_code?: string;
  [key: string]: any;
}

interface SchemaField {
  field_name: string;
  ui_label: string;
  data_type: 'string' | 'number' | 'boolean' | 'date';
  is_required: boolean;
}

export default function LocationMasterPage() {
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'approved' | 'pending'>('approved');
  const [data, setData] = useState<Location[]>([]);
  const [schema, setSchema] = useState<SchemaField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Location | null>(null);
  const [selectedForAction, setSelectedForAction] = useState<Location[]>([]);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGINATION.DEFAULT_PAGE_SIZE);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const configId = activeTab === 'approved' ? HMS_GATEWAY_CONFIGS.LOCATION_READ_APPROVED : HMS_GATEWAY_CONFIGS.LOCATION_READ_PENDING;
      const result = await callPgFunction(configId, { page_number: currentPage, page_size: pageSize }, session.access_token);
      if (result.success) {
        const details = result.data?.details || result.data;
        setData(details?.data || []);
        setTotalRecords(details?.total_records || 0);
      } else {
        throw new Error(result.error || 'Failed to fetch locations');
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
      const result = await callPgFunction(HMS_GATEWAY_CONFIGS.LOCATION_READ_SCHEMA, {}, session.access_token);
      if (result.success) setSchema(result.data?.data || []);
    } catch (err) { console.error('Failed to fetch schema:', err); }
  }, [session]);

  useEffect(() => {
    if (!isSessionLoading && !session) router.push('/admin/auth/login');
    if (session) { fetchData(); fetchSchema(); }
  }, [session, isSessionLoading, router, fetchData, fetchSchema]);

  const handleOpenFormModal = (item?: Location) => { setEditingItem(item || null); setIsFormModalOpen(true); };
  const handleOpenConfirmModal = (action: 'approve' | 'reject', items: Location[]) => { setActionType(action); setSelectedForAction(items); setIsConfirmModalOpen(true); };

  const handleConfirmAction = async () => {
    if (!session?.access_token || !actionType || selectedForAction.length === 0) return;
    setActionLoading(true);
    try {
      const configId = actionType === 'approve' ? HMS_GATEWAY_CONFIGS.LOCATION_APPROVE : HMS_GATEWAY_CONFIGS.LOCATION_REJECT;
      const result = await callPgFunction(configId, { input_rows: selectedForAction.map(d => ({ id: d.id })) }, session.access_token);
      if (!result.success) throw new Error(result.error || `Failed to ${actionType} locations.`);
      setIsConfirmModalOpen(false);
      await fetchData();
    } catch (err: any) { setError(err.message); } finally { setActionLoading(false); }
  };

  const handleTabChange = (tab: 'approved' | 'pending') => { setActiveTab(tab); setCurrentPage(1); setData([]); setTotalRecords(0); };
  const handleExport = async () => { if (!session?.access_token) return; try { await callPgFunction(HMS_GATEWAY_CONFIGS.LOCATION_EXPORT_EXCEL, {}, session.access_token); } catch (err: any) { setError(err.message); } };
  const handleDownloadTemplate = async () => { if (!session?.access_token) return; try { await callPgFunction(HMS_GATEWAY_CONFIGS.LOCATION_TEMPLATE_DOWNLOAD, {}, session.access_token); } catch (err: any) { setError(err.message); } };

  const columns: Column<Location>[] = [
    { key: 'location_name', header: 'Location Name', sortable: true },
    ...schema.map((field): Column<Location> => ({ key: field.field_name, header: field.ui_label, render: (val) => val === true ? 'Yes' : val === false ? 'No' : val || '-' })),
    { key: 'creator_emp_code', header: 'Created By' },
    {
      key: 'actions', header: 'Actions', align: 'right',
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
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Location Master</h1>
              <p className="text-gray-600 mt-1">Manage organizational locations.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleDownloadTemplate}>Download Template</Button>
              <Button variant="secondary" onClick={() => setIsBulkUploadOpen(true)}>Bulk Upload</Button>
              <Button variant="secondary" onClick={handleExport}>Export to Excel</Button>
              <Button onClick={() => handleOpenFormModal()}>+ Add Location</Button>
            </div>
          </div>
          {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>}
          <div className="bg-white rounded-lg shadow-md border border-gray-200">
            <Tabs>
              <Tabs.Tab label="Approved" isActive={activeTab === 'approved'} onClick={() => handleTabChange('approved')} />
              <Tabs.Tab label="Pending Approvals" isActive={activeTab === 'pending'} onClick={() => handleTabChange('pending')} />
            </Tabs>
            <div className="p-4">
              <DataTable data={data} columns={columns} loading={loading} rowKey="id" emptyMessage="No locations found." />
              <Pagination currentPage={currentPage} totalPages={Math.ceil(totalRecords / pageSize)} totalItems={totalRecords} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />
            </div>
          </div>
        </div>
      </div>

      {isFormModalOpen && <LocationFormModal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} onSuccess={fetchData} item={editingItem} schema={schema} />}
      {isBulkUploadOpen && <Modal isOpen={isBulkUploadOpen} onClose={() => setIsBulkUploadOpen(false)} title="Bulk Upload Locations"><BulkUpload config_id={HMS_GATEWAY_CONFIGS.LOCATION_BULK_INSERT} onUploadSuccess={() => { setIsBulkUploadOpen(false); fetchData(); }} /></Modal>}
      {isConfirmModalOpen && (
        <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title={`${actionType === 'approve' ? 'Approve' : 'Reject'} Location(s)`}>
          <div className="space-y-4">
            <p className="text-gray-600">Are you sure you want to {actionType} <strong>{selectedForAction.length}</strong> selected location(s)?</p>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setIsConfirmModalOpen(false)}>Cancel</Button>
              <Button variant={actionType === 'approve' ? 'primary' : 'destructive'} onClick={handleConfirmAction} isLoading={actionLoading}>Confirm {actionType}</Button>
            </div>
          </div>
        </Modal>
      )}
    </ErrorBoundary>
  );
}

interface FormModalProps { isOpen: boolean; onClose: () => void; onSuccess: () => void; item: Location | null; schema: SchemaField[]; }

function LocationFormModal({ isOpen, onClose, onSuccess, item, schema }: FormModalProps) {
  const { session } = useSessionContext();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => { setFormData(item ? item : { location_name: '' }); }, [item]);
  const handleChange = (field: string, value: any) => { setFormData(prev => ({ ...prev, [field]: value })); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setFormLoading(true); setFormError(null);
    try {
      const payload: any = { id: item?.id || null, location_name: formData.location_name };
      schema.forEach(field => { payload[field.field_name] = formData[field.field_name]; });
      const result = await callPgFunction(HMS_GATEWAY_CONFIGS.LOCATION_BULK_INSERT, { input_rows: [payload] }, session.access_token);
      if (!result.success) throw new Error(result.error || 'Failed to save location.');
      onSuccess(); onClose();
    } catch (err: any) { setFormError(err.message); } finally { setFormLoading(false); }
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
    <Modal isOpen={isOpen} onClose={onClose} title={item ? 'Edit Location' : 'Add New Location'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{formError}</div>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location Name *</label>
          <Input value={formData.location_name || ''} onChange={e => handleChange('location_name', e.target.value)} required placeholder="e.g. Mumbai Office" />
        </div>
        {schema.length > 0 && (
          <div className="border-t pt-4 mt-2">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Additional Details</h3>
            <div className="space-y-4">{schema.map(field => (<div key={field.field_name}><label className="block text-sm font-medium text-gray-700 mb-1">{field.ui_label} {field.is_required && '*'}</label>{renderField(field)}</div>))}</div>
          </div>
        )}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={formLoading}>{item ? 'Update Location' : 'Create Location'}</Button>
        </div>
      </form>
    </Modal>
  );
}
