'use client';

import { useState, useEffect } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { ErrorBoundary, LoadingState } from '@/components/ui/ErrorBoundary';
import { TPS_GATEWAY_CONFIGS } from '@/lib/constants';
import { callPgFunction } from '@/lib/useGateway';

// ============================================================================
// Types
// ============================================================================
interface FormData {
  period_month: number;
  period_year: number;
  period_start: string;
  period_end: string;
  notes: string;
}

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

// Helper to get last day of month
function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// Helper to format date as YYYY-MM-DD
function formatDateISO(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ============================================================================
// Main Component
// ============================================================================
export default function CreateBatchPage() {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const router = useRouter();

  // Default to current month
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const [formData, setFormData] = useState<FormData>({
    period_month: currentMonth,
    period_year: currentYear,
    period_start: formatDateISO(currentYear, currentMonth, 1),
    period_end: formatDateISO(currentYear, currentMonth, getLastDayOfMonth(currentYear, currentMonth)),
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Effects
  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push('/admin/auth/login');
    }
  }, [session, sessionLoading, router]);

  // Update dates when month/year changes
  useEffect(() => {
    const { period_month, period_year } = formData;
    setFormData((prev) => ({
      ...prev,
      period_start: formatDateISO(period_year, period_month, 1),
      period_end: formatDateISO(period_year, period_month, getLastDayOfMonth(period_year, period_month)),
    }));
  }, [formData.period_month, formData.period_year]);

  // Handle month/year change
  const handleMonthChange = (month: number) => {
    setFormData((prev) => ({ ...prev, period_month: month }));
  };

  const handleYearChange = (year: number) => {
    setFormData((prev) => ({ ...prev, period_year: year }));
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);

    try {
      const batchCode = `PAY-${formData.period_year}-${String(formData.period_month).padStart(2, '0')}`;

      const payload = {
        batch_code: batchCode,
        period_month: formData.period_month,
        period_year: formData.period_year,
        period_start: formData.period_start,
        period_end: formData.period_end,
        notes: formData.notes || null,
      };

      const result = await callPgFunction(
        'tps-create-batch',
        payload,
        session.access_token
      );

      if (result.success) {
        router.push('/admin/payroll/batches');
      } else {
        setError(result.error || 'Failed to create batch');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate year options (current year and 2 previous)
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  // Render
  if (sessionLoading) {
    return <LoadingState message="Loading..." />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create Payroll Batch</h1>
              <p className="text-gray-600 mt-1">Set up a new monthly payroll processing batch</p>
            </div>
            <Button variant="secondary" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Period Selection */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Select Period</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                    <select
                      value={formData.period_month}
                      onChange={(e) => handleMonthChange(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {MONTHS.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                    <select
                      value={formData.period_year}
                      onChange={(e) => handleYearChange(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Date Range (auto-calculated) */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Period Dates</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <Input
                      type="date"
                      value={formData.period_start}
                      onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <Input
                      type="date"
                      value={formData.period_end}
                      onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Dates are auto-calculated based on selected month. Adjust if needed for custom periods.
                </p>
              </div>

              {/* Batch Code Preview */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch Code (Auto-generated)</label>
                <div className="text-lg font-mono font-bold text-blue-600">
                  PAY-{formData.period_year}-{String(formData.period_month).padStart(2, '0')}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any notes about this batch..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="secondary" onClick={() => router.back()}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={loading}>
                  Create Batch
                </Button>
              </div>
            </form>
          </motion.div>

          {/* Info Box */}
          <div className="mt-6 bg-blue-50 rounded-lg border border-blue-200 p-4">
            <h3 className="font-medium text-blue-900 mb-2">What happens next?</h3>
            <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
              <li>The batch will be created in <strong>OPEN</strong> status</li>
              <li>Attendance data can still be modified while the batch is open</li>
              <li><strong>Freeze</strong> the batch when ready to lock attendance data</li>
              <li><strong>Process</strong> the batch to calculate employee summaries</li>
              <li><strong>Finalize</strong> the batch to complete payroll preparation</li>
            </ol>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
