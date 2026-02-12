'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { EOAP_READ_CONFIGS, EOAP_UPSERT_CONFIGS, API_ENDPOINTS } from '@/lib/constants';
import { callReadGateway, callGateway } from '@/lib/useGateway';
import { DataTable, Pagination, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import Button from '@/components/ui/Button';
import Modal from '@/components/Modal';

// Aligned with public.eoap_workflow_templates table + read config allowed_columns
interface WorkflowTemplate {
  id: string;
  template_name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Aligned with public.eoap_workflow_template_steps table + read config allowed_columns
interface TemplateStep {
  id: string;
  template_id: string;
  step_name: string;
  step_description: string | null;
  step_order: number;
  step_type: string;
  estimated_duration_hours: number | null;
  depends_on_steps: string[] | null;
  metadata: Record<string, any> | null;
  task_key: string | null;
  created_at: string;
}

// eoap_step_type_enum values: MANUAL, AUTOMATED, APPROVAL, NOTIFICATION, INTEGRATION
const STEP_TYPES = ['MANUAL', 'AUTOMATED', 'APPROVAL', 'NOTIFICATION', 'INTEGRATION'];

export default function WorkflowTemplateManager() {
  const { session } = useSessionContext();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [steps, setSteps] = useState<TemplateStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [stepModalOpen, setStepModalOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<WorkflowTemplate | null>(null);
  const [editStep, setEditStep] = useState<TemplateStep | null>(null);
  const [templateForm, setTemplateForm] = useState({ template_name: '', description: '', is_active: true, is_default: false });
  const [stepForm, setStepForm] = useState({ step_name: '', step_order: 1, step_type: 'AUTOMATED', step_description: '', estimated_duration_hours: '', task_key: '' });
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await callReadGateway(
        EOAP_READ_CONFIGS.WORKFLOW_TEMPLATES,
        { limit: pageSize, offset: (currentPage - 1) * pageSize, orderBy: [['template_name', 'ASC']] },
        session.access_token
      );
      if (result.success && result.data) {
        const responseData = result.data as any;
        const dataArray = Array.isArray(responseData) ? responseData : responseData.data || [];
        setTemplates(dataArray);
        setTotalItems(responseData.total_records || dataArray.length || 0);
      } else {
        setError(result.error || 'Failed to fetch templates');
      }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [session?.access_token, currentPage, pageSize]);

  const fetchSteps = useCallback(async (templateId: string) => {
    if (!session?.access_token) return;
    try {
      const result = await callReadGateway(
        EOAP_READ_CONFIGS.WORKFLOW_TEMPLATE_STEPS,
        { filters: { template_id: templateId }, orderBy: [['step_order', 'ASC']] },
        session.access_token
      );
      if (result.success && result.data) {
        const responseData = result.data as any;
        const dataArray = Array.isArray(responseData) ? responseData : responseData.data || [];
        setSteps(dataArray);
      }
    } catch (err: any) { setError(err.message); }
  }, [session?.access_token]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);
  useEffect(() => { if (selectedTemplate) fetchSteps(selectedTemplate.id); }, [selectedTemplate, fetchSteps]);

  const handleSaveTemplate = async () => {
    if (!session?.access_token || !templateForm.template_name.trim()) return;
    setSaving(true);
    try {
      const row: Record<string, any> = {
        template_name: templateForm.template_name.trim(),
        is_active: templateForm.is_active,
        is_default: templateForm.is_default,
      };
      if (templateForm.description.trim()) row.description = templateForm.description.trim();
      if (editTemplate?.id) row.id = editTemplate.id;
      const result = await callGateway(API_ENDPOINTS.BULK_UPSERT, { config_id: EOAP_UPSERT_CONFIGS.WORKFLOW_TEMPLATES, input_rows: [row] }, session.access_token);
      if (result.success) { setTemplateModalOpen(false); fetchTemplates(); }
      else setError(result.error || 'Failed to save');
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleSaveStep = async () => {
    if (!session?.access_token || !selectedTemplate || !stepForm.step_name.trim()) return;
    setSaving(true);
    try {
      const row: Record<string, any> = {
        template_id: selectedTemplate.id,
        step_name: stepForm.step_name.trim(),
        step_order: stepForm.step_order,
        step_type: stepForm.step_type,
      };
      if (stepForm.step_description.trim()) row.step_description = stepForm.step_description.trim();
      if (stepForm.estimated_duration_hours) row.estimated_duration_hours = parseInt(stepForm.estimated_duration_hours, 10);
      if (stepForm.task_key.trim()) row.task_key = stepForm.task_key.trim();
      if (editStep?.id) row.id = editStep.id;
      const result = await callGateway(API_ENDPOINTS.BULK_UPSERT, { config_id: EOAP_UPSERT_CONFIGS.WORKFLOW_TEMPLATE_STEPS, input_rows: [row] }, session.access_token);
      if (result.success) { setStepModalOpen(false); fetchSteps(selectedTemplate.id); }
      else setError(result.error || 'Failed to save step');
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const templateColumns: Column<WorkflowTemplate>[] = [
    { key: 'template_name', header: 'Template', sortable: true },
    { key: 'description', header: 'Description', render: (val: string | null) => val || '-' },
    { key: 'is_default', header: 'Default', render: (v: boolean) => v ? <span className="text-blue-600 font-medium">Default</span> : <span className="text-gray-400">No</span> },
    { key: 'is_active', header: 'Active', render: (v: boolean) => v ? <span className="text-green-600 font-medium">Active</span> : <span className="text-gray-400">Inactive</span> },
    { key: 'updated_at', header: 'Updated', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
    { key: 'actions', header: '', render: (_: any, row: WorkflowTemplate) => (
      <button onClick={(e) => { e.stopPropagation(); setEditTemplate(row); setTemplateForm({ template_name: row.template_name, description: row.description || '', is_active: row.is_active, is_default: row.is_default }); setTemplateModalOpen(true); }}
        className="text-sm text-purple-600 hover:text-purple-800 font-medium">Edit</button>
    )},
  ];

  const stepColumns: Column<TemplateStep>[] = [
    { key: 'step_order', header: '#', width: '60px', align: 'center' },
    { key: 'step_name', header: 'Step Name' },
    { key: 'step_type', header: 'Type', render: (v: string) => <StatusBadge status={v} size="sm" /> },
    { key: 'estimated_duration_hours', header: 'Duration (hrs)', align: 'center', render: (v: number | null) => v ? `${v}h` : '-' },
    { key: 'task_key', header: 'Task Key', render: (v: string | null) => v || '-' },
    { key: 'step_description', header: 'Description', render: (v: string | null) => v || '-' },
    { key: 'actions', header: '', render: (_: any, row: TemplateStep) => (
      <button onClick={(e) => { e.stopPropagation(); setEditStep(row); setStepForm({ step_name: row.step_name, step_order: row.step_order, step_type: row.step_type, step_description: row.step_description || '', estimated_duration_hours: row.estimated_duration_hours ? String(row.estimated_duration_hours) : '', task_key: row.task_key || '' }); setStepModalOpen(true); }}
        className="text-sm text-purple-600 hover:text-purple-800 font-medium">Edit</button>
    )},
  ];

  if (!session) return <div className="min-h-screen flex items-center justify-center"><p>Loading session...</p></div>;

  return (
    <div className="space-y-6">
      {/* Templates List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Workflow Templates</h2>
          <div className="flex space-x-2">
            <Button onClick={fetchTemplates} disabled={loading}>Refresh</Button>
            <Button onClick={() => { setEditTemplate(null); setTemplateForm({ template_name: '', description: '', is_active: true, is_default: false }); setTemplateModalOpen(true); }}>Add Template</Button>
          </div>
        </div>
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-xs font-bold uppercase hover:underline">Dismiss</button>
          </div>
        )}
        <DataTable data={templates} columns={templateColumns} loading={loading} rowKey="id" emptyMessage="No workflow templates" onRowClick={(row) => setSelectedTemplate(row)} selectedRowKey={selectedTemplate?.id} />
        <Pagination currentPage={currentPage} totalPages={Math.ceil(totalItems / pageSize)} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} />
      </div>

      {/* Steps for Selected Template */}
      {selectedTemplate && (
        <div className="space-y-4 border-t pt-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800">Steps for: {selectedTemplate.template_name}</h3>
            <Button onClick={() => { setEditStep(null); setStepForm({ step_name: '', step_order: steps.length + 1, step_type: 'AUTOMATED', step_description: '', estimated_duration_hours: '', task_key: '' }); setStepModalOpen(true); }}>Add Step</Button>
          </div>
          <DataTable data={steps} columns={stepColumns} rowKey="id" emptyMessage="No steps defined" />
        </div>
      )}

      {/* Template Modal */}
      <Modal isOpen={templateModalOpen} onClose={() => setTemplateModalOpen(false)} title={editTemplate ? 'Edit Template' : 'Add Template'} maxWidth="max-w-md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
            <input type="text" value={templateForm.template_name} onChange={(e) => setTemplateForm(p => ({ ...p, template_name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={templateForm.description} onChange={(e) => setTemplateForm(p => ({ ...p, description: e.target.value }))} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <input type="checkbox" id="is_active" checked={templateForm.is_active} onChange={(e) => setTemplateForm(p => ({ ...p, is_active: e.target.checked }))}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
              <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
            </div>
            <div className="flex items-center space-x-2">
              <input type="checkbox" id="is_default" checked={templateForm.is_default} onChange={(e) => setTemplateForm(p => ({ ...p, is_default: e.target.checked }))}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
              <label htmlFor="is_default" className="text-sm text-gray-700">Default Template</label>
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button onClick={() => setTemplateModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button onClick={handleSaveTemplate} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </Modal>

      {/* Step Modal */}
      <Modal isOpen={stepModalOpen} onClose={() => setStepModalOpen(false)} title={editStep ? 'Edit Step' : 'Add Step'} maxWidth="max-w-md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Step Name *</label>
            <input type="text" value={stepForm.step_name} onChange={(e) => setStepForm(p => ({ ...p, step_name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
              <input type="number" min={1} value={stepForm.step_order} onChange={(e) => setStepForm(p => ({ ...p, step_order: parseInt(e.target.value) || 1 }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={stepForm.step_type} onChange={(e) => setStepForm(p => ({ ...p, step_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                {STEP_TYPES.map(t => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours)</label>
              <input type="number" min={0} value={stepForm.estimated_duration_hours} onChange={(e) => setStepForm(p => ({ ...p, estimated_duration_hours: e.target.value }))}
                placeholder="Optional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Key</label>
              <input type="text" value={stepForm.task_key} onChange={(e) => setStepForm(p => ({ ...p, task_key: e.target.value }))}
                placeholder="Optional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={stepForm.step_description} onChange={(e) => setStepForm(p => ({ ...p, step_description: e.target.value }))} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button onClick={() => setStepModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button onClick={handleSaveStep} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
