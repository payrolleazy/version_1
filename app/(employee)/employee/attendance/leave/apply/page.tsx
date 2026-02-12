'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Loader from '@/components/ui/Loader';

// --- GATEWAY CONFIGURATION ---
const GATEWAY_URL = '/api/a_crud_universal_pg_function_gateway';
const READ_URL = '/api/a_crud_universal_read';

const CONFIGS = {
  // Config to populate the dropdown
  READ_LEAVE_TYPES: 'b1c2d3e4-f5a6-7890-abcd-ef1234567890', 
  // Config for "Dry Run" calculation (Sandwich Rule check)
  VALIDATE_REQUEST: 'lms-validate-leave-request', 
  // Config for final submission
  APPLY_LEAVE: 'lms-apply-leave-enhanced' 
};

// --- TYPES ---
interface LeaveType {
  id: number;
  leave_type_name: string;
  leave_type_code: string;
  category: string;
}

interface ValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  info: string[];
  calculated_duration?: {
    leave_days: number;
    sandwiched_days_added: number;
    calendar_days: number;
    working_days: number;
  };
  current_balance?: number;
  balance_after_leave?: number;
}

export default function ApplyLeavePage() {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const router = useRouter();

  // --- STATE ---
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    start_session: 'full_day', // Options: full_day, first_half, second_half
    end_session: 'full_day',
    reason: '',
    is_emergency: false
  });

  // Validation State (Dry Run)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // --- 1. FETCH LEAVE TYPES ---
  const fetchLeaveTypes = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(READ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: CONFIGS.READ_LEAVE_TYPES,
          params: { 
            filters: { is_active: true },
            orderBy: [['leave_type_name', 'ASC']]
          },
          accessToken: session.access_token
        })
      });
      const result = await res.json();
      if(result.success) {
        setLeaveTypes(result.data || []);
      }
    } catch(e) { 
      console.error(e);
      setError("Failed to load leave types.");
    } finally { 
      setPageLoading(false); 
    }
  }, [session]);

  useEffect(() => {
    if(session) fetchLeaveTypes();
  }, [session, fetchLeaveTypes]);


  // --- 2. DRY RUN VALIDATION (THE SANDWICH RULE ENGINE) ---
  useEffect(() => {
    const runValidation = async () => {
      // Requirements for a dry run
      if (!formData.leave_type_id || !formData.start_date || !formData.end_date || !session) {
        setValidationResult(null);
        return;
      }

      setIsValidating(true);
      setValidationResult(null); // Clear previous result while loading

      try {
        const res = await fetch(GATEWAY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config_id: CONFIGS.VALIDATE_REQUEST,
            params: {
              p_user_id: session.user.id,
              // The backend expects leave_type_id (bigint) to resolve the policy internally
              p_leave_type_id: parseInt(formData.leave_type_id),
              p_start_date: formData.start_date,
              p_end_date: formData.end_date,
              p_start_session: formData.start_session,
              p_end_session: formData.end_session,
              p_is_emergency: formData.is_emergency
            },
            accessToken: session.access_token
          })
        });
        
        const result = await res.json();
        
        // Universal gateway usually returns the function result inside 'data'
        // or directly if it's a scalar. Based on forensic analysis, 
        // `lms_validate_leave_request_comprehensive` returns a JSONB object.
        const validationData = result.data || result;
        setValidationResult(validationData);

      } catch (e) {
        console.error("Validation error", e);
      } finally {
        setIsValidating(false);
      }
    };

    // Debounce the API call by 600ms to prevent spamming while typing
    const timeoutId = setTimeout(runValidation, 600);
    return () => clearTimeout(timeoutId);
  }, [
    formData.leave_type_id, 
    formData.start_date, 
    formData.end_date, 
    formData.start_session, 
    formData.end_session, 
    formData.is_emergency,
    session
  ]);


  // --- 3. SUBMISSION HANDLER ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Strict Gate: Do not allow submission if validation failed (unless emergency override is active)
    if (validationResult && !validationResult.is_valid && !formData.is_emergency) {
      setError("Cannot submit request due to policy violations. Please check the errors below.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config_id: CONFIGS.APPLY_LEAVE,
          params: {
            p_params: {
              user_id: session!.user.id,
              tenant_id: session!.user.user_metadata.tenant_id,
              leave_type_id: parseInt(formData.leave_type_id),
              start_date: formData.start_date,
              end_date: formData.end_date,
              start_session: formData.start_session,
              end_session: formData.end_session,
              reason: formData.reason,
              is_emergency: formData.is_emergency
            }
          },
          accessToken: session!.access_token
        })
      });

      const result = await res.json();
      
      // Check for backend success flag
      const responseData = result.data || result;
      if (!result.success || (responseData.success === false)) {
        throw new Error(responseData.message || "Submission failed. Please try again.");
      }

      // Success! Redirect to history
      router.push('/employee/attendance/leave/history');

    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // --- RENDER ---

  if (sessionLoading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader />
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Apply for Leave</h1>
          <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 p-6">
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded text-sm">
              <p className="font-bold">Error</p>
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* 1. Leave Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
              <select 
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                value={formData.leave_type_id}
                onChange={e => handleChange('leave_type_id', e.target.value)}
                required
              >
                <option value="">-- Select Leave Type --</option>
                {leaveTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.leave_type_name}</option>
                ))}
              </select>
            </div>

            {/* 2. Dates & Sessions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
              
              {/* Start Date */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">Start Date</label>
                <Input 
                  type="date" 
                  value={formData.start_date} 
                  onChange={e => handleChange('start_date', e.target.value)} 
                  required 
                />
                <select 
                  className="w-full text-sm border-gray-300 rounded-md p-2 bg-white"
                  value={formData.start_session}
                  onChange={e => handleChange('start_session', e.target.value)}
                >
                  <option value="full_day">Full Day</option>
                  <option value="first_half">First Half (AM)</option>
                  <option value="second_half">Second Half (PM)</option>
                </select>
              </div>

              {/* End Date */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">End Date</label>
                <Input 
                  type="date" 
                  value={formData.end_date} 
                  onChange={e => handleChange('end_date', e.target.value)} 
                  required 
                />
                <select 
                  className="mt-2 w-full text-sm border-gray-300 rounded-md p-2 bg-white"
                  value={formData.end_session}
                  onChange={e => handleChange('end_session', e.target.value)}
                  // If single day selected, disable end session to avoid confusion? (Optional logic)
                >
                  <option value="full_day">Full Day</option>
                  <option value="first_half">First Half (Ends AM)</option>
                  <option value="second_half">Second Half (Ends PM)</option>
                </select>
              </div>
            </div>

            {/* 3. DRY RUN FEEDBACK (Critical Sandwich Rule Display) */}
            <div className="min-h-[100px]">
              <AnimatePresence mode='wait'>
                {isValidating ? (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center space-x-2 text-gray-500 py-4"
                  >
                    <Loader />
                    <span className="text-sm">Calculating duration and checking policies...</span>
                  </motion.div>
                ) : validationResult ? (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-lg border p-4 ${
                      validationResult.is_valid ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'
                    }`}
                  >
                    {/* Calculation Summary */}
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-3 pb-3 border-b border-gray-200/50">
                      <div>
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Deduction</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {validationResult.calculated_duration?.leave_days || 0} <span className="text-sm font-normal text-gray-500">Days</span>
                        </p>
                      </div>
                      <div className="mt-2 md:mt-0 text-right">
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Closing Balance</p>
                        <p className={`text-xl font-bold ${
                          (validationResult.balance_after_leave || 0) < 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {validationResult.balance_after_leave}
                        </p>
                      </div>
                    </div>

                    {/* Sandwich Rule Warning */}
                    {(validationResult.calculated_duration?.sandwiched_days_added ?? 0) > 0 && (
                      <div className="flex items-start gap-2 text-orange-700 bg-orange-100 p-3 rounded-md mb-3">
                        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                        <div className="text-sm">
                          <strong>Sandwich Rule Applied:</strong> {validationResult.calculated_duration?.sandwiched_days_added} weekend/holiday days have been included in this leave deduction as per company policy.
                        </div>
                      </div>
                    )}

                    {/* Errors List */}
                    {!validationResult.is_valid && validationResult.errors.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-semibold text-red-800 text-sm">Issues found:</p>
                        <ul className="list-disc list-inside text-sm text-red-700">
                           {validationResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Warnings List */}
                    {validationResult.warnings && validationResult.warnings.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <ul className="list-disc list-inside text-sm text-yellow-700">
                           {validationResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm italic border border-dashed border-gray-200 rounded-lg">
                    Select dates and leave type to see calculation
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* 4. Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Leave</label>
              <textarea 
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" 
                rows={3}
                placeholder="Please describe why you are taking leave..."
                value={formData.reason}
                onChange={e => handleChange('reason', e.target.value)}
                required
              />
            </div>

            {/* 5. Emergency Override */}
            <div className="flex items-start gap-3 bg-red-50 p-4 rounded-lg border border-red-100">
               <div className="flex items-center h-5">
                 <input 
                   type="checkbox" 
                   id="emergency" 
                   checked={formData.is_emergency} 
                   onChange={e => handleChange('is_emergency', e.target.checked)} 
                   className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                 />
               </div>
               <label htmlFor="emergency" className="text-sm text-gray-700">
                 <span className="font-bold text-red-700 block mb-1">Emergency Application</span>
                 Check this if you are applying due to an unforeseen emergency. This may bypass certain restriction rules (e.g. notice period), but will require stricter approval.
               </label>
            </div>

            {/* 6. Footer Actions */}
            <div className="pt-4 flex justify-end gap-4 border-t border-gray-100">
               <Button type="button" variant="secondary" onClick={() => router.back()}>
                 Cancel
               </Button>
               <Button 
                 type="submit" 
                 isLoading={submitting} 
                 disabled={isValidating || (!validationResult?.is_valid && !formData.is_emergency)}
                 className={`${!validationResult?.is_valid && formData.is_emergency ? 'bg-red-600 hover:bg-red-700' : ''}`}
               >
                 {(!validationResult?.is_valid && formData.is_emergency) ? 'Force Submit (Emergency)' : 'Submit Request'}
               </Button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}