'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import Tabs from '@/components/Tabs';
import { DataTable, Column } from '@/components/ui/DataTable';
import { ErrorBoundary, LoadingState } from '@/components/ui/ErrorBoundary';
import { LMS_GATEWAY_CONFIGS, HMS_GATEWAY_CONFIGS } from '@/lib/constants';
import { callPgFunction } from '@/lib/useGateway';

// ============================================================================
// Types based on LMS Analytics Views [Source 61, 110]
// ============================================================================

interface UtilizationRow {
  month: number;
  total_requests: number;
  total_days: number;
  avg_duration: number;
  emergency_requests: number;
}

interface BottleneckRow {
  position_id: number;
  avg_approval_time: number;
  request_count: number;
}

export default function LeaveAnalyticsPage() {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const router = useRouter();

  // State
  const [utilData, setUtilData] = useState<any>(null);
  const [perfData, setPerfData] = useState<any>(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters (Aligned with backend function parameters [Source 597, 601])
  const [year, setYear] = useState(new Date().getFullYear());
  const [deptId, setDeptId] = useState<string>('');

  const fetchDashboardData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);

    try {
      // Robust parallel execution pattern [Source 1226]
      const [utilRes, perfRes, deptRes] = await Promise.all([
        callPgFunction(LMS_GATEWAY_CONFIGS.UTILIZATION_REPORT, { 
          year, 
          department_id: deptId ? parseInt(deptId) : null 
        }, session.access_token),
        callPgFunction(LMS_GATEWAY_CONFIGS.WORKFLOW_PERFORMANCE_REPORT, { 
          date_from: `${year}-01-01`, 
          date_to: `${year}-12-31` 
        }, session.access_token),
        callPgFunction(HMS_GATEWAY_CONFIGS.DEPARTMENT_READ_APPROVED, { 
          page_number: 1, 
          page_size: 100 
        }, session.access_token)
      ]);

      if (utilRes.success) setUtilData(utilRes.data?.data || utilRes.data);
      if (perfRes.success) setPerfData(perfRes.data?.data || perfRes.data);
      if (deptRes.success) setDepartments(deptRes.data?.details?.data || []);
      
      if (!utilRes.success || !perfRes.success) {
        setError(utilRes.error || perfRes.error || 'Partial data load failure');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, year, deptId]);

  useEffect(() => {
    if (session) fetchDashboardData();
  }, [session, fetchDashboardData]);

  if (sessionLoading || loading) return <LoadingState message="Aggregating workforce analytics..." />;

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <ErrorBoundary>
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header & Robust Filter Bar [Source 1142] */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Leave Analytics</h1>
              <p className="text-gray-600">Operational insights and statutory utilization metrics</p>
            </div>
            <div className="flex flex-wrap gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-200">
              <select 
                className="border-none bg-transparent text-sm focus:ring-0"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
              >
                {[year, year - 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <div className="w-px h-6 bg-gray-200" />
              <select 
                className="border-none bg-transparent text-sm focus:ring-0"
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.department_name}</option>
                ))}
              </select>
              <Button onClick={fetchDashboardData} variant="secondary" size="sm">Refresh</Button>
            </div>
          </div>

          {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">{error}</div>}

          {/* KPI Grid - Values derived from Aggregate Functions [Source 598, 601] */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard title="Annual Utilization" value={`${utilData?.monthly_utilization?.reduce((acc: number, curr: any) => acc + curr.total_days, 0) || 0} Days`} color="blue" />
            <StatCard title="Avg. Response" value={`${perfData?.performance_summary?.avg_approval_time_hours || 0} Hrs`} color="purple" />
            <StatCard title="Auto-Approval" value={`${perfData?.performance_summary?.auto_approval_rate || 0}%`} color="green" />
            <StatCard title="Escalation Rate" value={`${perfData?.performance_summary?.escalation_rate || 0}%`} color="red" />
          </div>

          <Tabs>
            <Tabs.Tab label="Utilization Trends">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6">
                <div className="lg:col-span-2 bg-white rounded-xl border p-6 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-4">Monthly Breakdown</h3>
                  <DataTable 
                    data={utilData?.monthly_utilization || []} 
                    columns={[
                      { key: 'month', header: 'Month', render: (v) => monthNames[v-1] },
                      { key: 'total_requests', header: 'Requests', align: 'center' },
                      { key: 'total_days', header: 'Days', align: 'right' },
                      { key: 'emergency_requests', header: 'Emergencies', align: 'center', render: (v) => <span className={v > 0 ? 'text-red-600 font-bold' : ''}>{v}</span> }
                    ]}
                    rowKey="month"
                  />
                </div>
                <div className="bg-white rounded-xl border p-6 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-4">Policy Share</h3>
                  <DataTable 
                    data={utilData?.policy_breakdown || []} 
                    columns={[
                      { key: 'leave_type', header: 'Type' },
                      { key: 'utilization_rate', header: 'Share', render: (v) => `${v}%` }
                    ]}
                    rowKey="leave_type"
                  />
                </div>
              </div>
            </Tabs.Tab>

            <Tabs.Tab label="Efficiency & Bottlenecks">
              <div className="space-y-6 pt-6">
                <div className="bg-white rounded-xl border p-6 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-2">Approval Delays</h3>
                  <p className="text-sm text-gray-500 mb-6">Positions requiring attention due to high average response times [Source 603]</p>
                  <DataTable 
                    data={perfData?.bottlenecks || []} 
                    columns={[
                      { key: 'position_id', header: 'Position Reference', render: (v) => `#${v}` },
                      { key: 'request_count', header: 'Volume' },
                      { key: 'avg_approval_time', header: 'Avg. Response (Hrs)', render: (v) => (
                        <div className="flex items-center gap-2">
                          <div className="h-2 bg-red-100 rounded-full flex-1 w-24 overflow-hidden">
                            <div className="h-full bg-red-600" style={{ width: `${Math.min(v, 100)}%` }} />
                          </div>
                          <span className="font-bold text-red-700">{v}</span>
                        </div>
                      )}
                    ]}
                    rowKey="position_id"
                  />
                </div>
              </div>
            </Tabs.Tab>
          </Tabs>
        </div>
      </div>
    </ErrorBoundary>
  );
}

function StatCard({ title, value, color }: { title: string; value: string; color: string }) {
  const themes: any = {
    blue: 'border-blue-500 bg-blue-50 text-blue-700',
    purple: 'border-purple-500 bg-purple-50 text-purple-700',
    green: 'border-green-500 bg-green-50 text-green-700',
    red: 'border-red-500 bg-red-50 text-red-700'
  };
  return (
    <motion.div whileHover={{ y: -4 }} className={`p-6 rounded-2xl border-l-4 shadow-sm ${themes[color]}`}>
      <p className="text-xs font-black uppercase opacity-60 tracking-widest">{title}</p>
      <p className="text-3xl font-black mt-2">{value}</p>
    </motion.div>
  );
}