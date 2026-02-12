'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import { DataTable, Pagination, Column } from '@/components/ui/DataTable';
import { ErrorBoundary, LoadingState } from '@/components/ui/ErrorBoundary';
import { AMS_GATEWAY_CONFIGS, API_ENDPOINTS, PAGINATION } from '@/lib/constants';
import { callPgFunction, callReadGateway } from '@/lib/useGateway';
import { formatDate } from '@/lib/dateUtils';

// ============================================================================
// Types
// ============================================================================
interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  work_days: number[];
  break_duration_minutes: number;
  is_active: boolean;
}

interface EmployeeSchedule {
  id: string;
  user_id: string;
  shift_id: string | null;
  effective_start_date: string;
  effective_end_date: string | null;
  custom_work_days: number[] | null;
  custom_start_time: string | null;
  custom_end_time: string | null;
  custom_break_duration_minutes: number | null;
  created_at: string;
  updated_at: string;
  // Enriched fields
  full_name?: string;
  emp_code?: string;
  shift_name?: string;
}

interface ScheduleFormData {
  employee_user_id: string;
  shift_id: string;
  effective_start_date: string;
  effective_end_date: string;
  use_custom_times: boolean;
  custom_work_days: number[];
  custom_start_time: string;
  custom_end_time: string;
  custom_break_duration_minutes: number;
}

// ============================================================================
// Helper Functions
// ============================================================================
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatWorkDays(days: number[] | null): string {
  if (!days || days.length === 0) return '-';
  return days.map(d => DAYS_OF_WEEK[d]).join(', ');
}

