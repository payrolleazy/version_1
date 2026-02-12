'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { ErrorBoundary, LoadingState } from '@/components/ui/ErrorBoundary';
import { AMS_GATEWAY_CONFIGS } from '@/lib/constants';
import { callReadGateway, callPgFunction } from '@/lib/useGateway';

// ============================================================================
// Types
// ============================================================================
// Matches actual DB columns from ams_company_attendance_settings
interface AttendanceSettings {
  id: string;
  tenant_id: string;

  // Time Settings (DB column names)
  grace_period_late_minutes: number;
  grace_period_early_minutes: number;
  early_leaving_threshold_minutes: number;
  default_work_hours_per_day: string; // numeric comes as string
  half_day_hours: string; // numeric comes as string

  // Location Settings
  geo_fencing_enabled: boolean;
  ip_restrictions_enabled: boolean;
  allowed_ips: string[];

  // Overtime Settings
  overtime_calculation_basis: string | null; // 'daily' | null
  weekly_overtime_threshold_hours: string; // numeric as string
  overtime_rate_multiplier: string; // numeric as string

  // Late/Early Penalties
  late_penalty_config: { enabled: boolean; deduction_days: number; threshold_count: number } | null;
  early_departure_penalty_enabled: boolean;
  early_departure_penalty_per_instance: string; // numeric as string

  // Auto-Processing
  auto_mark_absent: boolean;
  auto_mark_absent_time: string; // time as "HH:MM:SS"
  auto_clock_out_enabled: boolean;
  auto_clock_out_time: string; // time as "HH:MM:SS"

  // General
  default_working_days: number[];

  updated_at: string;
}

interface FormData {
  grace_period_minutes: number;
  early_departure_threshold_minutes: number;
  minimum_work_hours: number;
  require_geofence: boolean;
  require_ip_restriction: boolean;
  allowed_ip_ranges: string;
  overtime_enabled: boolean;
  overtime_threshold_hours: number;
  overtime_rate_multiplier: number;
  late_penalty_enabled: boolean;
  late_penalty_per_instance: number;
  early_departure_penalty_enabled: boolean;
  early_departure_penalty_per_instance: number;
  auto_mark_absent: boolean;
  auto_absent_time: string;
  auto_punch_out: boolean;
  auto_punch_out_time: string;
  weekend_days: number[];
  half_day_hours: number;
}

const DEFAULT_SETTINGS: FormData = {
  grace_period_minutes: 15,
  early_departure_threshold_minutes: 15,
  minimum_work_hours: 8,
  require_geofence: false,
  require_ip_restriction: false,
  allowed_ip_ranges: '',
  overtime_enabled: false,
  overtime_threshold_hours: 9,
  overtime_rate_multiplier: 1.5,
  late_penalty_enabled: false,
  late_penalty_per_instance: 0,
  early_departure_penalty_enabled: false,
  early_departure_penalty_per_instance: 0,
  auto_mark_absent: true,
  auto_absent_time: '12:00',
  auto_punch_out: false,
  auto_punch_out_time: '23:59',
  weekend_days: [0, 6],
  half_day_hours: 4,
};

const DAYS_OF_WEEK = [
  { id: 0, label: 'Sunday' },
  { id: 1, label: 'Monday' },
  { id: 2, label: 'Tuesday' },
  { id: 3, label: 'Wednesday' },
  { id: 4, label: 'Thursday' },
  { id: 5, label: 'Friday' },
  { id: 6, label: 'Saturday' },
];

