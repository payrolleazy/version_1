'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { EOAP_READ_CONFIGS, EOAP_UPSERT_CONFIGS, HMS_GATEWAY_CONFIGS, API_ENDPOINTS } from '@/lib/constants';
import { callReadGateway, callGateway, callPgFunction } from '@/lib/useGateway';
import { DataTable, Pagination, Column } from '@/components/ui/DataTable';
import Button from '@/components/ui/Button';
import Modal from '@/components/Modal';

// Aligned with public.eoap_position_asset_checklist table + read config allowed_columns
interface PositionAsset {
  id: string;
  position_id: number;
  asset_type: string;
  category: string;
  quantity: number;
  specifications_filter: Record<string, any> | null;
  description: string | null;
  created_at: string;
}

interface PositionOption {
  id: number;
  position_name: string;
}

const ASSET_TYPES = [
  'LAPTOP', 'MONITOR', 'PHONE', 'ACCESS_CARD', 'SOFTWARE_LICENSE',
  'HEADSET', 'KEYBOARD', 'MOUSE', 'OTHER',
];

const CATEGORIES = ['HARDWARE', 'SOFTWARE', 'ACCESS', 'OTHER'];

export default function PositionAssetChecklistTable() {
  const { session } = useSessionContext();
  const [items, setItems] = useState<PositionAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<PositionAsset | null>(null);
  const [form, setForm] = useState({
    position_id: '',
    asset_type: 'LAPTOP',
    category: 'HARDWARE',
    quantity: 1,
    description: '',
    specifications_filter: '',
  });
  const [saving, setSaving] = useState(false);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);

  // Build position lookup map: position_id -> position_name
  const positionMap = useMemo(() => {
    const map: Record<number, string> = {};
    positions.forEach(p => { map[p.id] = p.position_name; });
    return map;
  }, [positions]);

  // Fetch approved positions from HMS gateway for the dropdown
  const fetchPositions = useCallback(async () => {
    if (!session?.access_token) return;
    setPositionsLoading(true);
    try {
      const result = await callPgFunction(
        HMS_GATEWAY_CONFIGS.POSITION_READ_APPROVED,
        {},
        session.access_token
      );
      if (result.success && result.data) {
        const data = result.data as any;
        const dataArray = Array.isArray(data) ? data : data.data || [];
        setPositions(dataArray);
      }
    } catch {
      // Silently fail - positions dropdown will be empty
    } finally {
      setPositionsLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => { fetchPositions(); }, [fetchPositions]);

  const fetchItems = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await callReadGateway(
        EOAP_READ_CONFIGS.POSITION_ASSET_CHECKLIST,
        { limit: pageSize, offset: (currentPage - 1) * pageSize, orderBy: [['created_at', 'DESC']] },
        session.access_token
      );
      if (result.success && result.data) {
        const responseData = result.data as any;
        const dataArray = Array.isArray(responseData) ? responseData : responseData.data || [];
        setItems(dataArray);
        setTotalItems(responseData.total_records || dataArray.length || 0);
      } else {
        setError(result.error || 'Failed to fetch checklist');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, currentPage, pageSize]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleEdit = (item: PositionAsset) => {
    setEditItem(item);
    setForm({
      position_id: String(item.position_id),
      asset_type: item.asset_type,
      category: item.category || 'HARDWARE',
      quantity: item.quantity,
      description: item.description || '',
      specifications_filter: item.specifications_filter ? JSON.stringify(item.specifications_filter) : '',
    });
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditItem(null);
    setForm({ position_id: '', asset_type: 'LAPTOP', category: 'HARDWARE', quantity: 1, description: '', specifications_filter: '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!session?.access_token || !form.position_id) return;
    setSaving(true);
    try {
      const row: Record<string, any> = {
        position_id: parseInt(form.position_id, 10),
        asset_type: form.asset_type,
        category: form.category,
        quantity: form.quantity,
      };
      if (form.description.trim()) row.description = form.description.trim();
      if (form.specifications_filter.trim()) {
        try {
          row.specifications_filter = JSON.parse(form.specifications_filter);
        } catch {
          setError('Invalid JSON in specifications filter');
          setSaving(false);
          return;
        }
      }
      if (editItem?.id) row.id = editItem.id;

      const result = await callGateway(
        API_ENDPOINTS.BULK_UPSERT,
        { config_id: EOAP_UPSERT_CONFIGS.POSITION_ASSET_CHECKLIST, input_rows: [row] },
        session.access_token
      );
      if (result.success) { setModalOpen(false); fetchItems(); }
      else setError(result.error || 'Failed to save');
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const columns: Column<PositionAsset>[] = [
    {
      key: 'position_id',
      header: 'Position',
      sortable: true,
      render: (val: number) => (
        <span className="font-medium text-gray-900">{positionMap[val] || `Position #${val}`}</span>
      ),
    },
    {
      key: 'asset_type',
      header: 'Asset Type',
      sortable: true,
      render: (val: string) => val.replace(/_/g, ' '),
    },
    {
      key: 'category',
      header: 'Category',
      render: (val: string) => (
        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
          val === 'HARDWARE' ? 'bg-blue-100 text-blue-800' :
          val === 'SOFTWARE' ? 'bg-purple-100 text-purple-800' :
          val === 'ACCESS' ? 'bg-amber-100 text-amber-800' :
          'bg-gray-100 text-gray-800'
        }`}>{val}</span>
      ),
    },
    { key: 'quantity', header: 'Qty', align: 'center' },
    { key: 'description', header: 'Description', render: (val: string | null) => val || '-' },
    {
      key: 'actions',
      header: '',
      render: (_: any, row: PositionAsset) => (
        <button onClick={(e) => { e.stopPropagation(); handleEdit(row); }} className="text-sm text-purple-600 hover:text-purple-800 font-medium">Edit</button>
      ),
    },
  ];

  if (!session) return <div className="min-h-screen flex items-center justify-center"><p>Loading session...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800">Position Asset Checklist</h2>
        <div className="flex space-x-2">
          <Button onClick={fetchItems} disabled={loading}>Refresh</Button>
          <Button onClick={handleAdd}>Add Mapping</Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs font-bold uppercase hover:underline">Dismiss</button>
        </div>
      )}

      <DataTable data={items} columns={columns} loading={loading} rowKey="id" emptyMessage="No position-asset mappings" emptyDescription="Add asset requirements for positions using the button above." />

      <Pagination currentPage={currentPage} totalPages={Math.ceil(totalItems / pageSize)} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Mapping' : 'Add Mapping'} maxWidth="max-w-md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Position *</label>
            <select
              value={form.position_id}
              onChange={(e) => setForm(p => ({ ...p, position_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={positionsLoading}
            >
              <option value="">{positionsLoading ? 'Loading positions...' : 'Select a position'}</option>
              {positions.map(pos => <option key={pos.id} value={pos.id}>{pos.position_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset Type</label>
              <select value={form.asset_type} onChange={(e) => setForm(p => ({ ...p, asset_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                {ASSET_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input type="number" min={1} value={form.quantity} onChange={(e) => setForm(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Specifications Filter (JSON, optional)</label>
            <textarea value={form.specifications_filter} onChange={(e) => setForm(p => ({ ...p, specifications_filter: e.target.value }))} rows={2}
              placeholder='e.g. {"brand": "Dell", "ram": "16GB"}'
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.position_id} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