function formatTime(time: string | null): string {
  if (!time) return '-';
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

// ============================================================================
// Main Component
// ============================================================================
export default function EmployeeSchedulesPage() {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const router = useRouter();

  // State
  const [schedules, setSchedules] = useState<EmployeeSchedule[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<EmployeeSchedule | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState<ScheduleFormData>({
    employee_user_id: '',
    shift_id: '',
    effective_start_date: new Date().toISOString().split('T')[0],
    effective_end_date: '',
    use_custom_times: false,
    custom_work_days: [1, 2, 3, 4, 5],
    custom_start_time: '09:00',
    custom_end_time: '18:00',
    custom_break_duration_minutes: 60,
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGINATION.DEFAULT_PAGE_SIZE);

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

  // Fetch schedules
  const fetchSchedules = useCallback(async () => {
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);

    try {
      const result = await callReadGateway<EmployeeSchedule[]>(
        AMS_GATEWAY_CONFIGS.READ_EMPLOYEE_SCHEDULES,
        {
          orderBy: [['effective_start_date', 'DESC']],
          limit: pageSize,
          offset: (currentPage - 1) * pageSize,
        },
        session.access_token
      );

      if (result.success && result.data) {
        setSchedules(Array.isArray(result.data) ? result.data : []);
      } else {
        setError(result.error || 'Failed to load schedules');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, currentPage, pageSize]);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;

    setFormLoading(true);

    try {
      const params: any = {
        action: editingSchedule ? 'update' : 'create',
        employee_user_id: formData.employee_user_id,
        shift_id: formData.shift_id || null,
        effective_start_date: formData.effective_start_date,
        effective_end_date: formData.effective_end_date || null,
      };

      if (editingSchedule) {
        params.schedule_id = editingSchedule.id;
      }

      if (formData.use_custom_times) {
        params.custom_work_days = formData.custom_work_days;
        params.custom_start_time = formData.custom_start_time;
        params.custom_end_time = formData.custom_end_time;
        params.custom_break_duration_minutes = formData.custom_break_duration_minutes;
      }

      const result = await callPgFunction(
        AMS_GATEWAY_CONFIGS.MANAGE_EMPLOYEE_SCHEDULES,
        params,
        session.access_token
      );

      if (result.success) {
        setIsModalOpen(false);
        setEditingSchedule(null);
        resetForm();
        fetchSchedules();
      } else {
        setError(result.error || 'Failed to save schedule');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async (schedule: EmployeeSchedule) => {
    if (!session?.access_token) return;
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      const result = await callPgFunction(
        AMS_GATEWAY_CONFIGS.MANAGE_EMPLOYEE_SCHEDULES,
        {
          action: 'delete',
          schedule_id: schedule.id,
        },
        session.access_token
      );

      if (result.success) {
        fetchSchedules();
      } else {
        setError(result.error || 'Failed to delete schedule');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      employee_user_id: '',
      shift_id: '',
      effective_start_date: new Date().toISOString().split('T')[0],
      effective_end_date: '',
      use_custom_times: false,
      custom_work_days: [1, 2, 3, 4, 5],
      custom_start_time: '09:00',
      custom_end_time: '18:00',
      custom_break_duration_minutes: 60,
    });
  };

  // Open edit modal
  const openEditModal = (schedule: EmployeeSchedule) => {
    setEditingSchedule(schedule);
    setFormData({
      employee_user_id: schedule.user_id,
      shift_id: schedule.shift_id || '',
      effective_start_date: schedule.effective_start_date,
      effective_end_date: schedule.effective_end_date || '',
      use_custom_times: !!schedule.custom_start_time,
      custom_work_days: schedule.custom_work_days || [1, 2, 3, 4, 5],
      custom_start_time: schedule.custom_start_time || '09:00',
      custom_end_time: schedule.custom_end_time || '18:00',
      custom_break_duration_minutes: schedule.custom_break_duration_minutes || 60,
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
    fetchSchedules();
  }, [fetchShifts, fetchSchedules]);

  // Table columns
  const columns: Column<EmployeeSchedule>[] = [
    {
      key: 'full_name',
      header: 'Employee',
      render: (value, row) => (
        <div>
          <p className="font-medium text-gray-900">{value || 'Unknown'}</p>
          <p className="text-xs text-gray-500">{row.emp_code}</p>
        </div>
      ),
    },
    {
      key: 'shift_name',
      header: 'Shift',
      render: (value, row) => {
        if (row.custom_start_time) {
          return (
            <div>
              <p className="font-medium text-gray-900">Custom Schedule</p>
              <p className="text-xs text-gray-500">
                {formatTime(row.custom_start_time)} - {formatTime(row.custom_end_time)}
              </p>
            </div>
          );
        }
        return value || '-';
      },
    },
    {
      key: 'custom_work_days',
      header: 'Work Days',
      render: (value, row) => {
        const shift = shifts.find(s => s.id === row.shift_id);
        const days = value || shift?.work_days;
        return formatWorkDays(days);
      },
    },
    {
      key: 'effective_start_date',
      header: 'Effective From',
      width: '120px',
      render: (value) => formatDate(value),
    },
    {
      key: 'effective_end_date',
      header: 'Effective To',
      width: '120px',
      render: (value) => value ? formatDate(value) : 'Ongoing',
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '120px',
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
    return <LoadingState message="Loading employee schedules..." />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Employee Schedules</h1>
              <p className="text-gray-600 mt-1">Manage employee shift and schedule assignments</p>
            </div>
            <Button onClick={() => { resetForm(); setEditingSchedule(null); setIsModalOpen(true); }}>
              + Assign Schedule
            </Button>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Total Schedules</p>
              <p className="text-2xl font-bold text-gray-900">{schedules.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Active Shifts</p>
              <p className="text-2xl font-bold text-blue-600">{shifts.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Custom Schedules</p>
              <p className="text-2xl font-bold text-purple-600">
                {schedules.filter(s => s.custom_start_time).length}
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <DataTable
              data={schedules}
              columns={columns}
              loading={loading}
              emptyMessage="No schedules assigned"
              emptyDescription="Start by assigning a schedule to an employee"
              emptyAction={{ label: 'Assign Schedule', onClick: () => setIsModalOpen(true) }}
              rowKey="id"
              striped
              hoverable
            />

            {schedules.length > pageSize && (
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(schedules.length / pageSize)}
                totalItems={schedules.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            )}
          </div>
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
                  {editingSchedule ? 'Edit Schedule' : 'Assign New Schedule'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Employee Selection - In production, this would be a searchable dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Employee User ID
                  </label>
                  <input
                    type="text"
                    value={formData.employee_user_id}
                    onChange={(e) => setFormData({ ...formData, employee_user_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    disabled={!!editingSchedule}
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter the employee&apos;s user ID</p>
                </div>

                {/* Shift Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Shift
                  </label>
                  <select
                    value={formData.shift_id}
                    onChange={(e) => setFormData({ ...formData, shift_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a shift</option>
                    {shifts.map((shift) => (
                      <option key={shift.id} value={shift.id}>
                        {shift.name} ({formatTime(shift.start_time)} - {formatTime(shift.end_time)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Effective Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Effective From
                    </label>
                    <input
                      type="date"
                      value={formData.effective_start_date}
                      onChange={(e) => setFormData({ ...formData, effective_start_date: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Effective To (Optional)
                    </label>
                    <input
                      type="date"
                      value={formData.effective_end_date}
                      onChange={(e) => setFormData({ ...formData, effective_end_date: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Custom Times Toggle */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="use_custom_times"
                    checked={formData.use_custom_times}
                    onChange={(e) => setFormData({ ...formData, use_custom_times: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="use_custom_times" className="text-sm text-gray-700">
                    Use custom times (override shift)
                  </label>
                </div>

                {/* Custom Times Section */}
                {formData.use_custom_times && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={formData.custom_start_time}
                          onChange={(e) => setFormData({ ...formData, custom_start_time: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Time
                        </label>
                        <input
                          type="time"
                          value={formData.custom_end_time}
                          onChange={(e) => setFormData({ ...formData, custom_end_time: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Break Duration (minutes)
                      </label>
                      <input
                        type="number"
                        value={formData.custom_break_duration_minutes}
                        onChange={(e) => setFormData({ ...formData, custom_break_duration_minutes: parseInt(e.target.value) })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                        max="120"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Work Days
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {DAYS_OF_WEEK.map((day, index) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              const days = formData.custom_work_days.includes(index)
                                ? formData.custom_work_days.filter(d => d !== index)
                                : [...formData.custom_work_days, index].sort();
                              setFormData({ ...formData, custom_work_days: days });
                            }}
                            className={`
                              px-3 py-1 rounded-full text-sm font-medium transition-colors
                              ${formData.custom_work_days.includes(index)
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }
                            `}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => { setIsModalOpen(false); setEditingSchedule(null); }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={formLoading}>
                    {formLoading ? 'Saving...' : editingSchedule ? 'Update' : 'Assign'}
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
