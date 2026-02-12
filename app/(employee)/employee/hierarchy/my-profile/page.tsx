'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { LoadingState, ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { callPgFunction } from '@/lib/useGateway';
import { HMS_GATEWAY_CONFIGS } from '@/lib/constants';

// ============================================================================
// Types
// ============================================================================
interface OrgProfile {
  position_name?: string;
  position_id?: number;
  position_status?: string;
  department_name?: string;
  designation_name?: string;
  branch_name?: string;
  location_name?: string;
  reporting_manager_name?: string;
  reporting_manager_emp_code?: string;
  emp_code?: string;
  doj?: string;
  employment_status?: string;
  full_name?: string;
  [key: string]: any;
}

// ============================================================================
// Main Component
// ============================================================================
export default function MyOrgProfilePage() {
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const router = useRouter();

  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await callPgFunction(
        HMS_GATEWAY_CONFIGS.EMPLOYEE_ORG_PROFILE,
        {},
        session.access_token
      );
      if (result.success) {
        const details = result.data?.details || result.data;
        const profileData = Array.isArray(details?.data) ? details.data[0] : details;
        setProfile(profileData || null);
      } else {
        throw new Error(result.error || 'Failed to fetch profile');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!isSessionLoading && !session) router.push('/employee/auth/login');
    if (session) fetchProfile();
  }, [session, isSessionLoading, router, fetchProfile]);

  if (isSessionLoading || loading) return <LoadingState message="Loading your organizational profile..." />;

  const infoCards = [
    { label: 'Position', value: profile?.position_name, icon: '🏢' },
    { label: 'Department', value: profile?.department_name, icon: '📂' },
    { label: 'Designation', value: profile?.designation_name, icon: '📋' },
    { label: 'Branch', value: profile?.branch_name, icon: '🏛️' },
    { label: 'Location', value: profile?.location_name, icon: '📍' },
    { label: 'Employment Status', value: profile?.employment_status, icon: '✅' },
  ];

  return (
    <ErrorBoundary>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">My Organizational Profile</h1>
            <p className="text-gray-600 mt-1">Your position and organizational details.</p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>
          )}

          {!profile ? (
            <div className="text-center py-12 text-gray-500">
              <p>No organizational profile data available. You may not be assigned to a position yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Employee Header Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg shadow-lg p-6 text-white"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                    {(profile.full_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{profile.full_name || 'Employee'}</h2>
                    {profile.emp_code && <p className="text-purple-100">Emp Code: {profile.emp_code}</p>}
                    {profile.doj && <p className="text-purple-100 text-sm">Date of Joining: {new Date(profile.doj).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>}
                  </div>
                </div>
              </motion.div>

              {/* Info Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {infoCards.map((card, index) => (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * (index + 1) }}
                    className="bg-white rounded-lg shadow-md border border-gray-200 p-5"
                  >
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{card.label}</p>
                    <p className="text-lg font-semibold text-gray-900">{card.value || '-'}</p>
                  </motion.div>
                ))}
              </div>

              {/* Reporting Manager Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-white rounded-lg shadow-md border border-gray-200 p-6"
              >
                <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Reporting Manager</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                    {(profile.reporting_manager_name || 'N').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{profile.reporting_manager_name || 'Not Assigned'}</p>
                    {profile.reporting_manager_emp_code && (
                      <p className="text-sm text-gray-500">Emp Code: {profile.reporting_manager_emp_code}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
