'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSessionContext } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Button from '@/components/ui/Button'

// Read Config
const READ_CONFIG = '7bf79f00-4b53-4aa0-a1bd-b9198abc2baa'

// Helper function for API calls
async function callReadAPI(payload: any, token: string) {
  const response = await fetch('/api/a_crud_universal_read', {
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

interface AttendanceRecord {
  id: string
  attendance_date: string
  clock_in_time: string | null
  clock_out_time: string | null
  status_final: string
  duration_minutes: number | null
  late_minutes: number | null
  early_leaving_minutes: number | null
  overtime_minutes: number | null
  clock_in_address: string | null
  clock_out_address: string | null
  is_holiday: boolean
  holiday_name: string | null
}

const STATUS_STYLES: Record<string, string> = {
  'PRESENT': 'bg-green-100 text-green-800',
  'ABSENT': 'bg-red-100 text-red-800',
  'HALF_DAY': 'bg-yellow-100 text-yellow-800',
  'LATE': 'bg-orange-100 text-orange-800',
  'ON_LEAVE': 'bg-blue-100 text-blue-800',
  'HOLIDAY': 'bg-purple-100 text-purple-800',
  'WEEKEND': 'bg-gray-100 text-gray-800',
}

export default function AttendanceHistory() {
  const { session, isLoading: sessionLoading } = useSessionContext()
  const router = useRouter()

  // Track if initial load has completed to prevent UI unmounting on session refresh
  const initialLoadComplete = useRef(false)

  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 20

  // Fetch attendance records
  const fetchRecords = useCallback(async () => {
    if (!session?.access_token) return

    setLoading(true)
    setError(null)

    try {
      const filters: any[] = [
        { column: 'attendance_date', operator: 'gte', value: startDate },
        { column: 'attendance_date', operator: 'lte', value: endDate }
      ]

      if (statusFilter !== 'ALL') {
        filters.push({ column: 'status_final', operator: 'eq', value: statusFilter })
      }

      const result = await callReadAPI({
        config_id: READ_CONFIG,
        filters,
        sort: [{ column: 'attendance_date', order: 'desc' }],
        page: currentPage,
        page_size: pageSize
      }, session.access_token)

      setRecords(result.data || [])
      setTotalCount(result.total_count || result.data?.length || 0)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [session?.access_token, startDate, endDate, statusFilter, currentPage])

  useEffect(() => {
    if (session) {
      fetchRecords()
    }
  }, [session, fetchRecords])

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

  const formatTime = (time: string | null) => {
    if (!time) return '-'
    return new Date(time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  // Only show full-page loading on initial load, not on session refresh
  if (!initialLoadComplete.current && sessionLoading) {
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

  return (
    <div className="p-8 bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Attendance History</h1>
          <p className="text-gray-600 mt-1">View your complete attendance records</p>
        </div>
        <a href="/employee/attendance">
          <Button variant="secondary">← Back to Dashboard</Button>
        </a>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="ALL">All Status</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="LATE">Late</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="HOLIDAY">Holiday</option>
              <option value="WEEKEND">Weekend</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={fetchRecords} className="w-full">
              Apply Filters
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Records Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="overflow-x-auto"
      >
        <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Date</th>
              <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Status</th>
              <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Clock In</th>
              <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Clock Out</th>
              <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Duration</th>
              <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Late</th>
              <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Overtime</th>
              <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-gray-500">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  </div>
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-gray-500">
                  No attendance records found for the selected period
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm text-gray-900">
                    {new Date(record.attendance_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${STATUS_STYLES[record.status_final] || 'bg-gray-100 text-gray-800'}`}>
                      {record.status_final?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{formatTime(record.clock_in_time)}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{formatTime(record.clock_out_time)}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{formatDuration(record.duration_minutes)}</td>
                  <td className="py-3 px-4 text-sm">
                    {record.late_minutes && record.late_minutes > 0 ? (
                      <span className="text-orange-600">{record.late_minutes}m</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {record.overtime_minutes && record.overtime_minutes > 0 ? (
                      <span className="text-green-600">+{record.overtime_minutes}m</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {record.is_holiday && record.holiday_name ? (
                      <span className="text-purple-600">{record.holiday_name}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-6">
          <p className="text-sm text-gray-600">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} records
          </p>
          <div className="flex space-x-2">
            <Button
              variant="secondary"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="px-4 py-2 text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="secondary"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
