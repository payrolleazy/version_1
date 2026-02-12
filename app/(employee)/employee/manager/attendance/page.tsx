'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSessionContext } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Button from '@/components/ui/Button'

// Gateway Configuration
const GATEWAY_CONFIGS = {
  MANAGER_DASHBOARD: 'ams-manager-dashboard',
}

// Helper function for API calls
async function callGateway(endpoint: string, payload: any, token: string) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ ...payload, accessToken: token }),
  });
  const result = await response.json();
  if (!response.ok || (result.hasOwnProperty('success') && !result.success)) {
    throw new Error(result.message || result.error || 'API Request Failed');
  }
  return result;
}

interface TeamSummary {
  total_team_members: number
  today: {
    present: number
    absent: number
    late: number
    on_leave: number
    not_punched: number
  }
  weekly: {
    avg_attendance_rate: number
    total_late_instances: number
    total_overtime_hours: number
  }
  monthly: {
    avg_attendance_rate: number
    total_regularization_requests: number
    pending_approvals: number
  }
  recent_punches: Array<{
    employee_name: string
    employee_id: string
    punch_time: string
    punch_type: string
    status: string
  }>
}

export default function ManagerAttendanceDashboard() {
  const { session, isLoading: sessionLoading } = useSessionContext()
  const router = useRouter()

  // Track if initial load has completed to prevent UI unmounting on session refresh
  const initialLoadComplete = useRef(false)

  const [dashboardData, setDashboardData] = useState<TeamSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    if (!session?.access_token) return

    setLoading(true)
    setError(null)

    try {
      const result = await callGateway('/api/a_crud_universal_pg_function_gateway', {
        config_id: GATEWAY_CONFIGS.MANAGER_DASHBOARD,
        params: {}
      }, session.access_token)

      setDashboardData(result.data || result)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  useEffect(() => {
    if (session) {
      fetchDashboard()
    }
  }, [session, fetchDashboard])

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push('/employee/auth/login')
    }
  }, [session, sessionLoading, router])

  // Mark initial load as complete once we have session and data
  useEffect(() => {
    if (!sessionLoading && session && !loading) {
      initialLoadComplete.current = true
    }
  }, [sessionLoading, session, loading])

  // Only show full-page loading on initial load, not on session refresh
  if (!initialLoadComplete.current && (sessionLoading || loading)) {
    return (
      <div className="p-8 bg-white rounded-lg shadow-md min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  // If session is lost after initial load, redirect
  if (initialLoadComplete.current && !sessionLoading && !session) {
    router.push('/employee/auth/login')
    return null
  }

  const today = dashboardData?.today
  const weekly = dashboardData?.weekly
  const monthly = dashboardData?.monthly

  return (
    <div className="p-8 bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Team Attendance Dashboard</h1>
          <p className="text-gray-600 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Button onClick={fetchDashboard} variant="secondary">
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Today's Overview Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-8 text-white mb-8 shadow-xl"
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="text-indigo-200 text-sm uppercase tracking-wider mb-2">Today&apos;s Status</p>
            <h2 className="text-4xl font-bold mb-2">{dashboardData?.total_team_members || 0}</h2>
            <p className="text-indigo-200">Total Team Members</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-300">{today?.present || 0}</p>
              <p className="text-indigo-200 text-sm">Present</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-300">{today?.absent || 0}</p>
              <p className="text-indigo-200 text-sm">Absent</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-300">{today?.late || 0}</p>
              <p className="text-indigo-200 text-sm">Late</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-300">{today?.on_leave || 0}</p>
              <p className="text-indigo-200 text-sm">On Leave</p>
            </div>
          </div>
        </div>

        {today?.not_punched && today.not_punched > 0 && (
          <div className="mt-6 p-4 bg-white/10 rounded-xl">
            <p className="text-yellow-200">
              <span className="font-bold">{today.not_punched}</span> team members have not punched in yet
            </p>
          </div>
        )}
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Weekly Attendance Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-green-50 border border-green-200 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">Weekly Attendance</p>
              <p className="text-3xl font-bold text-green-700">{weekly?.avg_attendance_rate?.toFixed(1) || 0}%</p>
              <p className="text-green-600 text-sm">Average Rate</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </motion.div>

        {/* Weekly Late Instances */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-orange-50 border border-orange-200 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-600 text-sm font-medium">This Week</p>
              <p className="text-3xl font-bold text-orange-700">{weekly?.total_late_instances || 0}</p>
              <p className="text-orange-600 text-sm">Late Instances</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <svg className="w-8 h-8 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </motion.div>

        {/* Monthly Attendance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-purple-50 border border-purple-200 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 text-sm font-medium">Monthly Attendance</p>
              <p className="text-3xl font-bold text-purple-700">{monthly?.avg_attendance_rate?.toFixed(1) || 0}%</p>
              <p className="text-purple-600 text-sm">Average Rate</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </motion.div>

        {/* Pending Approvals */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className={`border rounded-xl p-6 ${monthly?.pending_approvals && monthly.pending_approvals > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${monthly?.pending_approvals && monthly.pending_approvals > 0 ? 'text-red-600' : 'text-gray-600'}`}>Pending</p>
              <p className={`text-3xl font-bold ${monthly?.pending_approvals && monthly.pending_approvals > 0 ? 'text-red-700' : 'text-gray-700'}`}>{monthly?.pending_approvals || 0}</p>
              <p className={`text-sm ${monthly?.pending_approvals && monthly.pending_approvals > 0 ? 'text-red-600' : 'text-gray-600'}`}>Approvals</p>
            </div>
            <div className={`p-3 rounded-full ${monthly?.pending_approvals && monthly.pending_approvals > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
              <svg className={`w-8 h-8 ${monthly?.pending_approvals && monthly.pending_approvals > 0 ? 'text-red-600' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Punches */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gray-50 border border-gray-200 rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Team Activity</h3>
          {dashboardData?.recent_punches && dashboardData.recent_punches.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {dashboardData.recent_punches.map((punch, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${punch.punch_type === 'IN' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <div>
                      <p className="font-medium text-gray-800">{punch.employee_name}</p>
                      <p className="text-sm text-gray-500">{punch.punch_type === 'IN' ? 'Clocked In' : 'Clocked Out'}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {new Date(punch.punch_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No recent activity</p>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-4"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>

          <a
            href="/employee/manager/attendance/records"
            className="block bg-blue-50 border border-blue-200 rounded-xl p-6 hover:bg-blue-100 transition-colors"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-blue-100 p-3 rounded-full">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">View Team Records</h4>
                <p className="text-sm text-gray-600">See detailed attendance records for your team</p>
              </div>
            </div>
          </a>

          <a
            href="/employee/manager/attendance/approvals"
            className={`block border rounded-xl p-6 transition-colors ${
              monthly?.pending_approvals && monthly.pending_approvals > 0
                ? 'bg-red-50 border-red-200 hover:bg-red-100'
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-full ${monthly?.pending_approvals && monthly.pending_approvals > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <svg className={`w-6 h-6 ${monthly?.pending_approvals && monthly.pending_approvals > 0 ? 'text-red-600' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">
                  Regularization Approvals
                  {monthly?.pending_approvals && monthly.pending_approvals > 0 && (
                    <span className="ml-2 px-2 py-1 text-xs bg-red-500 text-white rounded-full">
                      {monthly.pending_approvals}
                    </span>
                  )}
                </h4>
                <p className="text-sm text-gray-600">Review and approve team regularization requests</p>
              </div>
            </div>
          </a>
        </motion.div>
      </div>
    </div>
  )
}
