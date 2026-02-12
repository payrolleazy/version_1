'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSessionContext } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Button from '@/components/ui/Button'

// Gateway Configuration
const GATEWAY_CONFIGS = {
  PENDING_REGULARIZATIONS: 'ams-pending-regularizations',
  PROCESS_REGULARIZATION: 'ams-process-regularization',
  BULK_REGULARIZATION: 'ams-bulk-regularization',
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
  employee_name: string
  employee_code: string
  employee_id: string
  attendance_date: string
  request_type: string
  requested_clock_in: string | null
  requested_clock_out: string | null
  reason: string
  status: string
  created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  'PENDING': 'bg-yellow-100 text-yellow-800',
  'APPROVED': 'bg-green-100 text-green-800',
  'REJECTED': 'bg-red-100 text-red-800',
}

export default function RegularizationApprovals() {
  const { session, isLoading: sessionLoading } = useSessionContext()
  const router = useRouter()

  // Track if initial load has completed to prevent UI unmounting on session refresh
  const initialLoadComplete = useRef(false)

  const [requests, setRequests] = useState<RegularizationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Approval modal
  const [processingRequest, setProcessingRequest] = useState<RegularizationRequest | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [action, setAction] = useState<'APPROVE' | 'REJECT'>('APPROVE')
  const [reviewerNotes, setReviewerNotes] = useState('')
  const [processingLoading, setProcessingLoading] = useState(false)

  // Bulk processing
  const [bulkProcessing, setBulkProcessing] = useState(false)

  // Fetch pending requests
  const fetchRequests = useCallback(async () => {
    if (!session?.access_token) return

    setLoading(true)
    setError(null)

    try {
      const result = await callGateway('/api/a_crud_universal_pg_function_gateway', {
        config_id: GATEWAY_CONFIGS.PENDING_REGULARIZATIONS,
        params: {}
      }, session.access_token)

      setRequests(result.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  // Handle single request approval/rejection
  const handleProcessRequest = async () => {
    if (!session?.access_token || !processingRequest) return

    setProcessingLoading(true)
    setError(null)

    try {
      await callGateway('/api/a_crud_universal_pg_function_gateway', {
        config_id: GATEWAY_CONFIGS.PROCESS_REGULARIZATION,
        params: {
          request_id: processingRequest.id,
          action: action,
          reviewer_notes: reviewerNotes
        }
      }, session.access_token)

      setSuccess(`Request ${action.toLowerCase()}d successfully`)
      setShowModal(false)
      setProcessingRequest(null)
      setReviewerNotes('')
      fetchRequests()

    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessingLoading(false)
    }
  }

  // Handle bulk approval/rejection
  const handleBulkProcess = async (bulkAction: 'APPROVE' | 'REJECT') => {
    if (!session?.access_token || selectedIds.size === 0) return

    setBulkProcessing(true)
    setError(null)

    try {
      await callGateway('/api/a_crud_universal_pg_function_gateway', {
        config_id: GATEWAY_CONFIGS.BULK_REGULARIZATION,
        params: {
          request_ids: Array.from(selectedIds),
          action: bulkAction,
          reviewer_notes: `Bulk ${bulkAction.toLowerCase()}d`
        }
      }, session.access_token)

      setSuccess(`${selectedIds.size} requests ${bulkAction.toLowerCase()}d successfully`)
      setSelectedIds(new Set())
      fetchRequests()

    } catch (err: any) {
      setError(err.message)
    } finally {
      setBulkProcessing(false)
    }
  }

  // Toggle selection
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  // Select all
  const toggleSelectAll = () => {
    if (selectedIds.size === requests.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(requests.map(r => r.id)))
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

  const formatDateTime = (datetime: string) => {
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

  return (
    <div className="p-8 bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Regularization Approvals</h1>
          <p className="text-gray-600 mt-1">Review and process team regularization requests</p>
        </div>
        <div className="flex space-x-4">
          <Button onClick={fetchRequests} variant="secondary">
            Refresh
          </Button>
          <a href="/employee/manager/attendance">
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

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6 flex justify-between items-center"
        >
          <p className="text-purple-800 font-medium">
            {selectedIds.size} request{selectedIds.size > 1 ? 's' : ''} selected
          </p>
          <div className="flex space-x-4">
            <Button
              onClick={() => handleBulkProcess('APPROVE')}
              disabled={bulkProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              {bulkProcessing ? 'Processing...' : 'Approve All'}
            </Button>
            <Button
              onClick={() => handleBulkProcess('REJECT')}
              disabled={bulkProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {bulkProcessing ? 'Processing...' : 'Reject All'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear Selection
            </Button>
          </div>
        </motion.div>
      )}

      {/* Requests List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
            <svg className="w-16 h-16 text-green-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-600 text-lg">No pending regularization requests</p>
            <p className="text-gray-500 text-sm mt-1">All requests have been processed</p>
          </div>
        ) : (
          <>
            {/* Select All Header */}
            <div className="flex items-center mb-4 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                checked={selectedIds.size === requests.length && requests.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
              />
              <span className="ml-3 text-sm text-gray-600">
                Select all ({requests.length} pending)
              </span>
            </div>

            {/* Request Cards */}
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className={`border rounded-xl p-6 transition-colors ${
                    selectedIds.has(request.id)
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start">
                    {/* Checkbox */}
                    <div className="mr-4 pt-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(request.id)}
                        onChange={() => toggleSelection(request.id)}
                        className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-800 text-lg">
                            {request.employee_name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {request.employee_code} • Submitted {formatDateTime(request.created_at)}
                          </p>
                        </div>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${STATUS_STYLES[request.status] || 'bg-gray-100 text-gray-800'}`}>
                          {request.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                        <div>
                          <p className="text-gray-500">Date</p>
                          <p className="text-gray-800 font-medium">
                            {new Date(request.attendance_date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
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
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3 mb-4">
                        <p className="text-gray-500 text-sm mb-1">Reason</p>
                        <p className="text-gray-700">{request.reason}</p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex space-x-3">
                        <Button
                          onClick={() => {
                            setProcessingRequest(request)
                            setAction('APPROVE')
                            setReviewerNotes('')
                            setShowModal(true)
                          }}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Approve
                        </Button>
                        <Button
                          onClick={() => {
                            setProcessingRequest(request)
                            setAction('REJECT')
                            setReviewerNotes('')
                            setShowModal(true)
                          }}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>

      {/* Approval/Rejection Modal */}
      <AnimatePresence>
        {showModal && processingRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                {action === 'APPROVE' ? 'Approve' : 'Reject'} Request
              </h3>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Employee:</span> {processingRequest.employee_name}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Date:</span> {new Date(processingRequest.attendance_date).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Type:</span> {getRequestTypeLabel(processingRequest.request_type)}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes {action === 'REJECT' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  rows={3}
                  placeholder={action === 'REJECT' ? 'Please provide reason for rejection...' : 'Add optional notes...'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  required={action === 'REJECT'}
                />
              </div>

              <div className="flex space-x-4">
                <Button
                  variant="secondary"
                  onClick={() => setShowModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleProcessRequest}
                  disabled={processingLoading || (action === 'REJECT' && !reviewerNotes.trim())}
                  className={`flex-1 ${action === 'APPROVE' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {processingLoading ? 'Processing...' : `Confirm ${action === 'APPROVE' ? 'Approval' : 'Rejection'}`}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
