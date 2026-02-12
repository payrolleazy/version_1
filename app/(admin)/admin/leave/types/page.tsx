'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/Modal';
import { DataTable, Pagination, Column } from '@/components/ui/DataTable';
import { ErrorBoundary, LoadingState } from '@/components/ui/ErrorBoundary';
import { BooleanBadge } from '@/components/ui/StatusBadge';
import { LMS_GATEWAY_CONFIGS, API_ENDPOINTS, PAGINATION } from '@/lib/constants';
import { callReadGateway, callPgFunction } from '@/lib/useGateway';

// ============================================================================
// Types
// ============================================================================
interface LeaveType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  requires_approval: boolean;
  allows_half_day: boolean;
  allows_negative_balance: boolean;
  max_negative_days: number | null;
  min_notice_days: number;
  max_consecutive_days: number | null;
  requires_attachment: boolean;
  attachment_threshold_days: number | null;
  is_paid: boolean;
  affects_payroll: boolean;
  color: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface FormData {
  code: string;
  name: string;
  description: string;
  requires_approval: boolean;
  allows_half_day: boolean;
  allows_negative_balance: boolean;
  max_negative_days: number | null;
  min_notice_days: number;
  max_consecutive_days: number | null;
  requires_attachment: boolean;
  attachment_threshold_days: number | null;
  is_paid: boolean;
  affects_payroll: boolean;
  color: string;
  sort_order: number;
  is_active: boolean;
}

const DEFAULT_FORM: FormData = {
  code: '',
  name: '',
  description: '',
  requires_approval: true,
  allows_half_day: true,
  allows_negative_balance: false,
  max_negative_days: null,
  min_notice_days: 1,
  max_consecutive_days: null,
  requires_attachment: false,
  attachment_threshold_days: null,
  is_paid: true,
  affects_payroll: true,
  color: '#6366f1',
  sort_order: 0,
  is_active: true,
};

const COLOR_OPTIONS = [
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#22c55e', label: 'Green' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#64748b', label: 'Gray' },
];

