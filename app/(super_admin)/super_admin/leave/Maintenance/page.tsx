'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import Tabs from '@/components/Tabs';
import { ErrorBoundary, LoadingState } from '@/components/ui/ErrorBoundary';
import { LMS_GATEWAY_CONFIGS } from '@/lib/constants';
import { callPgFunction } from '@/lib/useGateway';

// ============================================================================
// Types based on lms_system_health_check [Source 735-738]
// ============================================================================
interface SystemHealth {
  health_status: 'HEALTHY' | 'WARNING' | 'UNHEALTHY';
  timestamp: string;
  data: {
    queue_health: { pending_events: number; processing_events: number; failed_events: number; old_pending_events: number };
    notification_health: { pending_notifications: number; failed_notifications: number; old_pending_notifications: number };
    system_health: { active_policies: number; active_employees: number; stuck_requests: number; system_errors_24h: number };
  };
}

export default function LeaveOperationsHub() {
  const { session, isLoading: sessionLoading } = useSessionContext();

  // State
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [retentionYears, setRetentionYears] = useState(7);

  const fetchHealth = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const result = await callPgFunction(LMS_GATEWAY_CONFIGS.HEALTH_CHECK as any, {}, session.access_token);
      if (result.success) setHealth(result.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) fetchHealth();
  }, [session, fetchHealth]);

  const handleCleanup = async () => {
    if (!confirm(`Archive data older than ${retentionYears} years? This marks ledgers as [ARCHIVED] and purges cancelled requests.`)) return;
    setActionLoading(true);
    try {
      const result = await callPgFunction(LMS_GATEWAY_CONFIGS.CLEANUP_OLD_DATA as any, { retention_years: retentionYears }, session!.access_token);
      alert(result.data?.message || 'Cleanup complete');
      fetchHealth();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(false); }
  };

  const handleYearEndTrigger = async () => {
    if (!confirm('This will queue Year-End balance processing (Carry Forward/Lapse) for all employees whose leave year ends today. Proceed?')) return;
    setActionLoading(true);
    try {
      const result = await callPgFunction(LMS_GATEWAY_CONFIGS.SCHEDULE_YEAR_END_DYNAMIC as any, {}, session!.access_token);
      alert(result.data?.message || 'Year-end jobs scheduled');
      fetchHealth();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(false); }
  };

  if (sessionLoading || loading) return <LoadingState message="Connecting to LMS Diagnostic Engine..." />;

  return (
    <ErrorBoundary>
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">LMS Operations Hub</h1>
              <p className="text-gray-600">Statutory maintenance and system reliability tools</p>
            </div>
            <Button onClick={fetchHealth} variant="secondary">Run Diagnostics</Button>
          </div>

          {/* Health Status Ribbon [Source 739] */}
          {health && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl border mb-8 flex items-center justify-between ${
                health.health_status === 'HEALTHY' ? 'bg-green-50 border-green-200 text-green-800' :
                health.health_status === 'WARNING' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full animate-pulse ${health.health_status === 'HEALTHY' ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="font-bold tracking-wide">SYSTEM STATUS: {health.health_status}</span>
              </div>
              <span className="text-xs opacity-70">Last Check: {new Date(health.timestamp).toLocaleTimeString()}</span>
            </motion.div>
          )}

          <Tabs>
            <Tabs.Tab label="Diagnostic Overview">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                {/* Event Queue [Source 736] */}
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Automation Queue
                  </h3>
                  <div className="space-y-3">
                    <MetricRow label="Pending Tasks" value={health?.data.queue_health.pending_events} />
                    <MetricRow label="Stale Tasks (>1h)" value={health?.data.queue_health.old_pending_events} isAlert={(health?.data.queue_health.old_pending_events ?? 0) > 0} />
                    <MetricRow label="Failed (Requires Retry)" value={health?.data.queue_health.failed_events} isAlert={(health?.data.queue_health.failed_events ?? 0) > 0} />
                  </div>
                </div>

                {/* Automation Health [Source 738] */}
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    Workflow Integrity
                  </h3>
                  <div className="space-y-3">
                    <MetricRow label="Active Policies" value={health?.data.system_health.active_policies} />
                    <MetricRow label="Stuck Requests (>7d)" value={health?.data.system_health.stuck_requests} isAlert={(health?.data.system_health.stuck_requests ?? 0) > 0} />
                    <MetricRow label="System Errors (24h)" value={health?.data.system_health.system_errors_24h} isAlert={(health?.data.system_health.system_errors_24h ?? 0) > 50} />
                  </div>
                </div>
              </div>
            </Tabs.Tab>

            <Tabs.Tab label="Year-End & Maintenance">
              <div className="space-y-6 pt-6">
                {/* Year End Processing [Source 725] */}
                <div className="bg-white p-8 rounded-xl border shadow-sm">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Year-End Closing Cockpit</h3>
                  <p className="text-sm text-gray-500 mb-6">Process workforce leave transitions based on dynamic year boundaries.</p>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start gap-4">
                    <div className="flex-1 text-sm text-blue-800">
                      <strong>Manual Trigger:</strong> This action will scan for all employees whose leave cycle ends today and execute the configured carry-forward or lapse logic.
                    </div>
                    <Button size="sm" onClick={handleYearEndTrigger} isLoading={actionLoading}>Process Today&apos;s Cycle</Button>
                  </div>
                </div>

                {/* Data Cleanup [Source 495] */}
                <div className="bg-white p-8 rounded-xl border shadow-sm">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Statutory Cleanup & Archival</h3>
                  <p className="text-sm text-gray-500 mb-6">Manage database size and compliance by archiving old records.</p>
                  <div className="flex items-center gap-4">
                    <div className="w-48">
                      <label className="text-xs font-black uppercase text-gray-400">Retention (Years)</label>
                      <input 
                        type="number" value={retentionYears} 
                        onChange={(e) => setRetentionYears(parseInt(e.target.value))}
                        className="w-full border rounded-lg p-2"
                      />
                    </div>
                    <div className="flex-1 mt-4">
                      <Button variant="secondary" className="w-full" onClick={handleCleanup} isLoading={actionLoading}>Run Cleanup Engine</Button>
                    </div>
                  </div>
                </div>
              </div>
            </Tabs.Tab>
          </Tabs>
        </div>
      </div>
    </ErrorBoundary>
  );
}

function MetricRow({ label, value, isAlert = false }: { label: string; value: any; isAlert?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b last:border-0 border-gray-100">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`font-mono font-bold ${isAlert ? 'text-red-600' : 'text-gray-900'}`}>{value ?? 0}</span>
    </div>
  );
}