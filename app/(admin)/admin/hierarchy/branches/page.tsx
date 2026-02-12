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
import { PAGINATION, HMS_GATEWAY_CONFIGS, API_ENDPOINTS } from '@/lib/constants';
import BulkUpload from '@/components/BulkUpload';
import ExportUserRolesModal from '@/components/ExportUserRolesModal';

// --- Types ---
interface Branch {
  id: number;
  branch_name: string;
  location_id: number | null;
  approval_status: 'approved' | 'pending' | 'rejected';
  created_at: string;
  custom_fields?: Record<string, any>;
  [key: string]: any;
}

interface LocationOption {
  id: number;
  location_name: string;
}

interface SchemaField {
  field_name: string;
  ui_label: string;
  data_type: 'string' | 'number' | 'boolean' | 'date';
  is_required: boolean;
}

// --- Main Page Component ---
export default function BranchMasterPage() {
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const router = useRouter();

  // Data State
  const [activeTab, setActiveTab] = useState<'approved' | 'pending'>('approved');
  const [data, setData] = useState<Branch[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [schema, setSchema] = useState<SchemaField[]>([]);

  // UI State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [templateDownloading, setTemplateDownloading] = useState(false);
  
  // -- NEW: Metadata Modal State --
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false);
  const [metadataItem, setMetadataItem] = useState<Branch | null>(null);

  // Action State
  const [editingItem, setEditingItem] = useState<Branch | null>(null);
  const [selectedForAction, setSelectedForAction] = useState<Branch[]>([]);
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
        ? HMS_GATEWAY_CONFIGS.BRANCH_READ_APPROVED
        : HMS_GATEWAY_CONFIGS.BRANCH_READ_PENDING;

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
        throw new Error(result.error || 'Failed to fetch branches');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, activeTab, currentPage, pageSize]);

  const fetchLocations = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const result = await callPgFunction(
        HMS_GATEWAY_CONFIGS.LOCATION_READ_APPROVED,
        { page_size: 1000 },
        session.access_token
      );

      if (result.success) {
        const details = result.data?.details || result.data || {};
        setLocations(details?.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch locations:', err);
    }
  }, [session]);

  const fetchSchema = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const result = await callPgFunction(HMS_GATEWAY_CONFIGS.BRANCH_READ_SCHEMA, {}, session.access_token);
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
  }, [session, isSessionLoading, router]);

  // Fetch data whenever activeTab or pagination changes
  useEffect(() => {
    if (session?.access_token) fetchData();
  }, [fetchData, session?.access_token]);

  // Fetch schema and locations only once when session is ready
  useEffect(() => {
    if (session?.access_token) {
      fetchSchema();
      fetchLocations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  // --- Handlers ---

  const handleOpenFormModal = (item?: Branch) => {
    setEditingItem(item || null);
    setIsFormModalOpen(true);
  };

  const handleOpenConfirmModal = (action: 'approve' | 'reject', items: Branch[]) => {
    setActionType(action);
    setSelectedForAction(items);
    setIsConfirmModalOpen(true);
  };

  // -- NEW: Metadata Handler --
  const handleViewMetadata = (item: Branch) => {
    setMetadataItem(item);
    setIsMetadataModalOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!session?.access_token || !actionType || selectedForAction.length === 0) return;
    setActionLoading(true);
    setError(null);
    try {
      const configId = actionType === 'approve' ? HMS_GATEWAY_CONFIGS.BRANCH_APPROVE : HMS_GATEWAY_CONFIGS.BRANCH_REJECT;
      const result = await callPgFunction(configId, { input_rows: selectedForAction.map(d => ({ id: d.id })) }, session.access_token);
      if (!result.success) throw new Error(result.error || `Failed to ${actionType} branches.`);
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

  const handleDownloadTemplate = async () => {
    if (!session?.access_token) return;
    setTemplateDownloading(true);
    setError(null);
    try {
      const res = await fetch(API_ENDPOINTS.EXCEL_TEMPLATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: HMS_GATEWAY_CONFIGS.BRANCH_TEMPLATE_DOWNLOAD,
          params: {},
          accessToken: session.access_token,
        }),
      });
      const result = await res.json();
      if (result.downloadUrl) {
        window.open(result.downloadUrl, '_blank');
      } else {
        throw new Error(result.message || result.error || 'Template generation failed.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTemplateDownloading(false);
    }
  };

  const getLocationName = (id: number | null) => {
    if (!id) return '-';
    const loc = locations.find(l => l.id === id);
    return loc ? loc.location_name : `ID: ${id}`;
  };

  const columns: Column<Branch>[] = [
    { key: 'branch_name', header: 'Branch Name', sortable: true },
    { key: 'location_id', header: 'Location', render: (v) => getLocationName(v) },
    // -- MODIFIED: Replaced spread dynamicColumns with a single Metadata action column --
    {
        key: 'custom_fields',
        header: 'Branch Info',
        align: 'center',
        render: (_, row) => {
            const hasData = row.custom_fields && Object.keys(row.custom_fields).length > 0;
            if (!hasData) return <span className="text-gray-400 text-xs">-</span>;
            return (
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewMetadata(row); }}>
                    View
                </Button>
            );
        }
    },
    {
      key: 'approval_status', header: 'Status',
      render: (v) => (
        <span className={`capitalize px-2 py-0.5 rounded-full text-xs font-medium ${v === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
          {v}
        </span>
      ),
    },
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
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Branch Master</h1>
              <p className="text-gray-600 mt-1">Manage organizational branches and locations.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="secondary" onClick={handleDownloadTemplate} isLoading={templateDownloading}>
                Download Template
              </Button>
              <Button variant="secondary" onClick={() => setIsBulkUploadModalOpen(true)}>
                Bulk Upload
              </Button>
              <Button variant="secondary" onClick={() => setIsExportModalOpen(true)}>
                Export to Excel
              </Button>
              <Button onClick={() => handleOpenFormModal()}>+ Add Branch</Button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex justify-between items-center">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-sm font-bold">Dismiss</button>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md border border-gray-200">
            <Tabs>
              <Tabs.Tab label="Approved" isActive={activeTab === 'approved'} onClick={() => handleTabChange('approved')} />
              <Tabs.Tab label="Pending Approvals" isActive={activeTab === 'pending'} onClick={() => handleTabChange('pending')} />
            </Tabs>
            <div className="p-4">
              <DataTable data={data} columns={columns} loading={loading} rowKey="id" emptyMessage="No branches found." />
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

      {/* Add/Edit Form Modal */}
      {isFormModalOpen && (
        <BranchFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          onSuccess={fetchData}
          item={editingItem}
          schema={schema}
          locations={locations}
        />
      )}

      {/* Bulk Upload Modal - uses universal-excel-upload architecture */}
      {isBulkUploadModalOpen && (
        <Modal isOpen={isBulkUploadModalOpen} onClose={() => setIsBulkUploadModalOpen(false)} title="Bulk Upload Branches">
          <BulkUpload
            config_id={HMS_GATEWAY_CONFIGS.BRANCH_EXCEL_UPLOAD}
            onUploadSuccess={() => { setIsBulkUploadModalOpen(false); fetchData(); }}
          />
        </Modal>
      )}

      {/* Export Modal - same pattern as employee-roles export */}
      {isExportModalOpen && (
        <ExportUserRolesModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          config_id={HMS_GATEWAY_CONFIGS.BRANCH_EXPORT_EXCEL}
          title="Export Branches to Excel"
        />
      )}

      {/* Approve/Reject Confirmation Modal */}
      {isConfirmModalOpen && (
        <Modal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          title={`${actionType === 'approve' ? 'Approve' : 'Reject'} Branch(es)`}
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to {actionType}{' '}
              <strong>{selectedForAction.length}</strong> selected branch(es)?
            </p>
            <ul className="text-sm text-gray-700 bg-gray-50 rounded p-3 max-h-40 overflow-y-auto space-y-1">
              {selectedForAction.map(b => (
                <li key={b.id}>{b.branch_name}</li>
              ))}
            </ul>
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

      {/* -- NEW: Metadata View Modal -- */}
      {isMetadataModalOpen && metadataItem && (
        <Modal
          isOpen={isMetadataModalOpen}
          onClose={() => setIsMetadataModalOpen(false)}
          title="Branch Branch Info"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-bold text-gray-700 mb-3 border-b pb-2">{metadataItem.branch_name} Details</h3>
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
// Branch Form Modal (Add / Edit)
// ============================================================================
interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: Branch | null;
  schema: SchemaField[];
  locations: LocationOption[];
}

function BranchFormModal({ isOpen, onClose, onSuccess, item, schema, locations }: FormModalProps) {
  const { session } = useSessionContext();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      const merged: Record<string, any> = {
        branch_name: item.branch_name || '',
        location_id: item.location_id || '',
      };
      schema.forEach(field => {
        const val = item.custom_fields?.[field.field_name] ?? item[field.field_name];
        merged[field.field_name] = val ?? '';
      });
      setFormData(merged);
    } else {
      const empty: Record<string, any> = { branch_name: '', location_id: '' };
      schema.forEach(field => {
        empty[field.field_name] = field.data_type === 'boolean' ? false : '';
      });
      setFormData(empty);
    }
  }, [item, schema]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setFormLoading(true);
    setFormError(null);
    try {
      const payload: any = {
        branch_name: formData.branch_name,
        location_id: formData.location_id ? Number(formData.location_id) : null,
      };
      schema.forEach(field => {
        const val = formData[field.field_name];
        if (val !== undefined && val !== '') payload[field.field_name] = val;
      });

      const result = await callPgFunction(
        HMS_GATEWAY_CONFIGS.BRANCH_BULK_INSERT,
        { input_rows: [payload] },
        session.access_token
      );

      if (!result.success) throw new Error(result.error || 'Failed to save branch.');
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
        return (
          <Input
            type="number"
            value={value}
            onChange={e => handleChange(field.field_name, e.target.value ? Number(e.target.value) : '')}
            required={field.is_required}
          />
        );
      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={e => handleChange(field.field_name, e.target.value)}
            required={field.is_required}
          />
        );
      case 'boolean':
        return (
          <div className="flex items-center h-10">
            <input
              type="checkbox"
              checked={!!value}
              onChange={e => handleChange(field.field_name, e.target.checked)}
              className="h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
          </div>
        );
      default:
        return (
          <Input
            type="text"
            value={value}
            onChange={e => handleChange(field.field_name, e.target.value)}
            required={field.is_required}
          />
        );
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item ? 'Edit Branch' : 'Add New Branch'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{formError}</div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name *</label>
            <Input
              value={formData.branch_name || ''}
              onChange={e => handleChange('branch_name', e.target.value)}
              required
              placeholder="e.g. North Campus"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <select
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
              value={formData.location_id || ''}
              onChange={e => handleChange('location_id', e.target.value)}
            >
              <option value="">Select Location</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.location_name}</option>
              ))}
            </select>
          </div>
        </div>
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
        <div className="flex justify-end gap-3 pt-4 border-t mt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={formLoading}>Cancel</Button>
          <Button type="submit" isLoading={formLoading}>
            {item ? 'Update Branch' : 'Create Branch'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}