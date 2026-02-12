'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSessionContext } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Button from '@/components/ui/Button'

// Read Config
const READ_CONFIG = 'e3a55088-d0b8-4dc0-8211-fe9ab75bde69'

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

interface Holiday {
  id: string
  name: string
  holiday_date: string
  applies_to_shift_ids: string[] | null
  is_optional: boolean
}

export default function HolidayCalendar() {
  const { session, isLoading: sessionLoading } = useSessionContext()
  const router = useRouter()

  // Track if initial load has completed to prevent UI unmounting on session refresh
  const initialLoadComplete = useRef(false)

  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Year filter
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)

  // Fetch holidays
  const fetchHolidays = useCallback(async () => {
    if (!session?.access_token) return

    setLoading(true)
    setError(null)

    try {
      const startDate = `${selectedYear}-01-01`
      const endDate = `${selectedYear}-12-31`

      const result = await callReadAPI({
        config_id: READ_CONFIG,
        filters: [
          { column: 'holiday_date', operator: 'gte', value: startDate },
          { column: 'holiday_date', operator: 'lte', value: endDate }
        ],
        sort: [{ column: 'holiday_date', order: 'asc' }],
        page: 1,
        page_size: 100
      }, session.access_token)

      setHolidays(result.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [session?.access_token, selectedYear])

  useEffect(() => {
    if (session) {
      fetchHolidays()
    }
  }, [session, fetchHolidays])

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

  // Group holidays by month
  const holidaysByMonth = holidays.reduce((acc, holiday) => {
    const month = new Date(holiday.holiday_date).getMonth()
    if (!acc[month]) acc[month] = []
    acc[month].push(holiday)
    return acc
  }, {} as Record<number, Holiday[]>)

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  // Stats
  const totalHolidays = holidays.length
  const optionalHolidays = holidays.filter(h => h.is_optional).length
  const upcomingHolidays = holidays.filter(h => new Date(h.holiday_date) >= new Date()).length

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
          <h1 className="text-3xl font-bold text-gray-800">Holiday Calendar</h1>
          <p className="text-gray-600 mt-1">View company holidays for the year</p>
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

      {/* Year Selector & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/* Year Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-purple-50 border border-purple-200 rounded-xl p-6"
        >
          <p className="text-purple-600 text-sm font-medium mb-2">Select Year</p>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </motion.div>

        {/* Total Holidays */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-green-50 border border-green-200 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">Total Holidays</p>
              <p className="text-3xl font-bold text-green-700">{totalHolidays}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </motion.div>

        {/* Optional Holidays */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-blue-50 border border-blue-200 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium">Optional</p>
              <p className="text-3xl font-bold text-blue-700">{optionalHolidays}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </motion.div>

        {/* Upcoming */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-orange-50 border border-orange-200 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-600 text-sm font-medium">Upcoming</p>
              <p className="text-3xl font-bold text-orange-700">{upcomingHolidays}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Holiday List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
          </div>
        ) : holidays.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500 text-lg">No holidays found for {selectedYear}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {monthNames.map((monthName, monthIndex) => {
              const monthHolidays = holidaysByMonth[monthIndex] || []
              if (monthHolidays.length === 0) return null

              return (
                <div key={monthIndex} className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm mr-2">
                      {monthHolidays.length}
                    </span>
                    {monthName}
                  </h3>
                  <div className="space-y-3">
                    {monthHolidays.map((holiday) => {
                      const holidayDate = new Date(holiday.holiday_date)
                      const isPast = holidayDate < new Date()

                      return (
                        <div
                          key={holiday.id}
                          className={`flex items-start p-3 rounded-lg border ${
                            isPast
                              ? 'bg-gray-100 border-gray-200'
                              : 'bg-white border-gray-200 hover:border-purple-300'
                          }`}
                        >
                          <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center ${
                            isPast ? 'bg-gray-200' : 'bg-purple-100'
                          }`}>
                            <span className={`text-lg font-bold ${isPast ? 'text-gray-500' : 'text-purple-700'}`}>
                              {holidayDate.getDate()}
                            </span>
                            <span className={`text-xs ${isPast ? 'text-gray-400' : 'text-purple-500'}`}>
                              {holidayDate.toLocaleDateString('en-US', { weekday: 'short' })}
                            </span>
                          </div>
                          <div className="ml-3 flex-1">
                            <p className={`font-medium ${isPast ? 'text-gray-500' : 'text-gray-800'}`}>
                              {holiday.name}
                            </p>
                            {holiday.is_optional && (
                              <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                                Optional
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>
    </div>
  )
}
