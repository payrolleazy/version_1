'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { EOAP_READ_CONFIGS, EOAP_ASSET_STATUS, API_ENDPOINTS } from '@/lib/constants';
import { callReadGateway } from '@/lib/useGateway';
import { DataTable, Pagination, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import Button from '@/components/ui/Button';
import AssetFormModal from './AssetFormModal';

interface Asset {
  id: string;
  asset_tag: string;
  asset_name: string;
  asset_type: string;
  category: string;
  brand: string;
  model: string;
  serial_number: string;
  status: string;
  location: string;
  purchase_date: string;
  is_onboarding_asset: boolean;
  created_at: string;
}

const ASSET_TYPES = ['LAPTOP', 'MONITOR', 'PHONE', 'ACCESS_CARD', 'SOFTWARE_LICENSE', 'HEADSET', 'KEYBOARD', 'MOUSE', 'OTHER'];

export default function AssetInventoryTable() {
  const { session } = useSessionContext();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const fetchAssets = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const filters: Record<string, any> = {};
      if (typeFilter !== 'ALL') filters.asset_type = typeFilter;
      if (statusFilter !== 'ALL') filters.status = statusFilter;

      const result = await callReadGateway(
        EOAP_READ_CONFIGS.ASSETS,
        { filters, limit: pageSize, offset: (currentPage - 1) * pageSize, orderBy: [['created_at', 'DESC']] },
        session.access_token
      );
      if (result.success && result.data) {
        const data = result.data as any;
        setAssets(Array.isArray(data) ? data : data.rows || []);
        setTotalItems(data.total_count || data.length || 0);
      } else {
        setError(result.error || 'Failed to fetch assets');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, currentPage, pageSize, typeFilter, statusFilter]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleEdit = (asset: Asset) => {
    setSelectedAsset(asset);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedAsset(null);
    setModalOpen(true);
  };

  const columns: Column<Asset>[] = [
    { key: 'asset_tag', header: 'Tag', sortable: true },
    { key: 'asset_name', header: 'Asset Name', sortable: true },
    {
      key: 'asset_type',
      header: 'Type',
      sortable: true,
      render: (value: string) => value ? value.replace(/_/g, ' ') : '-',
    },
    { key: 'category', header: 'Category' },
    { key: 'serial_number', header: 'Serial No.' },
    {
      key: 'status',
      header: 'Status',
      render: (value: string) => <StatusBadge status={value} size="sm" />,
    },
    { key: 'location', header: 'Location' },
    {
      key: 'purchase_date',
      header: 'Purchased',
      render: (value: string) => value ? new Date(value).toLocaleDateString() : '-',
    },
    {
      key: 'actions',
      header: '',
      render: (_: any, row: Asset) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
          className="text-sm text-purple-600 hover:text-purple-800 font-medium"
        >
          Edit
        </button>
      ),
    },
  ];

  if (!session) return <div className="min-h-screen flex items-center justify-center"><p>Loading session...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <h2 className="text-lg font-semibold text-gray-800">Asset Inventory</h2>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="ALL">All Types</option>
            {ASSET_TYPES.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="ALL">All Statuses</option>
            {Object.values(EOAP_ASSET_STATUS).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex space-x-2">
          <Button onClick={fetchAssets} disabled={loading}>Refresh</Button>
          <Button onClick={handleAdd}>Add Asset</Button>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">{error}</div>}

      <DataTable data={assets} columns={columns} loading={loading} rowKey="id" emptyMessage="No assets found" />

      <Pagination
        currentPage={currentPage}
        totalPages={Math.ceil(totalItems / pageSize)}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
      />

      <AssetFormModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedAsset(null); }}
        asset={selectedAsset}
        onSaved={fetchAssets}
      />
    </div>
  );
}
