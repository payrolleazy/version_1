'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSessionContext } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Button from '@/components/ui/Button'

// Gateway Configuration
const GATEWAY_CONFIGS = {
  RECORDS_FOR_REGULARIZATION: 'ams-records-for-regularization',
  SUBMIT_REGULARIZATION: 'ams-submit-regularization',
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

interface EligibleRecord {
  id: string
  attendance_date: string
  clock_in_time: string | null
  clock_out_time: string | null
  status_final: string
  duration_minutes: number | null
  issue_type: string // 'MISSING_IN' | 'MISSING_OUT' | 'INCOMPLETE'
}

interface FormData {
  attendance_record_id: string
  request_type: string
  requested_clock_in: string
  requested_clock_out: string
  reason: string
}

export default function ApplyRegularization() {
  const { session, isLoading: sessionLoading } = useSessionContext()
  const router = useRouter()

  // Track if initial load has completed to prevent UI unmounting on session refresh
  const initialLoadComplete = useRef(false)

  const [eligibleRecords, setEligibleRecords] = useState<EligibleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Selected record for regularization
  const [selectedRecord, setSelectedRecord] = useState<EligibleRecord | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Form data
  const [formData, setFormData] = useState<FormData>({
    attendance_record_id: '',
    request_type: '',
    requested_clock_in: '',
    requested_clock_out: '',
    reason: ''
  })

  // Fetch eligible records
  const fetchEligibleRecords = useCallback(async () => {
    if (!session?.access_token) return

    setLoading(true)
    setError(null)

    try {
      const result = await callGateway('/api/a_crud_universal_pg_function_gateway', {
        config_id: GATEWAY_CONFIGS.RECORDS_FOR_REGULARIZATION,
        params: {
          days_lookback: 30 // Last 30 days
        }
      }, session.access_token)

      setEligibleRecords(result.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  // Handle record selection
  const handleSelectRecord = (record: EligibleRecord) => {
    setSelectedRecord(record)
    setFormData({
      attendance_record_id: record.id,
      request_type: record.issue_type,
      requested_clock_in: record.clock_in_time ? new Date(record.clock_in_time).toTimeString().slice(0, 5) : '',
      requested_clock_out: record.clock_out_time ? new Date(record.clock_out_time).toTimeString().slice(0, 5) : '',
      reason: ''
    })
    setShowForm(true)
    setError(null)
    setSuccess(null)
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!session?.access_token || !selectedRecord) return

    // Validation
    if (!formData.reason.trim()) {
      setError('Please provide a reason for regularization')
      return
    }

    if (formData.request_type === 'MISSING_IN' && !formData.requested_clock_in) {
      setError('Please provide the clock-in time')
      return
    }

    if (formData.request_type === 'MISSING_OUT' && !formData.requested_clock_out) {
      setError('Please provide the clock-out time')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // Build the time strings with date
      const dateStr = selectedRecord.attendance_date
      const clockInTime = formData.requested_clock_in ? `${dateStr}T${formData.requested_clock_in}:00` : null
      const clockOutTime = formData.requested_clock_out ? `${dateStr}T${formData.requested_clock_out}:00` : null

      await callGateway('/api/a_crud_universal_pg_function_gateway', {
        config_id: GATEWAY_CONFIGS.SUBMIT_REGULARIZATION,
        params: {
          attendance_record_id: formData.attendance_record_id,
          request_type: formData.request_type,
          requested_clock_in: clockInTime,
          requested_clock_out: clockOutTime,
          reason: formData.reason
        }
      }, session.access_token)

      setSuccess('Regularization request submitted successfully!')
      setShowForm(false)
      setSelectedRecord(null)
      fetchEligibleRecords() // Refresh the list

    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (session) {
      fetchEligibleRecords()
    }
  }, [session, fetchEligibleRecords])

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

  const getIssueLabel = (issueType: string) => {
    switch (issueType) {
      case 'MISSING_IN': return 'Missing Clock-In'
      case 'MISSING_OUT': return 'Missing Clock-Out'
      case 'INCOMPLETE': return 'Incomplete Record'
      default: return issueType
    }
  }

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
          <h1 className="text-3xl font-bold text-gray-800">Apply Regularization</h1>
          <p className="text-gray-600 mt-1">Request corrections for attendance records with issues</p>
        </div>
        <a href="/employee/attendance">
          <Button variant="secondary">← Back to Dashboard</Button>
        </a>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-4 text-red-800 hover:underline">Dismiss</button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-4 text-green-800 hover:underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Eligible Records */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Records Eligible for Regularization</h2>
          <p className="text-sm text-gray-600 mb-4">Select a record to apply for regularization</p>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : eligibleRecords.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-600">No records require regularization</p>
              <p className="text-sm text-gray-500 mt-1">All your attendance records are complete</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {eligibleRecords.map((record) => (
                <div
                  key={record.id}
                  onClick={() => handleSelectRecord(record)}
                  className={`border rounded-xl p-4 cursor-pointer transition-all ${
                    selectedRecord?.id === record.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-800">
                        {new Date(record.attendance_date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                      <div className="mt-2 text-sm text-gray-600">
                        <p>Clock In: {formatTime(record.clock_in_time)}</p>
                        <p>Clock Out: {formatTime(record.clock_out_time)}</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                      {getIssueLabel(record.issue_type)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Regularization Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {showForm && selectedRecord ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Submit Regularization Request</h2>
              <p className="text-sm text-gray-600 mb-6">
                For: {new Date(selectedRecord.attendance_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Request Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Issue Type</label>
                  <input
                    type="text"
                    value={getIssueLabel(formData.request_type)}
                    disabled
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600"
                  />
                </div>

                {/* Clock In Time */}
                {(formData.request_type === 'MISSING_IN' || formData.request_type === 'INCOMPLETE') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Requested Clock-In Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={formData.requested_clock_in}
                      onChange={(e) => setFormData({ ...formData, requested_clock_in: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required={formData.request_type === 'MISSING_IN'}
                    />
                  </div>
                )}

                {/* Clock Out Time */}
                {(formData.request_type === 'MISSING_OUT' || formData.request_type === 'INCOMPLETE') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Requested Clock-Out Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={formData.requested_clock_out}
                      onChange={(e) => setFormData({ ...formData, requested_clock_out: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required={formData.request_type === 'MISSING_OUT'}
                    />
                  </div>
                )}

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    rows={4}
                    placeholder="Please explain why you need this regularization..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    required
                  />
                </div>

                {/* Actions */}
                <div className="flex space-x-4">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1"
                  >
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => { setShowForm(false); setSelectedRecord(null); }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center h-full flex flex-col items-center justify-center">
              <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <p className="text-gray-500 text-lg">Select a record to apply for regularization</p>
              <p className="text-gray-400 text-sm mt-2">Click on any record from the left panel</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
