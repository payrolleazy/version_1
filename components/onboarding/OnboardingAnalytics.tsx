'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { motion } from 'framer-motion';
import { EOAP_GATEWAY_CONFIGS } from '@/lib/constants';
import { callPgFunction } from '@/lib/useGateway';
import { LoadingState } from '@/components/ui/ErrorBoundary';

interface AnalyticsData {
  completion_rate: number;
  avg_completion_days: number;
  total_onboarded: number;
  total_rejected: number;
  total_in_progress: number;
  total_failed: number;
  by_department: Array<{ department: string; count: number; avg_days: number }>;
  by_month: Array<{ month: string; completed: number; started: number }>;
}

const MetricCard = ({ label, value, suffix, color }: { label: string; value: number | string; suffix?: string; color: string }) => (
  <motion.div whileHover={{ scale: 1.03 }} className={`p-6 rounded-xl border shadow-sm ${color}`}>
    <p className="text-sm font-medium opacity-80 mb-1">{label}</p>
    <p className="text-3xl font-bold">
      {value}{suffix && <span className="text-lg ml-1">{suffix}</span>}
    </p>
  </motion.div>
);

export default function OnboardingAnalytics() {
  const { session } = useSessionContext();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await callPgFunction(EOAP_GATEWAY_CONFIGS.ANALYTICS, {}, session.access_token);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to load analytics');
      }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [session?.access_token]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  if (!session) return <div className="min-h-screen flex items-center justify-center"><p>Loading session...</p></div>;
  if (loading) return <LoadingState message="Loading analytics..." />;
  if (error) return <div className="p-6 bg-red-50 border-l-4 border-red-500 text-red-700 rounded"><p>{error}</p><button onClick={fetchAnalytics} className="mt-2 text-sm underline">Retry</button></div>;
  if (!data) return <div className="p-6 text-gray-500">No analytics data available</div>;

  return (
    <div className="space-y-8">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard label="Completion Rate" value={data.completion_rate} suffix="%" color="bg-green-50 border-green-200 text-green-800" />
        <MetricCard label="Avg. Days" value={data.avg_completion_days} suffix="d" color="bg-blue-50 border-blue-200 text-blue-800" />
        <MetricCard label="Total Onboarded" value={data.total_onboarded} color="bg-purple-50 border-purple-200 text-purple-800" />
        <MetricCard label="In Progress" value={data.total_in_progress} color="bg-amber-50 border-amber-200 text-amber-800" />
        <MetricCard label="Rejected" value={data.total_rejected} color="bg-red-50 border-red-200 text-red-800" />
        <MetricCard label="Failed" value={data.total_failed} color="bg-gray-50 border-gray-200 text-gray-800" />
      </div>

      {/* By Department */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">By Department</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Department</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Count</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Avg. Days</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Distribution</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(!data.by_department || data.by_department.length === 0) ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No department data</td></tr>
              ) : (
                data.by_department.map((dept) => {
                  const maxCount = Math.max(...data.by_department.map(d => d.count));
                  return (
                    <tr key={dept.department} className="hover:bg-blue-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{dept.department}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{dept.count}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{dept.avg_days}d</td>
                      <td className="px-6 py-4">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${maxCount > 0 ? (dept.count / maxCount) * 100 : 0}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Monthly Trend</h3>
        </div>
        <div className="p-6">
          {(!data.by_month || data.by_month.length === 0) ? (
            <p className="text-center text-gray-500">No monthly data</p>
          ) : (
            <div className="space-y-3">
              {data.by_month.map((month) => (
                <div key={month.month} className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600 w-24">{month.month}</span>
                  <div className="flex-1 flex items-center space-x-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                      <div className="bg-blue-400 h-full rounded-full absolute left-0" style={{ width: `${Math.max(month.started, 1) * 10}%`, maxWidth: '100%' }} />
                      <div className="bg-green-500 h-full rounded-full absolute left-0" style={{ width: `${Math.max(month.completed, 1) * 10}%`, maxWidth: '100%' }} />
                    </div>
                    <span className="text-xs text-gray-500 w-20">
                      {month.completed}/{month.started}
                    </span>
                  </div>
                </div>
              ))}
              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                <div className="flex items-center space-x-1"><div className="w-3 h-3 bg-blue-400 rounded" /><span>Started</span></div>
                <div className="flex items-center space-x-1"><div className="w-3 h-3 bg-green-500 rounded" /><span>Completed</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
