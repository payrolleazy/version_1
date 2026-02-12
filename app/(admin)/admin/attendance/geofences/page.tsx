'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/Modal';
import { ErrorBoundary, LoadingState } from '@/components/ui/ErrorBoundary';
import { AMS_GATEWAY_CONFIGS } from '@/lib/constants';
import { callReadGateway, callPgFunction } from '@/lib/useGateway';

// --- TYPES ---
interface Geofence {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
}

export default function GeofenceManagementPage() {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const router = useRouter();

  // --- STATE ---
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Delete Confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<Geofence | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    latitude: '',
    longitude: '',
    radius_meters: 100
  });

  // --- FETCH GEOFENCES ---
  const fetchGeofences = useCallback(async () => {
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);

    try {
      const result = await callReadGateway<Geofence[]>(
        AMS_GATEWAY_CONFIGS.READ_GEOFENCES,
        { orderBy: [['name', 'ASC']] },
        session.access_token
      );

      if (result.success && result.data) {
        setGeofences(Array.isArray(result.data) ? result.data : []);
      } else {
        setError(result.error || 'Failed to fetch geofences');
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push('/admin/auth/login');
    }
  }, [session, sessionLoading, router]);

  useEffect(() => {
    if (session) fetchGeofences();
  }, [session, fetchGeofences]);

  // --- MODAL HANDLERS ---
  const handleOpenModal = (geofence?: Geofence) => {
    if (geofence) {
      setEditingGeofence(geofence);
      setFormData({
        name: geofence.name,
        latitude: String(geofence.latitude),
        longitude: String(geofence.longitude),
        radius_meters: geofence.radius_meters
      });
    } else {
      setEditingGeofence(null);
      setFormData({ name: '', latitude: '', longitude: '', radius_meters: 100 });
    }
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingGeofence(null);
    setFormData({ name: '', latitude: '', longitude: '', radius_meters: 100 });
    setModalError(null);
  };

  // --- ADD/UPDATE GEOFENCE HANDLER ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;

    setFormLoading(true);
    setModalError(null);

    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    const rad = parseInt(formData.radius_meters.toString());

    if (isNaN(lat) || isNaN(lng) || isNaN(rad)) {
      setModalError("Invalid numeric values for coordinates or radius.");
      setFormLoading(false);
      return;
    }

    if (lat < -90 || lat > 90) {
      setModalError("Latitude must be between -90 and 90.");
      setFormLoading(false);
      return;
    }

    if (lng < -180 || lng > 180) {
      setModalError("Longitude must be between -180 and 180.");
      setFormLoading(false);
      return;
    }

    try {
      const payload = {
        geofences: [
          {
            id: editingGeofence?.id || null,
            name: formData.name,
            latitude: lat,
            longitude: lng,
            radius_meters: rad
          }
        ]
      };

      const result = await callPgFunction(
        AMS_GATEWAY_CONFIGS.UPSERT_GEOFENCES,
        payload,
        session.access_token
      );

      if (result.success) {
        handleCloseModal();
        fetchGeofences();
      } else {
        setModalError(result.error || 'Failed to save geofence');
      }
    } catch (e: any) {
      setModalError(e.message);
    } finally {
      setFormLoading(false);
    }
  };

  // --- DELETE GEOFENCE HANDLER ---
  const handleDelete = async () => {
    if (!session?.access_token || !deleteConfirm) return;

    setDeleteLoading(true);

    try {
      const result = await callPgFunction(
        AMS_GATEWAY_CONFIGS.MANAGE_GEOFENCES,
        { action: 'DELETE', geofence_id: deleteConfirm.id },
        session.access_token
      );

      if (result.success) {
        setDeleteConfirm(null);
        fetchGeofences();
      } else {
        alert(result.error || 'Failed to delete geofence');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // --- HELPERS ---
  const getLocationLink = (lat: number, lng: number) => {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  };

  // --- RENDER ---
  if (sessionLoading || loading) {
    return <LoadingState message="Loading geofence locations..." />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Geofence Locations</h1>
              <p className="text-gray-600 mt-1">Manage allowed clock-in/out locations for employees</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => router.back()}>
                Back
              </Button>
              <Button onClick={() => handleOpenModal()}>
                + Add Location
              </Button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Geofence Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {geofences.length === 0 ? (
              <div className="col-span-full bg-white rounded-lg border border-gray-200 p-8 text-center">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-gray-600 mb-2">No geofences configured</p>
                <p className="text-sm text-gray-500">Employees can punch from anywhere unless geofence restriction is enabled.</p>
              </div>
            ) : (
              geofences.map((geo, index) => (
                <motion.div
                  key={geo.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-lg text-gray-900">{geo.name}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${geo.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {geo.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-center gap-2 text-blue-600 font-semibold">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      {geo.radius_meters}m Radius
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex justify-between">
                      <span>Latitude:</span>
                      <span className="font-mono text-gray-900">{geo.latitude.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Longitude:</span>
                      <span className="font-mono text-gray-900">{geo.longitude.toFixed(6)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <a
                      href={getLocationLink(geo.latitude, geo.longitude)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors font-medium"
                    >
                      View Map
                    </a>
                    <Button
                      variant="secondary"
                      onClick={() => handleOpenModal(geo)}
                      className="flex-1"
                    >
                      Edit
                    </Button>
                    <button
                      onClick={() => setDeleteConfirm(geo)}
                      className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Info Box */}
          <div className="mt-6 bg-blue-50 rounded-lg border border-blue-200 p-4">
            <h3 className="font-medium text-blue-900 mb-2">About Geofencing</h3>
            <p className="text-sm text-blue-700">
              Geofences define valid locations where employees can punch in/out.
              Enable geofence restriction in <strong>Attendance Settings</strong> to enforce location-based attendance.
              The radius determines how far from the center point punches are accepted.
            </p>
          </div>
        </div>

        {/* Add/Edit Modal */}
        {isModalOpen && (
          <Modal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            title={editingGeofence ? 'Edit Geofence' : 'Add New Geofence'}
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Head Office"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Latitude *</label>
                  <Input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    required
                    placeholder="12.9716"
                  />
                  <p className="text-xs text-gray-500 mt-1">Range: -90 to 90</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Longitude *</label>
                  <Input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    required
                    placeholder="77.5946"
                  />
                  <p className="text-xs text-gray-500 mt-1">Range: -180 to 180</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Radius (Meters) *</label>
                <Input
                  type="number"
                  min={10}
                  max={10000}
                  value={formData.radius_meters}
                  onChange={(e) => setFormData({ ...formData, radius_meters: parseInt(e.target.value) || 100 })}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Recommended: 100-500m. Larger radius for areas with poor GPS signal.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                <strong>Tip:</strong> Use Google Maps to find coordinates. Right-click on a location and copy the latitude,longitude values.
              </div>

              {modalError && (
                <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
                  {modalError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="secondary" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={formLoading}>
                  {editingGeofence ? 'Update Location' : 'Add Location'}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <Modal
            isOpen={!!deleteConfirm}
            onClose={() => setDeleteConfirm(null)}
            title="Delete Geofence"
          >
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to delete the geofence <strong>{deleteConfirm.name}</strong>?
              </p>
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                <strong>Warning:</strong> This action cannot be undone. Employees will no longer be restricted to this location.
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} isLoading={deleteLoading}>
                  Delete
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </ErrorBoundary>
  );
}