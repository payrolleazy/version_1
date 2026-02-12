'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { motion } from 'framer-motion';
import { EOAP_GATEWAY_CONFIGS } from '@/lib/constants';
import { callPgFunction } from '@/lib/useGateway';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/ErrorBoundary';

interface OnboardingStep {
  step_name: string;
  step_order: number;
  status: string;
  completed_at: string | null;
}

interface OnboardingStatusData {
  workflow_status: string;
  progress_percentage: number;
  position_title: string;
  department: string;
  start_date: string;
  steps: OnboardingStep[];
  pending_items: string[];
}

export default function EmployeeOnboardingStatus() {
  const { session } = useSessionContext();
  const [data, setData] = useState<OnboardingStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await callPgFunction(
        EOAP_GATEWAY_CONFIGS.EMP_ONBOARDING_STATUS,
        {},
        session.access_token
      );
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to load onboarding status');
      }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [session?.access_token]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  if (!session) return <div className="min-h-screen flex items-center justify-center"><p>Loading session...</p></div>;
  if (loading) return <LoadingState message="Loading your onboarding status..." />;
  if (error) return <div className="p-6 bg-red-50 border-l-4 border-red-500 text-red-700 rounded"><p>{error}</p><button onClick={fetchStatus} className="mt-2 text-sm underline">Retry</button></div>;
  if (!data) return <div className="p-6 text-center text-gray-500">No onboarding data available. Your onboarding may not have started yet.</div>;

  const sortedSteps = [...(data.steps || [])].sort((a, b) => a.step_order - b.step_order);
  const completedSteps = sortedSteps.filter(s => s.status === 'COMPLETED').length;
  const totalSteps = sortedSteps.length;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">My Onboarding</h2>
            <p className="text-gray-600 mt-1">{data.position_title} - {data.department}</p>
            {data.start_date && <p className="text-sm text-gray-500 mt-1">Start Date: {new Date(data.start_date).toLocaleDateString()}</p>}
          </div>
          <StatusBadge status={data.workflow_status || 'PENDING'} size="lg" />
        </div>

        {/* Progress */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{completedSteps} of {totalSteps} steps completed</span>
            <span className="text-sm font-bold text-purple-700">{data.progress_percentage || 0}%</span>
          </div>
          <div className="w-full bg-white rounded-full h-4 shadow-inner">
            <motion.div
              className="bg-gradient-to-r from-purple-500 to-blue-500 h-4 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${data.progress_percentage || 0}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {/* Pending Items */}
      {data.pending_items && data.pending_items.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-amber-800 mb-3">Action Required</h3>
          <ul className="space-y-2">
            {data.pending_items.map((item, i) => (
              <li key={i} className="flex items-center space-x-2 text-sm text-amber-700">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Steps Timeline */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">Onboarding Steps</h3>
        <div className="space-y-1">
          {sortedSteps.map((step, index) => (
            <div key={index} className="flex items-start space-x-4">
              {/* Timeline Line & Dot */}
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.status === 'COMPLETED' ? 'bg-green-500' :
                  step.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                  step.status === 'FAILED' ? 'bg-red-500' :
                  'bg-gray-300'
                }`}>
                  {step.status === 'COMPLETED' ? (
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-white text-xs font-bold">{index + 1}</span>
                  )}
                </div>
                {index < sortedSteps.length - 1 && (
                  <div className={`w-0.5 h-12 ${step.status === 'COMPLETED' ? 'bg-green-300' : 'bg-gray-200'}`} />
                )}
              </div>

              {/* Step Content */}
              <div className={`flex-1 pb-6 ${index < sortedSteps.length - 1 ? '' : ''}`}>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900">{step.step_name}</h4>
                  <StatusBadge status={step.status} size="sm" />
                </div>
                {step.completed_at && (
                  <p className="text-xs text-gray-400 mt-1">Completed: {new Date(step.completed_at).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
