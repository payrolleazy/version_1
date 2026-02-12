'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { EOAP_READ_CONFIGS, EOAP_UPSERT_CONFIGS, API_ENDPOINTS } from '@/lib/constants';
import { callReadGateway, callGateway } from '@/lib/useGateway';
import { DataTable, Pagination, Column } from '@/components/ui/DataTable';
import Button from '@/components/ui/Button';
import Modal from '@/components/Modal';

// Aligned with public.eoap_email_templates table + read config allowed_columns
interface EmailTemplate {
  id: string;
  template_name: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  is_active: boolean;
  sender_email: string | null;
  receiver_mail: string | null;
  created_at: string;
  updated_at: string;
}

export default function EmailTemplateManager() {
  const { session } = useSessionContext();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState({
    template_name: '',
    subject: '',
    body_html: '',
    body_text: '',
    sender_email: '',
    receiver_mail: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await callReadGateway(
        EOAP_READ_CONFIGS.EMAIL_TEMPLATES,
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

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleSave = async () => {
    if (!session?.access_token || !form.template_name.trim() || !form.subject.trim()) return;
    setSaving(true);
    try {
      const row: Record<string, any> = {
        template_name: form.template_name.trim(),
        subject: form.subject.trim(),
        body_html: form.body_html,
        is_active: form.is_active,
      };
      if (form.body_text.trim()) row.body_text = form.body_text.trim();
      if (form.sender_email.trim()) row.sender_email = form.sender_email.trim();
      if (form.receiver_mail.trim()) row.receiver_mail = form.receiver_mail.trim();
      if (editTemplate?.id) row.id = editTemplate.id;
      const result = await callGateway(API_ENDPOINTS.BULK_UPSERT, { config_id: EOAP_UPSERT_CONFIGS.EMAIL_TEMPLATES, input_rows: [row] }, session.access_token);
      if (result.success) { setModalOpen(false); fetchTemplates(); }
      else setError(result.error || 'Failed to save');
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const openEdit = (t: EmailTemplate) => {
    setEditTemplate(t);
    setForm({
      template_name: t.template_name,
      subject: t.subject,
      body_html: t.body_html || '',
      body_text: t.body_text || '',
      sender_email: t.sender_email || '',
      receiver_mail: t.receiver_mail || '',
      is_active: t.is_active,
    });
    setModalOpen(true);
  };

  const columns: Column<EmailTemplate>[] = [
    { key: 'template_name', header: 'Name', sortable: true },
    { key: 'subject', header: 'Subject' },
    { key: 'sender_email', header: 'Sender', render: (v: string | null) => v || '-' },
    { key: 'is_active', header: 'Active', render: (v: boolean) => v ? <span className="text-green-600 font-medium">Active</span> : <span className="text-gray-400">Inactive</span> },
    { key: 'updated_at', header: 'Updated', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
    { key: 'actions', header: '', render: (_: any, row: EmailTemplate) => (
      <button onClick={(e) => { e.stopPropagation(); openEdit(row); }} className="text-sm text-purple-600 hover:text-purple-800 font-medium">Edit</button>
    )},
  ];

  if (!session) return <div className="min-h-screen flex items-center justify-center"><p>Loading session...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800">Email Templates</h2>
        <div className="flex space-x-2">
          <Button onClick={fetchTemplates} disabled={loading}>Refresh</Button>
          <Button onClick={() => { setEditTemplate(null); setForm({ template_name: '', subject: '', body_html: '', body_text: '', sender_email: '', receiver_mail: '', is_active: true }); setModalOpen(true); }}>Add Template</Button>
        </div>
      </div>
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs font-bold uppercase hover:underline">Dismiss</button>
        </div>
      )}
      <DataTable data={templates} columns={columns} loading={loading} rowKey="id" emptyMessage="No email templates" />
      <Pagination currentPage={currentPage} totalPages={Math.ceil(totalItems / pageSize)} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTemplate ? 'Edit Email Template' : 'Add Email Template'} maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
            <input type="text" value={form.template_name} onChange={(e) => setForm(p => ({ ...p, template_name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
            <input type="text" value={form.subject} onChange={(e) => setForm(p => ({ ...p, subject: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sender Email</label>
              <input type="email" value={form.sender_email} onChange={(e) => setForm(p => ({ ...p, sender_email: e.target.value }))}
                placeholder="Optional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Receiver Email</label>
              <input type="email" value={form.receiver_mail} onChange={(e) => setForm(p => ({ ...p, receiver_mail: e.target.value }))}
                placeholder="Optional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Body (HTML)</label>
            <textarea value={form.body_html} onChange={(e) => setForm(p => ({ ...p, body_html: e.target.value }))} rows={8}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Body (Plain Text)</label>
            <textarea value={form.body_text} onChange={(e) => setForm(p => ({ ...p, body_text: e.target.value }))} rows={4}
              placeholder="Optional plain text version"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div className="flex items-center space-x-2">
            <input type="checkbox" id="email_active" checked={form.is_active} onChange={(e) => setForm(p => ({ ...p, is_active: e.target.checked }))}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
            <label htmlFor="email_active" className="text-sm text-gray-700">Active</label>
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
