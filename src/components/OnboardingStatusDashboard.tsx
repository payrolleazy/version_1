'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Loader from './ui/Loader';
import type { Session } from '@supabase/supabase-js';

interface OnboardingStatusData {
  onboarding_documentation: {
    total_fields_tracked: number;
    fields_filled: number;
    fields_empty: number;
    completion_percentage: number;
    empty_fields: string[];
  };
  employeedocumentation: {
    [key: string]: {
      total_docs_tracked: number;
      docs_uploaded: number;
      docs_missing: number;
      completion_percentage: number;
      missing_documents: string[];
      credential_details: Array<{ credential_type: string; exists: boolean }>;
    };
  };
}

interface OnboardingStatusDashboardProps {
  session?: Session;
}

export default function OnboardingStatusDashboard({ session }: OnboardingStatusDashboardProps) {
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOnboardingStatus = async () => {
      if (!session?.access_token) {
        setError('User session not found. Please log in.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/onboarding-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accessToken: session.access_token }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch onboarding status');
        }

        const data = await response.json();
        setOnboardingStatus(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(errorMessage);
        console.error('Error fetching onboarding status:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (session?.access_token) {
      fetchOnboardingStatus();
    } else {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader />
        <p className="text-gray-600 dark:text-gray-300 ml-2">Loading onboarding status...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 dark:text-red-400 p-4 bg-red-100 dark:bg-red-900 rounded-md">
        <p className="font-semibold">Error: {error}</p>
        <p className="text-sm mt-1">Please ensure you are logged in and have the necessary permissions.</p>
      </div>
    );
  }

  if (!onboardingStatus) {
    return (
      <div className="text-gray-600 dark:text-gray-300 p-4 bg-gray-100 dark:bg-gray-700 rounded-md">
        <p>No onboarding status data available.</p>
      </div>
    );
  }

  const { onboarding_documentation, employeedocumentation } = onboardingStatus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg space-y-8"
    >
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Your Onboarding Progress</h2>

      <section className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg shadow-md border border-gray-100 dark:border-gray-600">
        <h3 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-5">Profile Information</h3>
        <div className="flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-8">
          <div className="relative w-32 h-32 flex-shrink-0">
            <svg className="w-full h-full" viewBox="0 0 100 100" role="img" aria-label={`${onboarding_documentation.completion_percentage}% complete`}>
              <circle
                className="text-gray-200 dark:text-gray-600 stroke-current"
                strokeWidth="8"
                cx="50"
                cy="50"
                r="45"
                fill="transparent"
              ></circle>
              <motion.circle
                className="text-blue-500 stroke-current"
                strokeWidth="8"
                strokeLinecap="round"
                cx="50"
                cy="50"
                r="45"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 45}
                strokeDashoffset={2 * Math.PI * 45 - (onboarding_documentation.completion_percentage / 100) * (2 * Math.PI * 45)}
                transform="rotate(-90 50 50)"
                initial={{ strokeDashoffset: 2 * Math.PI * 45 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 45 - (onboarding_documentation.completion_percentage / 100) * (2 * Math.PI * 45) }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              ></motion.circle>
              <text
                x="50"
                y="50"
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-xl font-bold text-gray-800 dark:text-white"
              >
                {onboarding_documentation.completion_percentage}%
              </text>
            </svg>
          </div>
          <div className="flex-1 text-center md:text-left">
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-2">
              <span className="font-medium">{onboarding_documentation.fields_filled}</span> of{' '}
              <span className="font-medium">{onboarding_documentation.total_fields_tracked}</span> profile fields completed.
            </p>
            {onboarding_documentation.empty_fields.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-red-500 dark:text-red-400 font-medium">Missing fields:</p>
                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400">
                  {onboarding_documentation.empty_fields.map((field, index) => (
                    <li key={index}>{field.replace(/_epm$/, '').replace(/_/g, ' ')}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Document Uploads</h3>
        {Object.keys(employeedocumentation).length === 0 ? (
          <p className="text-gray-700 dark:text-gray-300">No document categories tracked or data available.</p>
        ) : (
          <div className="space-y-6">
            {Object.entries(employeedocumentation).map(([category, docStatus]) => (
              <div key={category} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md shadow-sm">
                <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-2 capitalize">{category.replace(/_/g, ' ')}</h4>
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-600 mb-2" role="progressbar" aria-valuenow={docStatus.completion_percentage} aria-valuemin={0} aria-valuemax={100}>
                  <div
                    className="bg-green-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${docStatus.completion_percentage}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  <span className="font-medium">{docStatus.docs_uploaded}</span> of{' '}
                  <span className="font-medium">{docStatus.total_docs_tracked}</span> documents uploaded.
                </p>
                {docStatus.missing_documents.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-red-500 dark:text-red-400 font-medium">Missing documents:</p>
                    <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400">
                      {docStatus.missing_documents.map((doc, index) => (
                        <li key={index}>{doc.replace(/_/g, ' ')}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
}
