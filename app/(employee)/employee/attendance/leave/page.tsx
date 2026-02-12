'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import Link from 'next/link';

// --- CONFIGURATION ---
const GATEWAY_URL = '/api/a_crud_universal_pg_function_gateway';
const CONFIG_ID = 'lms-employee-dashboard';

// --- TYPES ---
interface LeaveBalance {
  policy_id: string;
  leave_type_name: string;
  current_balance: number;
  accrued_this_year: number;
  utilized_this_year: number;
  pending_requests: number;
  metadata: {
    color?: string;
    icon?: string;
  };
}

interface UpcomingLeave {
  id: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  days_until_start: number;
}

interface LeaveStats {
  total_requests: number;
  approved_requests: number;
  pending_requests: number;
  rejected_requests: number;
  total_days_taken: number;
}

interface DashboardData {
  balances: LeaveBalance[];
  upcoming_leaves: UpcomingLeave[];
  recent_requests: any[];
  statistics: LeaveStats;
}

export default function EmployeeLeaveDashboard() {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const router = useRouter();
  const initialLoadComplete = useRef(false);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- DATA FETCHING ---
  const fetchDashboardData = useCallback(async () => {
    if (!session?.access_token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config_id: CONFIG_ID,
          params: {
            user_id: session.user.id, // Explicitly passing ID for robustness
            year: new Date().getFullYear()
          },
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();

      if (!response.ok || (result.hasOwnProperty('success') && !result.success)) {
        throw new Error(result.message || result.error || 'Failed to load dashboard data');
      }

      // Handle potential data wrapping from the gateway
      setData(result.data || result);

    } catch (err: any) {
      console.error('LMS Dashboard Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  // --- SESSION HANDLING ---
  useEffect(() => {
    if (session) {
      fetchDashboardData();
    }
  }, [session, fetchDashboardData]);

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push('/employee/auth/login');
    }
  }, [session, sessionLoading, router]);

  useEffect(() => {
    if (!sessionLoading && session && !loading) {
      initialLoadComplete.current = true;
    }
  }, [sessionLoading, session, loading]);


  // --- HELPERS ---
  const getGradientForType = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('sick')) return 'from-red-500 to-pink-600';
    if (n.includes('casual')) return 'from-blue-500 to-cyan-600';
    if (n.includes('earned') || n.includes('privilege')) return 'from-green-500 to-emerald-600';
    if (n.includes('paternity') || n.includes('maternity')) return 'from-purple-500 to-indigo-600';
    return 'from-gray-500 to-slate-600';
  };

  // --- RENDER ---
  if (!initialLoadComplete.current && (sessionLoading || loading)) {
    return (
      <div className="p-8 bg-white rounded-lg shadow-md min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-white rounded-lg shadow-md min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Leave Management</h1>
          <p className="text-gray-600 mt-1">
            Overview for {new Date().getFullYear()}
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchDashboardData} variant="secondary">
            Refresh
          </Button>
          <Link href="/employee/attendance/leave/apply">
            <Button>
              + Apply Leave
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded shadow-sm">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {/* Balance Cards */}
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Your Balances</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {data?.balances && data.balances.length > 0 ? (
          data.balances.map((balance, index) => (
            <motion.div
              key={balance.policy_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`rounded-2xl p-6 text-white shadow-lg bg-gradient-to-br ${getGradientForType(balance.leave_type_name)}`}
            >
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-bold opacity-90">{balance.leave_type_name}</h3>
                <div className="bg-white/20 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              
              <div className="mt-4">
                <span className="text-4xl font-bold">{balance.current_balance}</span>
                <span className="text-sm opacity-80 ml-2">days available</span>
              </div>

              <div className="mt-4 pt-4 border-t border-white/20 flex justify-between text-xs opacity-90 font-medium">
                <div>Accrued: {balance.accrued_this_year}</div>
                <div>Used: {balance.utilized_this_year}</div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full p-8 text-center bg-gray-50 rounded-xl border border-gray-200 text-gray-500">
            No leave balances found. Please contact HR if this is an error.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Stats & Upcoming */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Upcoming Leaves */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Upcoming Leaves
            </h3>
            
            {data?.upcoming_leaves && data.upcoming_leaves.length > 0 ? (
              <div className="space-y-3">
                {data.upcoming_leaves.map((leave) => (
                  <div key={leave.id} className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-800">{leave.leave_type_name}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(leave.start_date).toLocaleDateString()} — {new Date(leave.end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block text-xl font-bold text-blue-600">{leave.duration_days} Days</span>
                      <span className="text-xs text-gray-400">Starts in {leave.days_until_start} days</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm italic py-4">No upcoming leaves scheduled.</p>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                <div className="text-2xl font-bold text-blue-700">{data?.statistics?.total_requests || 0}</div>
                <div className="text-xs text-blue-600 uppercase font-semibold">Total Requests</div>
             </div>
             <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 text-center">
                <div className="text-2xl font-bold text-yellow-700">{data?.statistics?.pending_requests || 0}</div>
                <div className="text-xs text-yellow-600 uppercase font-semibold">Pending</div>
             </div>
             <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-center">
                <div className="text-2xl font-bold text-green-700">{data?.statistics?.approved_requests || 0}</div>
                <div className="text-xs text-green-600 uppercase font-semibold">Approved</div>
             </div>
             <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center">
                <div className="text-2xl font-bold text-red-700">{data?.statistics?.rejected_requests || 0}</div>
                <div className="text-xs text-red-600 uppercase font-semibold">Rejected</div>
             </div>
          </div>

        </div>

        {/* Right Column: Quick Actions & Help */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link href="/employee/attendance/leave/apply" className="block">
                <div className="w-full p-3 text-left bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors font-medium flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Apply for Leave
                </div>
              </Link>

              <Link href="/employee/attendance/leave/history" className="block">
                <div className="w-full p-3 text-left bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors font-medium flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  View Leave History
                </div>
              </Link>

              <Link href="/employee/attendance/leave/ledger" className="block">
                <div className="w-full p-3 text-left bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors font-medium flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Balance Ledger
                </div>
              </Link>

              <Link href="/employee/attendance/holidays" className="block">
                <div className="w-full p-3 text-left bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg transition-colors font-medium flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  View Holidays
                </div>
              </Link>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
             <h4 className="font-semibold text-gray-700 mb-2">Need Help?</h4>
             <p className="text-sm text-gray-500 mb-4">
               If you have discrepancies in your leave balance, please check the ledger or contact HR.
             </p>
             <Link href="/employee/attendance/leave/ledger" className="text-sm text-blue-600 hover:underline font-medium">
               View Balance Ledger &rarr;
             </Link>
          </div>
        </div>
      </div>
    </div>
  );
}