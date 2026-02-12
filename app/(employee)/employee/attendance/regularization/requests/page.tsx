'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSessionContext } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Button from '@/components/ui/Button'

// Gateway Configuration
const GATEWAY_CONFIGS = {
  MY_REQUESTS: 'ams-my-regularization-requests',
  CANCEL_REQUEST: 'ams-cancel-regularization',
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

interface RegularizationRequest {
  id: string
  attendance_record_id: string
  attendance_date: string
  request_type: string
  requested_clock_in: string | null
  requested_clock_out: string | null
  reason: string
  status: string
  reviewer_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  'PENDING': 'bg-yellow-100 text-yellow-800',
  'APPROVED': 'bg-green-100 text-green-800',
  'REJECTED': 'bg-red-100 text-red-800',
  'CANCELLED': 'bg-gray-100 text-gray-800',
}

export default function MyRegularizationRequests() {
  const { session, isLoading: sessionLoading } = useSessionContext()
  const router = useRouter()

  // Track if initial load has completed to prevent UI unmounting on session refresh
  const initialLoadComplete = useRef(false)

  const [requests, setRequests] = useState<RegularizationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Filter
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  // Cancel modal
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)

  // Fetch requests
  const fetchRequests = useCallback(async () => {
    if (!session?.access_token) return

    setLoading(true)
    setError(null)

    try {
      const params: any = {}
      if (statusFilter !== 'ALL') {
        params.status = statusFilter
      }

      const result = await callGateway('/api/a_crud_universal_pg_function_gateway', {
        config_id: GATEWAY_CONFIGS.MY_REQUESTS,
        params
      }, session.access_token)

      setRequests(result.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [session?.access_token, statusFilter])

  // Handle cancel request
  const handleCancelRequest = async () => {
    if (!session?.access_token || !cancellingId) return

    setCancelLoading(true)
    setError(null)

    try {
      await callGateway('/api/a_crud_universal_pg_function_gateway', {
        config_id: GATEWAY_CONFIGS.CANCEL_REQUEST,
        params: {
          request_id: cancellingId
        }
      }, session.access_token)

      setSuccess('Request cancelled successfully')
      setShowCancelModal(false)
      setCancellingId(null)
      fetchRequests()

    } catch (err: any) {
      setError(err.message)
    } finally {
      setCancelLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      fetchRequests()
    }
  }, [session, fetchRequests])

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

  const formatDateTime = (datetime: string | null) => {
    if (!datetime) return '-'
    return new Date(datetime).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'MISSING_IN': return 'Missing Clock-In'
      case 'MISSING_OUT': return 'Missing Clock-Out'
      case 'INCOMPLETE': return 'Incomplete Record'
      default: return type
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

  // Stats
  const pendingCount = requests.filter(r => r.status === 'PENDING').length
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length
  const rejectedCount = requests.filter(r => r.status === 'REJECTED').length

  return (
    <div className="p-8 bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">My Regularization Requests</h1>
          <p className="text-gray-600 mt-1">Track the status of your regularization requests</p>
        </div>
        <div className="flex space-x-4">
          <a href="/employee/attendance/regularization/apply">
            <Button>+ New Request</Button>
          </a>
          <a href="/employee/attendance">
            <Button variant="secondary">← Dashboard</Button>
          </a>
        </div>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-50 border border-yellow-200 rounded-xl p-6"
        >
          <p className="text-yellow-600 text-sm font-medium">Pending</p>
          <p className="text-3xl font-bold text-yellow-700">{pendingCount}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-green-50 border border-green-200 rounded-xl p-6"
        >
          <p className="text-green-600 text-sm font-medium">Approved</p>
          <p className="text-3xl font-bold text-green-700">{approvedCount}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-red-50 border border-red-200 rounded-xl p-6"
        >
          <p className="text-red-600 text-sm font-medium">Rejected</p>
          <p className="text-3xl font-bold text-red-700">{rejectedCount}</p>
        </motion.div>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <div className="flex space-x-2">
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 text-lg">No regularization requests found</p>
            <a href="/employee/attendance/regularization/apply" className="text-purple-600 hover:underline mt-2 inline-block">
              Submit a new request
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="border border-gray-200 rounded-xl p-6 hover:border-gray-300 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-semibold text-gray-800">
                        {new Date(request.attendance_date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </h3>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${STATUS_STYLES[request.status] || 'bg-gray-100 text-gray-800'}`}>
                        {request.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Request Type</p>
                        <p className="text-gray-800">{getRequestTypeLabel(request.request_type)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Requested In</p>
                        <p className="text-gray-800">{formatTime(request.requested_clock_in)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Requested Out</p>
                        <p className="text-gray-800">{formatTime(request.requested_clock_out)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Submitted</p>
                        <p className="text-gray-800">{formatDateTime(request.created_at)}</p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-gray-500 text-sm">Reason</p>
                      <p className="text-gray-700 text-sm">{request.reason}</p>
                    </div>

                    {request.reviewer_notes && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-500 text-sm">Reviewer Notes</p>
                        <p className="text-gray-700 text-sm">{request.reviewer_notes}</p>
                        {request.reviewed_at && (
                          <p className="text-gray-400 text-xs mt-1">
                            Reviewed on {formatDateTime(request.reviewed_at)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {request.status === 'PENDING' && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setCancellingId(request.id)
                        setShowCancelModal(true)
                      }}
                      className="ml-4 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowCancelModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Cancel Request?</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to cancel this regularization request? This action cannot be undone.
              </p>
              <div className="flex space-x-4">
                <Button
                  variant="secondary"
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1"
                >
                  Keep Request
                </Button>
                <Button
                  onClick={handleCancelRequest}
                  disabled={cancelLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {cancelLoading ? 'Cancelling...' : 'Yes, Cancel'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