// ============================================================================
// Main Component
// ============================================================================
export default function LeaveTypesManagementPage() {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const router = useRouter();

  // State
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGINATION.DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch leave types
  const fetchLeaveTypes = useCallback(async () => {
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);

    try {
      const result = await callReadGateway<LeaveType[]>(
        LMS_GATEWAY_CONFIGS.READ_LEAVE_TYPES,
        {
          orderBy: [['sort_order', 'ASC'], ['name', 'ASC']],
          limit: pageSize,
          offset: (currentPage - 1) * pageSize,
        },
        session.access_token
      );

      
      
      
if (result.success && result.data) {
  // CORRECTION: Map raw DB columns and nested metadata to UI keys
  const types = (result.data || []).map((t: any) => ({
    ...t,
    code: t.leave_type_code,             // Maps DB 'leave_type_code' to UI 'code'
    name: t.leave_type_name,             // Maps DB 'leave_type_name' to UI 'name'
    sort_order: t.display_order,         // Maps DB 'display_order' to UI 'sort_order'
    // Extract nested boolean flags from the metadata JSONB column [Source 90]
    is_paid: t.metadata?.is_paid ?? true,
    allows_half_day: t.metadata?.allows_half_day ?? true,
    requires_approval: t.metadata?.requires_medical_certificate ?? true, // Updated mapping logic
    min_notice_days: t.metadata?.min_notice_days ?? 0
  }));
  
  setLeaveTypes(types);
  setTotalCount(types.length >= pageSize ? types.length + 1 : types.length);
}
      
      
      
      
      else {
        setError(result.error || 'Failed to load leave types');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, currentPage, pageSize]);

  // Effects
  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push('/admin/auth/login');
    }
  }, [session, sessionLoading, router]);

  useEffect(() => {
    if (session) {
      fetchLeaveTypes();
    }
  }, [session, fetchLeaveTypes]);

  // Modal Handlers
  const handleOpenModal = (type?: LeaveType) => {
    if (type) {
      setEditingType(type);
      setFormData({
        code: type.code,
        name: type.name,
        description: type.description || '',
        requires_approval: type.requires_approval,
        allows_half_day: type.allows_half_day,
        allows_negative_balance: type.allows_negative_balance,
        max_negative_days: type.max_negative_days,
        min_notice_days: type.min_notice_days,
        max_consecutive_days: type.max_consecutive_days,
        requires_attachment: type.requires_attachment,
        attachment_threshold_days: type.attachment_threshold_days,
        is_paid: type.is_paid,
        affects_payroll: type.affects_payroll,
        color: type.color || '#6366f1',
        sort_order: type.sort_order,
        is_active: type.is_active,
      });
    } else {
      setEditingType(null);
      setFormData(DEFAULT_FORM);
    }
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingType(null);
    setFormData(DEFAULT_FORM);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;

    setFormLoading(true);
    setFormError(null);

    try {
      const payload = {
        action: editingType ? 'UPDATE' : 'CREATE',
        leave_type_id: editingType?.id || null,
        ...formData,
        description: formData.description || null,
        max_negative_days: formData.allows_negative_balance ? formData.max_negative_days : null,
        attachment_threshold_days: formData.requires_attachment ? formData.attachment_threshold_days : null,
      };

      const result = await callPgFunction(
        'lms-manage-leave-type',
        payload,
        session.access_token
      );

      if (result.success) {
        handleCloseModal();
        fetchLeaveTypes();
      } else {
        setFormError(result.error || 'Failed to save leave type');
      }
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  // Table columns
  const columns: Column<LeaveType>[] = [
    {
      key: 'name',
      header: 'Leave Type',
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: row.color || '#6366f1' }}
          />
          <div>
            <p className="font-medium text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{row.code}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (value) => (
        <span className="text-sm text-gray-600 truncate max-w-xs block">
          {value || '-'}
        </span>
      ),
    },
    {
      key: 'is_paid',
      header: 'Paid',
      width: '80px',
      align: 'center',
      render: (value) => <BooleanBadge value={value} trueLabel="Yes" falseLabel="No" />,
    },
    {
      key: 'allows_half_day',
      header: 'Half Day',
      width: '90px',
      align: 'center',
      render: (value) => <BooleanBadge value={value} trueLabel="Yes" falseLabel="No" />,
    },
    {
      key: 'requires_approval',
      header: 'Approval',
      width: '90px',
      align: 'center',
      render: (value) => <BooleanBadge value={value} trueLabel="Yes" falseLabel="No" />,
    },
    {
      key: 'min_notice_days',
      header: 'Min Notice',
      width: '100px',
      align: 'center',
      render: (value) => <span className="text-sm">{value} days</span>,
    },
    {
      key: 'is_active',
      header: 'Status',
      width: '90px',
      align: 'center',
      render: (value) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {value ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'id',
      header: 'Actions',
      width: '100px',
      align: 'center',
      render: (_, row) => (
        <Button
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenModal(row);
          }}
        >
          Edit
        </Button>
      ),
    },
  ];

  // Render
  if (sessionLoading || loading) {
    return <LoadingState message="Loading leave types..." />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Leave Types</h1>
              <p className="text-gray-600 mt-1">Configure different types of leaves available to employees</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => router.back()}>
                Back
              </Button>
              <Button onClick={() => handleOpenModal()}>
                + Add Leave Type
              </Button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Leave Types Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <DataTable
              data={leaveTypes}
              columns={columns}
              loading={loading}
              emptyMessage="No leave types configured"
              emptyDescription="Create leave types to define the different categories of leaves employees can apply for"
              rowKey="id"
              striped
              hoverable
            />

            {totalCount > pageSize && (
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(totalCount / pageSize)}
                totalItems={totalCount}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              />
            )}
          </div>

          {/* Legend */}
          <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-3">Quick Legend</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
              <div><strong>Paid:</strong> Salary is paid during leave</div>
              <div><strong>Half Day:</strong> Can apply for half-day leaves</div>
              <div><strong>Approval:</strong> Requires manager approval</div>
              <div><strong>Min Notice:</strong> Days before leave starts</div>
            </div>
          </div>
        </div>

        {/* Add/Edit Modal */}
        {isModalOpen && (
          <Modal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            title={editingType ? 'Edit Leave Type' : 'Create Leave Type'}
          >
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. SICK"
                    required
                    maxLength={20}
                    disabled={!!editingType}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Sick Leave"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description for this leave type"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.color === color.value ? 'border-gray-900 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>

              {/* Settings Grid */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Notice Days</label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.min_notice_days}
                    onChange={(e) => setFormData({ ...formData, min_notice_days: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Consecutive Days</label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.max_consecutive_days || ''}
                    onChange={(e) => setFormData({ ...formData, max_consecutive_days: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="No limit"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                <Input
                  type="number"
                  min={0}
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-gray-500 mt-1">Lower numbers appear first in lists</p>
              </div>

              {/* Toggle Options */}
              <div className="pt-2 border-t">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Leave Settings</h4>
                <div className="space-y-3">
                  {[
                    { key: 'requires_approval', label: 'Requires manager approval' },
                    { key: 'allows_half_day', label: 'Allow half-day leaves' },
                    { key: 'is_paid', label: 'Paid leave (salary continues)' },
                    { key: 'affects_payroll', label: 'Affects payroll calculations' },
                    { key: 'requires_attachment', label: 'Requires supporting documents' },
                    { key: 'allows_negative_balance', label: 'Allow negative balance (advance leave)' },
                    { key: 'is_active', label: 'Active (available for new requests)' },
                  ].map((opt) => (
                    <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData[opt.key as keyof FormData] as boolean}
                        onChange={(e) => setFormData({ ...formData, [opt.key]: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Conditional Fields */}
              {formData.requires_attachment && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Attachment Required After (days)</label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.attachment_threshold_days || ''}
                    onChange={(e) => setFormData({ ...formData, attachment_threshold_days: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="e.g. 3 (for sick leaves over 3 days)"
                  />
                </div>
              )}

              {formData.allows_negative_balance && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Negative Days Allowed</label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.max_negative_days || ''}
                    onChange={(e) => setFormData({ ...formData, max_negative_days: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="e.g. 5"
                  />
                </div>
              )}

              {formError && (
                <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="secondary" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={formLoading}>
                  {editingType ? 'Update Leave Type' : 'Create Leave Type'}
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </ErrorBoundary>
  );
}
