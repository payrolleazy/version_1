'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import { DataTable, Pagination, Column } from '@/components/ui/DataTable';
import { BooleanBadge } from '@/components/ui/StatusBadge';
import { ErrorBoundary, LoadingState } from '@/components/ui/ErrorBoundary';
import { AMS_GATEWAY_CONFIGS, API_ENDPOINTS, PAGINATION } from '@/lib/constants';
import { callPgFunction, callReadGateway } from '@/lib/useGateway';
import { formatDate, formatMonthYear, addMonths } from '@/lib/dateUtils';

// ============================================================================
// Types
// ============================================================================
interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
  is_optional: boolean;
  applies_to_shift_ids: string[] | null;
}

interface Shift {
  id: string;
  name: string;
}

interface HolidayFormData {
  name: string;
  holiday_date: string;
  is_optional: boolean;
  applies_to_shift_ids: string[];
}

// ============================================================================
// Main Component
// ============================================================================
export default function HolidayManagementPage() {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const router = useRouter();

  // State
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState<HolidayFormData>({
    name: '',
    holiday_date: '',
    is_optional: false,
    applies_to_shift_ids: [],
  });

  // Filter state
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Fetch shifts
  const fetchShifts = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const result = await callReadGateway<Shift[]>(
        AMS_GATEWAY_CONFIGS.READ_SHIFTS,
        { filters: { is_active: true } },
        session.access_token
      );

      if (result.success && result.data) {
        setShifts(Array.isArray(result.data) ? result.data : []);
      }
    } catch (err: any) {
      console.error('Failed to fetch shifts:', err);
    }
  }, [session?.access_token]);

  // Fetch holidays
  const fetchHolidays = useCallback(async () => {
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);

    try {
      const result = await callReadGateway<Holiday[]>(
        AMS_GATEWAY_CONFIGS.READ_HOLIDAYS,
        { orderBy: [['holiday_date', 'ASC']] },
        session.access_token
      );

      if (result.success && result.data) {
        const allHolidays = Array.isArray(result.data) ? result.data : [];
        // Filter by selected year
        const filtered = allHolidays.filter(h => {
          const year = new Date(h.holiday_date).getFullYear();
          return year === selectedYear;
        });
        setHolidays(filtered);
      } else {
        setError(result.error || 'Failed to load holidays');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, selectedYear]);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;

    setFormLoading(true);

    try {
      const params: any = {
        action: editingHoliday ? 'update' : 'create',
        name: formData.name,
        holiday_date: formData.holiday_date,
        is_optional: formData.is_optional,
        applies_to_shift_ids: formData.applies_to_shift_ids.length > 0 ? formData.applies_to_shift_ids : null,
      };

      if (editingHoliday) {
        params.holiday_id = editingHoliday.id;
      }

      const result = await callPgFunction(
        AMS_GATEWAY_CONFIGS.MANAGE_HOLIDAYS,
        params,
        session.access_token
      );

      if (result.success) {
        setIsModalOpen(false);
        setEditingHoliday(null);
        resetForm();
        fetchHolidays();
      } else {
        setError(result.error || 'Failed to save holiday');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (holiday: Holiday) => {
    if (!session?.access_token) return;
    if (!confirm(`Are you sure you want to delete "${holiday.name}"?`)) return;

    try {
      const result = await callPgFunction(
        AMS_GATEWAY_CONFIGS.MANAGE_HOLIDAYS,
        {
          action: 'delete',
          holiday_id: holiday.id,
        },
        session.access_token
      );

      if (result.success) {
        fetchHolidays();
      } else {
        setError(result.error || 'Failed to delete holiday');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      holiday_date: '',
      is_optional: false,
      applies_to_shift_ids: [],
    });
  };

  // Open edit modal
  const openEditModal = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      name: holiday.name,
      holiday_date: holiday.holiday_date,
      is_optional: holiday.is_optional,
      applies_to_shift_ids: holiday.applies_to_shift_ids || [],
    });
    setIsModalOpen(true);
  };

  // Effects
  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push('/admin/auth/login');
    }
  }, [session, sessionLoading, router]);

  useEffect(() => {
    fetchShifts();
    fetchHolidays();
  }, [fetchShifts, fetchHolidays]);

  // Group holidays by month
  const holidaysByMonth = holidays.reduce((acc, holiday) => {
    const month = formatMonthYear(holiday.holiday_date);
    if (!acc[month]) acc[month] = [];
    acc[month].push(holiday);
    return acc;
  }, {} as Record<string, Holiday[]>);

  // Table columns
  const columns: Column<Holiday>[] = [
    {
      key: 'holiday_date',
      header: 'Date',
      width: '150px',
      render: (value) => {
        const date = new Date(value);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        return (
          <div>
            <p className="font-medium text-gray-900">{formatDate(value)}</p>
            <p className="text-xs text-gray-500">{dayName}</p>
          </div>
        );
      },
    },
    {
      key: 'name',
      header: 'Holiday Name',
      render: (value) => <span className="font-medium text-gray-900">{value}</span>,
    },
    {
      key: 'is_optional',
      header: 'Type',
      width: '120px',
      render: (value) => (
        <BooleanBadge value={!value} trueLabel="Mandatory" falseLabel="Optional" size="sm" />
      ),
    },
    {
      key: 'applies_to_shift_ids',
      header: 'Applies To',
      render: (value) => {
        if (!value || value.length === 0) {
          return <span className="text-gray-500">All Shifts</span>;
        }
        const shiftNames = value.map(id => shifts.find(s => s.id === id)?.name || id).join(', ');
        return <span className="text-sm text-gray-700">{shiftNames}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '100px',
      align: 'center',
      render: (_, row) => (
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => openEditModal(row)}
            className="text-blue-600 hover:text-blue-800 p-1"
            title="Edit"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => handleDelete(row)}
            className="text-red-600 hover:text-red-800 p-1"
            title="Delete"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  // Render
  if (sessionLoading || loading) {
    return <LoadingState message="Loading holidays..." />;
  }

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Holiday Management</h1>
              <p className="text-gray-600 mt-1">Manage company holidays and observances</p>
            </div>
            <div className="flex gap-3">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <Button onClick={() => { resetForm(); setEditingHoliday(null); setIsModalOpen(true); }}>
                + Add Holiday
              </Button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
              <button onClick={() => setError(null)} className="float-right text-red-500 hover:text-red-700">
                Dismiss
              </button>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Total Holidays</p>
              <p className="text-2xl font-bold text-gray-900">{holidays.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Mandatory</p>
              <p className="text-2xl font-bold text-green-600">
                {holidays.filter(h => !h.is_optional).length}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Optional</p>
              <p className="text-2xl font-bold text-blue-600">
                {holidays.filter(h => h.is_optional).length}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Upcoming</p>
              <p className="text-2xl font-bold text-purple-600">
                {holidays.filter(h => new Date(h.holiday_date) >= new Date()).length}
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Holidays for {selectedYear}</h2>
            </div>

            <DataTable
              data={holidays}
              columns={columns}
              loading={loading}
              emptyMessage="No holidays configured"
              emptyDescription={`Add holidays for ${selectedYear}`}
              emptyAction={{ label: 'Add Holiday', onClick: () => setIsModalOpen(true) }}
              rowKey="id"
              striped
              hoverable
            />
          </div>

          {/* Calendar View - Optional */}
          {Object.keys(holidaysByMonth).length > 0 && (
            <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Calendar Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(holidaysByMonth).map(([month, monthHolidays]) => (
                  <div key={month} className="border border-gray-100 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">{month}</h3>
                    <ul className="space-y-1">
                      {monthHolidays.map((holiday) => (
                        <li key={holiday.id} className="text-sm flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${holiday.is_optional ? 'bg-blue-500' : 'bg-green-500'}`} />
                          <span className="text-gray-600">
                            {new Date(holiday.holiday_date).getDate()} - {holiday.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Holiday Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Holiday Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Independence Day"
                    required
                  />
                </div>

                {/* Holiday Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.holiday_date}
                    onChange={(e) => setFormData({ ...formData, holiday_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Holiday Type */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_optional"
                    checked={formData.is_optional}
                    onChange={(e) => setFormData({ ...formData, is_optional: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="is_optional" className="text-sm text-gray-700">
                    Optional holiday (employees can choose to work)
                  </label>
                </div>

                {/* Applies to Shifts */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Applies to Shifts
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="all_shifts"
                        checked={formData.applies_to_shift_ids.length === 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, applies_to_shift_ids: [] });
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="all_shifts" className="text-sm text-gray-700 font-medium">
                        All Shifts
                      </label>
                    </div>
                    <hr className="my-2" />
                    {shifts.map((shift) => (
                      <div key={shift.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`shift_${shift.id}`}
                          checked={formData.applies_to_shift_ids.includes(shift.id)}
                          onChange={(e) => {
                            const ids = e.target.checked
                              ? [...formData.applies_to_shift_ids, shift.id]
                              : formData.applies_to_shift_ids.filter(id => id !== shift.id);
                            setFormData({ ...formData, applies_to_shift_ids: ids });
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor={`shift_${shift.id}`} className="text-sm text-gray-700">
                          {shift.name}
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Leave unchecked to apply to all shifts
                  </p>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => { setIsModalOpen(false); setEditingHoliday(null); }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={formLoading}>
                    {formLoading ? 'Saving...' : editingHoliday ? 'Update' : 'Add Holiday'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
