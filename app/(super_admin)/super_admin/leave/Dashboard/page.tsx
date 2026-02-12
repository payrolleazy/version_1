'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import { ErrorBoundary, LoadingState } from '@/components/ui/ErrorBoundary';
import { LMS_GATEWAY_CONFIGS } from '@/lib/constants';
import { callPgFunction } from '@/lib/useGateway';

// ============================================================================
// Types based on lms_get_admin_dashboard [Source 559-563]
// ============================================================================
interface LMSAdminStats {
  system_stats: {
    total_employees: number;
    active_policies: number;
    total_leave_types: number;
    pending_requests: number;
    escalated_requests: number;
    failed_events: number;
  };
  request_stats: Record<string, number>;
  balance_stats: {
    total_accrued_days: number;
    total_utilized_days: number;
    total_lapsed_days: number;
    total_encashed_days: number;
  };
  automation_stats: {
    total_events_processed: number;
    successful_events: number;
    failed_events: number;
    pending_events: number;
    avg_processing_time_minutes: number;
  };
}

export default function LeaveAdminDashboard() {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const router = useRouter();

  // State
  const [stats, setStats] = useState<LMSAdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());

  const fetchDashboard = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);

    try {
      const result = await callPgFunction(
        LMS_GATEWAY_CONFIGS.ADMIN_DASHBOARD, 
        { year }, 
        session.access_token
      );

      if (result.success && result.data?.data) {
        setStats(result.data.data);
      } else {
        setError(result.error || 'Failed to load system metrics');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, year]);

  useEffect(() => {
    if (session) fetchDashboard();
  }, [session, fetchDashboard]);

  if (sessionLoading || loading) return <LoadingState message="Aggregating system health and metrics..." />;

  const s = stats?.system_stats;
  const b = stats?.balance_stats;
  const a = stats?.automation_stats;

  return (
    <ErrorBoundary>
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header & Year Filter [Source 558] */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">LMS Control Centre</h1>
              <p className="text-gray-600">Administrative oversight for leave operations & automation</p>
            </div>
            <div className="flex gap-3">
              <select 
                className="border rounded-lg px-4 py-2 bg-white text-sm font-medium"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
              >
                {[year, year - 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <Button onClick={fetchDashboard} variant="secondary">Refresh Stats</Button>
            </div>
          </div>

          {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">{error}</div>}

          {/* System Health Indicators [Source 560] */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <HealthCard 
              label="Pending Approvals" 
              value={s?.pending_requests || 0} 
              status={(s?.pending_requests ?? 0) > 20 ? 'warning' : 'good'} 
              description="Awaiting manager action"
            />
            <HealthCard 
              label="Escalated Requests" 
              value={s?.escalated_requests || 0} 
              status={(s?.escalated_requests ?? 0) > 0 ? 'critical' : 'good'} 
              description="Timed-out approval workflows"
            />
            <HealthCard 
              label="Failed System Events" 
              value={s?.failed_events || 0} 
              status={(s?.failed_events ?? 0) > 0 ? 'critical' : 'good'} 
              description="Processing errors (Last 7 days)"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Financial Liability Overview [Source 562] */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-6">Workforce Leave Liability</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase font-black">Accrued This Year</p>
                  <p className="text-2xl font-bold text-blue-600">{b?.total_accrued_days || 0} Days</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase font-black">Utilized (Paid)</p>
                  <p className="text-2xl font-bold text-green-600">{b?.total_utilized_days || 0} Days</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase font-black">Lapsed/Forfeited</p>
                  <p className="text-2xl font-bold text-orange-600">{b?.total_lapsed_days || 0} Days</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase font-black">Encashed Liability</p>
                  <p className="text-2xl font-bold text-purple-600">{b?.total_encashed_days || 0} Days</p>
                </div>
              </div>
            </div>

            {/* Automation Health [Source 563] */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-6">Automation Engine Status</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Successful Events (30d)</span>
                  <span className="font-bold text-green-600">{a?.successful_events || 0}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Pending in Queue</span>
                  <span className="font-bold text-blue-600">{a?.pending_events || 0}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Avg. Processing Time</span>
                  <span className="font-bold text-gray-900">{a?.avg_processing_time_minutes || 0} min</span>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <Button variant="secondary" size="sm" onClick={() => router.push('/admin/leave/maintenance')} className="w-full">
                    Open Operations Console
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

function HealthCard({ label, value, status, description }: { label: string; value: number; status: 'good' | 'warning' | 'critical'; description: string }) {
  const colors = {
    good: 'border-green-500 bg-green-50 text-green-700',
    warning: 'border-orange-500 bg-orange-50 text-orange-700',
    critical: 'border-red-500 bg-red-50 text-red-700'
  };
  return (
    <motion.div whileHover={{ y: -4 }} className={`p-6 rounded-2xl border-l-4 shadow-sm ${colors[status]}`}>
      <p className="text-xs font-black uppercase opacity-60 tracking-wider">{label}</p>
      <p className="text-3xl font-black mt-2">{value}</p>
      <p className="text-xs mt-2 opacity-80">{description}</p>
    </motion.div>
  );
}