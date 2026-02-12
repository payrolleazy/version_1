'use client';

import React, { useState, useEffect } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { EOAP_UPSERT_CONFIGS, EOAP_ASSET_STATUS, API_ENDPOINTS } from '@/lib/constants';
import { callGateway } from '@/lib/useGateway';
import Modal from '@/components/Modal';

interface Asset {
  id?: string;
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
}

interface AssetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  onSaved: () => void;
}

const ASSET_TYPES = ['LAPTOP', 'MONITOR', 'PHONE', 'ACCESS_CARD', 'SOFTWARE_LICENSE', 'HEADSET', 'KEYBOARD', 'MOUSE', 'OTHER'];
const ASSET_CATEGORIES = ['HARDWARE', 'SOFTWARE', 'ACCESS', 'OTHER'];
const ASSET_STATUSES = Object.values(EOAP_ASSET_STATUS);

export default function AssetFormModal({ isOpen, onClose, asset, onSaved }: AssetFormModalProps) {
  const { session } = useSessionContext();
  const [form, setForm] = useState<Asset>({
    asset_tag: '', asset_name: '', asset_type: 'LAPTOP', category: 'HARDWARE',
    brand: '', model: '', serial_number: '', status: EOAP_ASSET_STATUS.AVAILABLE,
    location: '', purchase_date: '', is_onboarding_asset: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (asset) {
      setForm({
        asset_tag: asset.asset_tag || '',
        asset_name: asset.asset_name || '',
        asset_type: asset.asset_type || 'LAPTOP',
        category: asset.category || 'HARDWARE',
        brand: asset.brand || '',
        model: asset.model || '',
        serial_number: asset.serial_number || '',
        status: asset.status || EOAP_ASSET_STATUS.AVAILABLE,
        location: asset.location || '',
        purchase_date: asset.purchase_date ? asset.purchase_date.split('T')[0] : '',
        is_onboarding_asset: asset.is_onboarding_asset ?? false,
      });
    } else {
      setForm({
        asset_tag: '', asset_name: '', asset_type: 'LAPTOP', category: 'HARDWARE',
        brand: '', model: '', serial_number: '', status: EOAP_ASSET_STATUS.AVAILABLE,
        location: '', purchase_date: '', is_onboarding_asset: false,
      });
    }
  }, [asset, isOpen]);

  const handleSave = async () => {
    if (!session?.access_token) return;
    if (!form.asset_tag.trim()) { setError('Asset tag is required'); return; }
    if (!form.asset_name.trim()) { setError('Asset name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const row: any = { ...form };
      if (asset?.id) row.id = asset.id;

      const result = await callGateway(
        API_ENDPOINTS.BULK_UPSERT,
        { config_id: EOAP_UPSERT_CONFIGS.ASSETS, input_rows: [row] },
        session.access_token
      );
      if (result.success) {
        onSaved();
        onClose();
      } else {
        setError(result.error || 'Failed to save asset');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Asset, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={asset ? 'Edit Asset' : 'Add Asset'} maxWidth="max-w-lg">
      <div className="space-y-4">
        {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asset Tag *</label>
            <input type="text" value={form.asset_tag} onChange={(e) => handleChange('asset_tag', e.target.value)}
              placeholder="e.g. LAP-001"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asset Name *</label>
            <input type="text" value={form.asset_name} onChange={(e) => handleChange('asset_name', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select value={form.asset_type} onChange={(e) => handleChange('asset_type', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              {ASSET_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select value={form.category} onChange={(e) => handleChange('category', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={form.status} onChange={(e) => handleChange('status', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              {ASSET_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
            <input type="text" value={form.brand} onChange={(e) => handleChange('brand', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            <input type="text" value={form.model} onChange={(e) => handleChange('model', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
          <input type="text" value={form.serial_number} onChange={(e) => handleChange('serial_number', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input type="text" value={form.location} onChange={(e) => handleChange('location', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
            <input type="date" value={form.purchase_date} onChange={(e) => handleChange('purchase_date', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <input type="checkbox" id="is_onboarding_asset" checked={form.is_onboarding_asset}
            onChange={(e) => handleChange('is_onboarding_asset', e.target.checked)}
            className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
          <label htmlFor="is_onboarding_asset" className="text-sm font-medium text-gray-700">Onboarding Asset</label>
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
