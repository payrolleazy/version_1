'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSessionContext } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Button from '@/components/ui/Button'

// Gateway Configuration
const GATEWAY_CONFIGS = {
  EMPLOYEE_DASHBOARD: 'ams-employee-attendance-dashboard',
  CAPTURE_PUNCH: 'ams-capture-punch-async',
  PUNCH_STATUS: 'ams-get-punch-status',
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

interface DashboardData {
  success: boolean
  today: {
    attendance_date: string
    clock_in_time: string | null
    clock_out_time: string | null
    status: string | null
    duration_minutes: number | null
    late_minutes: number | null
    overtime_minutes: number | null
    can_clock_in: boolean
    can_clock_out: boolean
  }
  weekly_summary: {
    present_days: number
    absent_days: number
    leave_days: number
    late_days: number
    total_work_hours: number
    total_overtime_hours: number
  }
  monthly_summary: {
    present_days: number
    absent_days: number
    leave_days: number
    missed_punch_days: number
    total_work_hours: number
  }
  pending_regularizations: number
}

interface PunchEvent {
  event_id: number
  idempotency_key: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT'
}

export default function AttendanceDashboard() {
  const { session, isLoading: sessionLoading } = useSessionContext()
  const router = useRouter()

  // Track if initial load has completed to prevent UI unmounting on session refresh
  const initialLoadComplete = useRef(false)

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [punchLoading, setPunchLoading] = useState(false)
  const [punchEvent, setPunchEvent] = useState<PunchEvent | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    if (!session?.access_token) return

    setLoading(true)
    setError(null)

    try {
      const result = await callGateway('/api/a_crud_universal_pg_function_gateway', {
        config_id: GATEWAY_CONFIGS.EMPLOYEE_DASHBOARD,
        params: {}
      }, session.access_token)

      setDashboardData(result.data || result)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  // Get current location
  const getCurrentLocation = useCallback(() => {
    setLocationLoading(true)

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      setLocationLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        })
        setLocationLoading(false)
      },
      (err) => {
        setError(`Location error: ${err.message}`)
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }, [])

  // Handle punch IN/OUT
  const handlePunch = async (punchType: 'IN' | 'OUT') => {
    if (!session?.access_token || !currentLocation) {
      setError('Please enable location access to punch')
      return
    }

    setPunchLoading(true)
    setError(null)

    const idempotencyKey = `${session.user.id}-${new Date().toISOString()}-${punchType}`

try {
  const result = await callGateway('/api/a_crud_universal_pg_function_gateway', {
    config_id: GATEWAY_CONFIGS.CAPTURE_PUNCH,
    params: {
      // --- FIX START: Map 'IN'/'OUT' to DB enum 'CLOCK_IN'/'CLOCK_OUT' ---
      punch_type: punchType === 'IN' ? 'CLOCK_IN' : 'CLOCK_OUT',
      // --- FIX END ---
      latitude: currentLocation.lat,
      longitude: currentLocation.lng,
      accuracy: currentLocation.accuracy,
      address: '', // Will be geocoded by backend
      ip_address: '', // Will be captured by backend
      device_info: {
        userAgent: navigator.userAgent,
        platform: navigator.platform
      },
      idempotency_key: idempotencyKey
    }
  }, session.access_token)




      setPunchEvent({
        event_id: result.data?.event_id || result.event_id,
        idempotency_key: idempotencyKey,
        status: 'PENDING'
      })

      // Poll for status
      pollPunchStatus(result.data?.event_id || result.event_id, idempotencyKey)

    } catch (err: any) {
      setError(err.message)
      setPunchLoading(false)
    }
  }

  // Poll punch status
  const pollPunchStatus = async (eventId: number, idempotencyKey: string) => {
    const maxAttempts = 30 // Increased for async processing (up to 60 seconds)
    let attempts = 0

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setPunchLoading(false)
        setPunchEvent(prev => prev ? { ...prev, status: 'TIMEOUT' } : null)
        setError('Punch processing timeout. Please check your attendance history.')
        return
      }

      attempts++

      try {
        const result = await callGateway('/api/a_crud_universal_pg_function_gateway', {
          config_id: GATEWAY_CONFIGS.PUNCH_STATUS,
          params: {
            event_id: eventId,
            idempotency_key: idempotencyKey
          }
        }, session?.access_token || '')

        const status = result.data?.status || result.status

        if (status === 'COMPLETED') {
          setPunchEvent(prev => prev ? { ...prev, status: 'COMPLETED' } : null)
          setPunchLoading(false)
          fetchDashboard() // Refresh dashboard
        } else if (status === 'FAILED') {
          setPunchEvent(prev => prev ? { ...prev, status: 'FAILED' } : null)
          setError(result.data?.error_message || 'Punch processing failed')
          setPunchLoading(false)
        } else if (status === 'PROCESSING') {
          // Update UI to show processing state
          setPunchEvent(prev => prev ? { ...prev, status: 'PROCESSING' } : null)
          setTimeout(poll, 2000) // Poll every 2 seconds
        } else {
          // PENDING - still waiting for worker to pick it up
          setTimeout(poll, 2000)
        }
      } catch (err) {
        // Network error, retry
        setTimeout(poll, 2000)
      }
    }

    poll()
  }

  useEffect(() => {
    if (session) {
      fetchDashboard()
      getCurrentLocation()
    }
  }, [session, fetchDashboard, getCurrentLocation])

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

  const todayStatus = dashboardData?.today
  const isPunchedIn = todayStatus?.clock_in_time && !todayStatus?.clock_out_time
  const isPunchedOut = todayStatus?.clock_in_time && todayStatus?.clock_out_time

  return (
    <div className="p-8 bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Attendance Dashboard</h1>
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
          <button onClick={() => setError(null)} className="ml-4 text-red-800 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Punch Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-8 text-white mb-8 shadow-xl"
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="text-purple-200 text-sm uppercase tracking-wider mb-2">Today&apos;s Status</p>
            <h2 className="text-4xl font-bold mb-4">
              {isPunchedOut ? 'Day Complete' : isPunchedIn ? 'Working' : 'Not Punched In'}
            </h2>
            {todayStatus?.clock_in_time && (
              <div className="space-y-1">
                <p className="text-purple-100">
                  <span className="text-purple-300">Clock In:</span> {new Date(todayStatus.clock_in_time).toLocaleTimeString()}
                </p>
                {todayStatus.clock_out_time && (
                  <p className="text-purple-100">
                    <span className="text-purple-300">Clock Out:</span> {new Date(todayStatus.clock_out_time).toLocaleTimeString()}
                  </p>
                )}
                {todayStatus.duration_minutes && (
                  <p className="text-purple-100">
                    <span className="text-purple-300">Duration:</span> {Math.floor(todayStatus.duration_minutes / 60)}h {todayStatus.duration_minutes % 60}m
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="text-center">
            {!isPunchedOut && (
              <>
                {locationLoading ? (
                  <p className="text-purple-200 text-sm mb-2">Getting location...</p>
                ) : currentLocation ? (
                  <p className="text-green-300 text-sm mb-2">Location ready</p>
                ) : (
                  <button
                    onClick={getCurrentLocation}
                    className="text-purple-200 text-sm mb-2 hover:underline"
                  >
                    Enable location
                  </button>
                )}
                <Button
                  onClick={() => handlePunch(isPunchedIn ? 'OUT' : 'IN')}
                  disabled={punchLoading || !currentLocation}
                  className="bg-white text-purple-700 hover:bg-purple-50 px-8 py-4 text-lg font-bold rounded-xl shadow-lg"
                >
                  {punchLoading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    `Punch ${isPunchedIn ? 'OUT' : 'IN'}`
                  )}
                </Button>
              </>
            )}
            {isPunchedOut && (
              <div className="bg-green-500 text-white px-6 py-3 rounded-xl">
                Day Completed
              </div>
            )}
          </div>
        </div>

        {punchEvent && (
          <div className={`mt-4 p-3 rounded-lg ${
            punchEvent.status === 'COMPLETED' ? 'bg-green-500/20' :
            punchEvent.status === 'FAILED' ? 'bg-red-500/20' :
            punchEvent.status === 'TIMEOUT' ? 'bg-red-500/20' :
            punchEvent.status === 'PROCESSING' ? 'bg-blue-500/20' :
            'bg-yellow-500/20'
          }`}>
            <p className="text-sm">
              Punch Status: <span className="font-bold">
                {punchEvent.status === 'PENDING' ? 'Queued for Processing' :
                 punchEvent.status === 'PROCESSING' ? 'Processing...' :
                 punchEvent.status === 'COMPLETED' ? 'Completed Successfully' :
                 punchEvent.status === 'FAILED' ? 'Failed' :
                 punchEvent.status === 'TIMEOUT' ? 'Timeout - Check History' :
                 punchEvent.status}
              </span>
            </p>
          </div>
        )}
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Weekly Present */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-green-50 border border-green-200 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">This Week</p>
              <p className="text-3xl font-bold text-green-700">{dashboardData?.weekly_summary?.present_days || 0}</p>
              <p className="text-green-600 text-sm">Present Days</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </motion.div>

        {/* Weekly Hours */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-blue-50 border border-blue-200 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium">This Week</p>
              <p className="text-3xl font-bold text-blue-700">{dashboardData?.weekly_summary?.total_work_hours?.toFixed(1) || 0}</p>
              <p className="text-blue-600 text-sm">Hours Worked</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </motion.div>

        {/* Monthly Present */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-purple-50 border border-purple-200 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 text-sm font-medium">This Month</p>
              <p className="text-3xl font-bold text-purple-700">{dashboardData?.monthly_summary?.present_days || 0}</p>
              <p className="text-purple-600 text-sm">Present Days</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </motion.div>

        {/* Late Days */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-orange-50 border border-orange-200 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-600 text-sm font-medium">This Month</p>
              <p className="text-3xl font-bold text-orange-700">{dashboardData?.monthly_summary?.late_days || 0}</p>
              <p className="text-orange-600 text-sm">Late Days</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <svg className="w-8 h-8 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.a
          href="/employee/attendance/history"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gray-50 border border-gray-200 rounded-xl p-6 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-2">View History</h3>
          <p className="text-gray-600 text-sm">Check your complete attendance records</p>
        </motion.a>

        <motion.a
          href="/employee/attendance/regularization/apply"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gray-50 border border-gray-200 rounded-xl p-6 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Apply Regularization</h3>
          <p className="text-gray-600 text-sm">Request correction for missed punches</p>
        </motion.a>

        <motion.a
          href="/employee/attendance/regularization/requests"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-gray-50 border border-gray-200 rounded-xl p-6 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-2">My Requests</h3>
          <p className="text-gray-600 text-sm">Track your regularization requests</p>
        </motion.a>
      </div>
    </div>
  )
}
