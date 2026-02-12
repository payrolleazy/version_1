'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { EOAP_GATEWAY_CONFIGS } from '@/lib/constants';
import { callPgFunction } from '@/lib/useGateway';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/ErrorBoundary';

// --- TYPES ALIGNED WITH POSTGRES FUNCTION: eoap_get_dashboard_data ---

interface DashboardStats {
  total_workflows: number;
  pending_approvals: number; // Corrected from pending_hr_review
  active_workflows: number;
  completed_workflows: number;
  failed_workflows: number;
  on_hold_workflows: number; // Corrected from on_hold
  average_progress: number;
}

interface WorkerHealth {
  worker_id: string;
  status: 'ACTIVE' | 'IDLE' | 'PROCESSING' | 'ERROR' | string;
  last_heartbeat: string;
  metrics: {
    processed_at?: string;
    version?: string;
    error?: string;
  };
}

interface RecentWorkflow {
  id: string;
  employee_name: string; // Corrected from candidate_name
  status: string;
  progress_percentage: number;
  current_step: string;
  updated_at: string;
}

// --- SUB-COMPONENTS ---

const StatCard = ({ label, value, color, icon }: { label: string; value: number | string; color: string; icon: React.ReactNode }) => (
  <motion.div
    whileHover={{ scale: 1.03, y: -2 }}
    className={`p-6 rounded-xl border shadow-sm ${color}`}
  >
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-medium opacity-80">{label}</span>
      {icon}
    </div>
    <p className="text-3xl font-bold">{value}</p>
  </motion.div>
);

const WorkerStatusMonitor = ({ health }: { health: WorkerHealth[] }) => {
  if (!health || health.length === 0) return null;
  
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2 uppercase tracking-wider">
        <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Automation Worker Status
      </h3>
      <div className="space-y-4">
        {health.map((worker) => (
          <div key={worker.worker_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex flex-col">
              <span className="text-xs font-mono font-bold text-gray-700">{worker.worker_id}</span>
              <span className="text-[10px] text-gray-500 italic">
                Last Heartbeat: {new Date(worker.last_heartbeat).toLocaleString()}
              </span>
            </div>
            <StatusBadge status={worker.status} size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

export default function OnboardingDashboard() {
  const { session } = useSessionContext();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentWorkflows, setRecentWorkflows] = useState<RecentWorkflow[]>([]);
  const [systemHealth, setSystemHealth] = useState<WorkerHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await callPgFunction(
        EOAP_GATEWAY_CONFIGS.DASHBOARD_STATS,
        {},
        session.access_token
      );
      
      if (result.success && result.data) {
        // Aligned with backend return keys: 'statistics', 'recent_workflows', 'system_health'
        setStats(result.data.statistics);
        setRecentWorkflows(result.data.recent_workflows || []);
        setSystemHealth(result.data.system_health || []);
      } else {
        setError(result.error || 'Failed to load dashboard');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (!session) {
    return <div className="min-h-screen flex items-center justify-center"><p>Loading session...</p></div>;
  }

  if (loading) return <LoadingState message="Loading onboarding dashboard..." />;

  if (error) {
    return (
      <div className="p-6 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
        <p className="font-medium">Error loading dashboard</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={fetchDashboard} className="mt-2 text-sm underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Total Journeys"
          value={stats?.total_workflows || 0}
          color="bg-white border-gray-200 text-gray-800"
          icon={<svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
        />
        <StatCard
          label="Pending Review"
          value={stats?.pending_approvals || 0}
          color="bg-amber-50 border-amber-200 text-amber-800"
          icon={<svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Active"
          value={stats?.active_workflows || 0}
          color="bg-blue-50 border-blue-200 text-blue-800"
          icon={<svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
        />
        <StatCard
          label="Completed"
          value={stats?.completed_workflows || 0}
          color="bg-green-50 border-green-200 text-green-800"
          icon={<svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
        />
        <StatCard
          label="Failed"
          value={stats?.failed_workflows || 0}
          color="bg-red-50 border-red-200 text-red-800"
          icon={<svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
        />
        <StatCard
          label="On Hold"
          value={stats?.on_hold_workflows || 0}
          color="bg-gray-50 border-gray-200 text-gray-800"
          icon={<svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Recent Workflows Table */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-800">Recent Activity</h3>
            <Link href="/admin/onboarding/active-workflows" className="text-sm text-purple-600 hover:underline font-medium">
              View All Workflows
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Progress</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Update</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentWorkflows.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500 italic">No recent workflows found in the last 7 days.</td></tr>
                ) : (
                  recentWorkflows.map((wf) => (
                    <tr key={wf.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{wf.employee_name}</td>
                      <td className="px-6 py-4"><StatusBadge status={wf.status} size="sm" /></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <div className="w-16 bg-gray-200 rounded-full h-1.5">
                              <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${wf.progress_percentage}%` }} />
                           </div>
                           <span className="text-[10px] text-gray-500 font-bold">{wf.progress_percentage}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">{new Date(wf.updated_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Worker Health Monitoring */}
        <div className="lg:col-span-1">
          <WorkerStatusMonitor health={systemHealth} />
          
          <div className="mt-6 bg-purple-50 rounded-xl p-6 border border-purple-100">
             <h4 className="font-bold text-purple-900 text-sm mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z" /></svg>
                Admin Quick Tips
             </h4>
             <p className="text-xs text-purple-800 leading-relaxed">
                The Automation Worker processes background tasks like asset assignment and profile activation every 5 minutes. If status shows <span className="font-bold">ERROR</span>, contact IT.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}