'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { motion } from 'framer-motion';
import { EOAP_GATEWAY_CONFIGS, API_ENDPOINTS } from '@/lib/constants';
import { callPgFunction } from '@/lib/useGateway';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/ErrorBoundary';

interface DashboardStats {
  total_workflows: number;
  pending_hr_review: number;
  active_workflows: number;
  completed_workflows: number;
  failed_workflows: number;
  on_hold: number;
}

interface RecentWorkflow {
  workflow_id: string;
  user_id: string;
  candidate_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const StatCard = ({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) => (
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

export default function OnboardingDashboard() {
  const { session } = useSessionContext();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentWorkflows, setRecentWorkflows] = useState<RecentWorkflow[]>([]);
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
        setStats(result.data.stats || result.data);
        setRecentWorkflows(result.data.recent_workflows || []);
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
          label="Total Workflows"
          value={stats?.total_workflows || 0}
          color="bg-white border-gray-200 text-gray-800"
          icon={<svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
        />
        <StatCard
          label="Pending Review"
          value={stats?.pending_hr_review || 0}
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
          value={stats?.on_hold || 0}
          color="bg-gray-50 border-gray-200 text-gray-800"
          icon={<svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {/* Recent Workflows */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Recent Workflows</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Candidate</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Updated</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentWorkflows.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No recent workflows found</td></tr>
              ) : (
                recentWorkflows.map((wf) => (
                  <tr key={wf.workflow_id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{wf.candidate_name || wf.user_id}</td>
                    <td className="px-6 py-4"><StatusBadge status={wf.status} size="sm" /></td>
                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(wf.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(wf.updated_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