// ============================================================================
// Main Component
// ============================================================================
export default function AttendanceSettingsPage() {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const router = useRouter();

  // State
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [formData, setFormData] = useState<FormData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);

    try {
      const result = await callReadGateway<AttendanceSettings[]>(
        AMS_GATEWAY_CONFIGS.READ_COMPANY_SETTINGS,
        {},
        session.access_token
      );

      if (result.success && result.data) {
        const data = Array.isArray(result.data) ? result.data[0] : result.data;
        if (data) {
          setSettings(data);
          // Map DB column names → frontend form field names
          // DB returns numeric as strings ("8.00") and time as "HH:MM:SS"
          const latePenaltyCfg = data.late_penalty_config;
          setFormData({
            grace_period_minutes: Number(data.grace_period_late_minutes) || 15,
            early_departure_threshold_minutes: Number(data.early_leaving_threshold_minutes) || 15,
            minimum_work_hours: Number(data.default_work_hours_per_day) || 8,
            require_geofence: data.geo_fencing_enabled ?? false,
            require_ip_restriction: data.ip_restrictions_enabled ?? false,
            allowed_ip_ranges: (data.allowed_ips || []).join('\n'),
            overtime_enabled: !!data.overtime_calculation_basis,
            overtime_threshold_hours: Number(data.weekly_overtime_threshold_hours) || 9,
            overtime_rate_multiplier: Number(data.overtime_rate_multiplier) || 1.5,
            late_penalty_enabled: latePenaltyCfg?.enabled ?? false,
            late_penalty_per_instance: Number(latePenaltyCfg?.deduction_days) || 0,
            early_departure_penalty_enabled: data.early_departure_penalty_enabled ?? false,
            early_departure_penalty_per_instance: Number(data.early_departure_penalty_per_instance) || 0,
            auto_mark_absent: data.auto_mark_absent ?? true,
            auto_absent_time: (data.auto_mark_absent_time || '12:00:00').substring(0, 5),
            auto_punch_out: data.auto_clock_out_enabled ?? false,
            auto_punch_out_time: (data.auto_clock_out_time || '23:59:00').substring(0, 5),
            weekend_days: data.default_working_days ?? [0, 6],
            half_day_hours: Number(data.half_day_hours) || 4,
          });
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch settings:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  // Effects
  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push('/admin/auth/login');
    }
  }, [session, sessionLoading, router]);

  useEffect(() => {
    if (session) {
      fetchSettings();
    }
  }, [session, fetchSettings]);

  // Track changes
  const updateFormData = (updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
    setSuccess(null);
  };

  // Weekend day toggle
  const toggleWeekendDay = (dayId: number) => {
    const current = formData.weekend_days;
    const updated = current.includes(dayId)
      ? current.filter((d) => d !== dayId)
      : [...current, dayId].sort();
    updateFormData({ weekend_days: updated });
  };

  // Save settings
  const handleSave = async () => {
    if (!session?.access_token) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        ...formData,
        allowed_ip_ranges: formData.allowed_ip_ranges
          .split('\n')
          .map((ip) => ip.trim())
          .filter((ip) => ip.length > 0),
      };

      const result = await callPgFunction(
        AMS_GATEWAY_CONFIGS.UPDATE_SETTINGS,
        payload,
        session.access_token
      );

      if (result.success) {
        setSuccess('Settings saved successfully');
        setHasChanges(false);
        fetchSettings();
      } else {
        setError(result.error || 'Failed to save settings');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Render
  if (sessionLoading || loading) {
    return <LoadingState message="Loading attendance settings..." />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Attendance Settings</h1>
              <p className="text-gray-600 mt-1">Configure company-wide attendance rules and policies</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => router.back()}>
                Back
              </Button>
              <Button onClick={handleSave} isLoading={saving} disabled={!hasChanges}>
                Save Changes
              </Button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              {success}
            </div>
          )}

          <div className="space-y-6">
            {/* Time Settings */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Time Settings
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grace Period (Minutes)</label>
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    value={formData.grace_period_minutes}
                    onChange={(e) => updateFormData({ grace_period_minutes: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Late arrivals within this window are not penalized</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Early Departure Threshold (Minutes)</label>
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    value={formData.early_departure_threshold_minutes}
                    onChange={(e) => updateFormData({ early_departure_threshold_minutes: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Early exits within this window are not penalized</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Work Hours</label>
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    step={0.5}
                    value={formData.minimum_work_hours}
                    onChange={(e) => updateFormData({ minimum_work_hours: parseFloat(e.target.value) || 8 })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Expected daily work hours</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Half Day Hours</label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    step={0.5}
                    value={formData.half_day_hours}
                    onChange={(e) => updateFormData({ half_day_hours: parseFloat(e.target.value) || 4 })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Hours required for half-day attendance</p>
                </div>
              </div>
            </motion.div>

            {/* Weekend Configuration */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Weekend Days
              </h2>

              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleWeekendDay(day.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      formData.weekend_days.includes(day.id)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-3">Selected days will be marked as weekends (non-working days)</p>
            </motion.div>

            {/* Location Settings */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                Location Restrictions
              </h2>

              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.require_geofence}
                    onChange={(e) => updateFormData({ require_geofence: e.target.checked })}
                    className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Require Geofence</span>
                    <p className="text-xs text-gray-500">Employees must be within configured geofence locations to punch in/out</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.require_ip_restriction}
                    onChange={(e) => updateFormData({ require_ip_restriction: e.target.checked })}
                    className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Require IP Restriction</span>
                    <p className="text-xs text-gray-500">Employees must be on allowed networks to punch in/out</p>
                  </div>
                </label>

                {formData.require_ip_restriction && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Allowed IP Ranges</label>
                    <textarea
                      value={formData.allowed_ip_ranges}
                      onChange={(e) => updateFormData({ allowed_ip_ranges: e.target.value })}
                      placeholder="192.168.1.0/24&#10;10.0.0.0/8"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
                      rows={4}
                    />
                    <p className="text-xs text-gray-500 mt-1">Enter one IP or CIDR range per line</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Overtime Settings */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Overtime Settings
              </h2>

              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.overtime_enabled}
                    onChange={(e) => updateFormData({ overtime_enabled: e.target.checked })}
                    className="h-5 w-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Enable Overtime Tracking</span>
                    <p className="text-xs text-gray-500">Track and calculate overtime hours for payroll</p>
                  </div>
                </label>

                {formData.overtime_enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-8">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Overtime Threshold (Hours)</label>
                      <Input
                        type="number"
                        min={1}
                        max={24}
                        step={0.5}
                        value={formData.overtime_threshold_hours}
                        onChange={(e) => updateFormData({ overtime_threshold_hours: parseFloat(e.target.value) || 9 })}
                      />
                      <p className="text-xs text-gray-500 mt-1">Hours after which overtime begins</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Overtime Rate Multiplier</label>
                      <Input
                        type="number"
                        min={1}
                        max={3}
                        step={0.1}
                        value={formData.overtime_rate_multiplier}
                        onChange={(e) => updateFormData({ overtime_rate_multiplier: parseFloat(e.target.value) || 1.5 })}
                      />
                      <p className="text-xs text-gray-500 mt-1">e.g. 1.5x, 2x pay rate</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Penalty Settings */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Late/Early Penalties
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.late_penalty_enabled}
                        onChange={(e) => updateFormData({ late_penalty_enabled: e.target.checked })}
                        className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Enable Late Arrival Penalty</span>
                    </label>

                    {formData.late_penalty_enabled && (
                      <div className="pl-8">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Penalty Amount Per Instance</label>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={formData.late_penalty_per_instance}
                          onChange={(e) => updateFormData({ late_penalty_per_instance: parseFloat(e.target.value) || 0 })}
                        />
                        <p className="text-xs text-gray-500 mt-1">Deducted from salary per late instance</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.early_departure_penalty_enabled}
                        onChange={(e) => updateFormData({ early_departure_penalty_enabled: e.target.checked })}
                        className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Enable Early Departure Penalty</span>
                    </label>

                    {formData.early_departure_penalty_enabled && (
                      <div className="pl-8">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Penalty Amount Per Instance</label>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={formData.early_departure_penalty_per_instance}
                          onChange={(e) => updateFormData({ early_departure_penalty_per_instance: parseFloat(e.target.value) || 0 })}
                        />
                        <p className="text-xs text-gray-500 mt-1">Deducted from salary per early exit</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Auto-Processing Settings */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Auto-Processing
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.auto_mark_absent}
                        onChange={(e) => updateFormData({ auto_mark_absent: e.target.checked })}
                        className="h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">Auto-Mark Absent</span>
                        <p className="text-xs text-gray-500">Automatically mark employees absent if no punch by cutoff time</p>
                      </div>
                    </label>

                    {formData.auto_mark_absent && (
                      <div className="pl-8">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Absent Cutoff Time</label>
                        <Input
                          type="time"
                          value={formData.auto_absent_time}
                          onChange={(e) => updateFormData({ auto_absent_time: e.target.value })}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.auto_punch_out}
                        onChange={(e) => updateFormData({ auto_punch_out: e.target.checked })}
                        className="h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">Auto Punch-Out</span>
                        <p className="text-xs text-gray-500">Automatically punch out employees at end of day</p>
                      </div>
                    </label>

                    {formData.auto_punch_out && (
                      <div className="pl-8">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Auto Punch-Out Time</label>
                        <Input
                          type="time"
                          value={formData.auto_punch_out_time}
                          onChange={(e) => updateFormData({ auto_punch_out_time: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Bottom Save Button */}
          {hasChanges && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="fixed bottom-6 right-6"
            >
              <Button onClick={handleSave} isLoading={saving} className="shadow-lg">
                Save All Changes
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
