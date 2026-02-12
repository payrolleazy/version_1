'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import DocumentViewerModal from '@/components/DocumentViewerModal'; // Import the new modal

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
  documentTypes: string[];
  session: any;
}

// Simple Loader Component
const Loader: React.FC = () => (
  <div className="inline-block">
    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
  </div>
);

const OnboardingStatusDashboard: React.FC<OnboardingStatusDashboardProps> = ({ documentTypes, session }) => {
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showAllUploadedDocumentsModal, setShowAllUploadedDocumentsModal] = useState(false); // New state

  useEffect(() => {
    const fetchOnboardingStatus = async () => {
      setIsLoading(true);
      setError(null);
      console.log('Fetching onboarding status with session:', session);

      try {
        const response = await fetch('/api/onboarding-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accessToken: session?.access_token }),
        });

        if (!response.ok) {
          let errorMessage = 'Failed to fetch onboarding status';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || JSON.stringify(errorData);
          } catch (jsonError) {
            try {
              const errorText = await response.text();
              errorMessage = `Server error: ${response.status} - ${errorText}`;
            } catch (textError) {
              errorMessage = `Server error: ${response.status} - Could not parse error response.`;
            }
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        setOnboardingStatus(data);
      } catch (err: any) {
        setError(err.message || 'An unknown error occurred.');
        console.error('Error fetching onboarding status:', err);
        console.log('Current session:', session);
        console.log('Error message:', err.message);
      } finally {
        setIsLoading(false);
      }
    };

    console.log('Checking session for fetch:', session, 'Access Token present:', !!session?.access_token);
    if (session?.access_token) {
      fetchOnboardingStatus();
    } else if (!session && !isLoading) {
      setError('User session not found. Please log in.');
      setIsLoading(false);
    }
  }, [session]);

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4">
        <Loader />
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-gray-600 dark:text-gray-300 font-medium"
        >
          Loading onboarding status...
        </motion.p>
      </div>
    );
  }

  if (error) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden p-6 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-2xl border border-red-200 dark:border-red-800 shadow-lg"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-200 dark:bg-red-800 rounded-full blur-3xl opacity-20 -mr-16 -mt-16"></div>
        <div className="relative z-10">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-1">Error Loading Data</h3>
              <p className="text-red-700 dark:text-red-200 mb-2">{error}</p>
              <p className="text-sm text-red-600 dark:text-red-300">Please ensure you are logged in and have the necessary permissions.</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!onboardingStatus) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-2xl border border-gray-200 dark:border-gray-600 shadow-md"
      >
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse"></div>
          <p className="text-gray-600 dark:text-gray-300 font-medium">No onboarding status data available.</p>
        </div>
      </motion.div>
    );
  }

  const { onboarding_documentation, employeedocumentation } = onboardingStatus;
  const overallProgress = onboarding_documentation.completion_percentage;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative p-8 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 shadow-2xl rounded-3xl space-y-8 overflow-hidden"
    >
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full blur-3xl opacity-30 -mr-48 -mt-48"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-green-100 to-blue-100 dark:from-green-900/20 dark:to-blue-900/20 rounded-full blur-3xl opacity-30 -ml-48 -mb-48"></div>

      {/* Header Section */}
      <div className="relative z-10">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between mb-2"
        >
          <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            Your Onboarding Journey
          </h2>
          <motion.div
            className="px-4 py-2 bg-gradient-to-r from-[#e0c9ef] to-[#b9c9ef] rounded-full shadow-lg"
            whileHover={{ scale: 1.05, y: -3 }}
          >
            <span className="text-white font-bold text-sm">{overallProgress}% Complete</span>
          </motion.div>
        </motion.div>
        <p className="text-gray-600 dark:text-gray-400 text-sm">Track your progress and complete your profile</p>
      </div>

      {/* Profile Information Section */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="relative z-10 bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-blue-900/20 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-200 dark:bg-blue-800 rounded-full blur-3xl opacity-20 -mr-32 -mt-32"></div>
        
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Profile Information</h3>
          </div>

          <div className="flex flex-col lg:flex-row items-center space-y-8 lg:space-y-0 lg:space-x-12">
            {/* Progress Circle */}
            <div className="relative flex-shrink-0">
              <div className="relative w-48 h-48">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    className="text-gray-200 dark:text-gray-700 stroke-current"
                    strokeWidth="6"
                    cx="50"
                    cy="50"
                    r="42"
                    fill="transparent"
                  ></circle>
                  <motion.circle
                    className="stroke-current"
                    style={{
                      stroke: 'url(#gradient)',
                    }}
                    strokeWidth="6"
                    strokeLinecap="round"
                    cx="50"
                    cy="50"
                    r="42"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 42}
                    initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                    animate={{ 
                      strokeDashoffset: 2 * Math.PI * 42 - (onboarding_documentation.completion_percentage / 100) * (2 * Math.PI * 42)
                    }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
                  ></motion.circle>
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#8B5CF6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8, duration: 0.5 }}
                    className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
                  >
                    {onboarding_documentation.completion_percentage}%
                  </motion.span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">Complete</span>
                </div>
              </div>
              {/* Decorative rings */}
              <div className="absolute inset-0 w-48 h-48 border-2 border-blue-200 dark:border-blue-800 rounded-full animate-pulse opacity-20"></div>
              <div className="absolute inset-0 w-48 h-48 border-2 border-purple-200 dark:border-purple-800 rounded-full animate-pulse opacity-20" style={{ animationDelay: '0.5s' }}></div>
            </div>

            {/* Stats */}
            <div className="flex-1 w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <motion.div
                  whileHover={{ scale: 1.05, y: -5 }}
                  className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 p-6 rounded-xl border border-green-200 dark:border-green-800 shadow-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">Completed</span>
                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-green-900 dark:text-green-100">{onboarding_documentation.fields_filled}</p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">Fields filled</p>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.05, y: -5 }}
                  className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 p-6 rounded-xl border border-orange-200 dark:border-orange-800 shadow-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-orange-700 dark:text-orange-300">Pending</span>
                    <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-orange-900 dark:text-orange-100">{onboarding_documentation.fields_empty}</p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Fields remaining</p>
                </motion.div>
              </div>

              {onboarding_documentation.empty_fields.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-red-50 dark:bg-red-900/20 p-5 rounded-xl border border-red-200 dark:border-red-800 max-h-24 overflow-y-auto"
                >
                  <div className="flex items-center space-x-2 mb-3">
                    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm font-semibold text-red-700 dark:text-red-300">Missing Fields</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {onboarding_documentation.empty_fields.map((field, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center space-x-2 text-sm text-red-600 dark:text-red-400"
                      >
                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                        <span className="capitalize">{field.replace(/_epm$/, '').replace(/_/g, ' ')}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Document Upload Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="relative z-10"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-500 rounded-lg flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Document Uploads</h3>
          </div>
          <button
            onClick={() => setShowAllUploadedDocumentsModal(true)}
            className="px-4 py-2 text-sm font-medium rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md hover:from-blue-600 hover:to-purple-600 transition-all duration-200"
          >
            View All Uploaded
          </button>
        </div>

        {Object.keys(employeedocumentation).length === 0 ? (
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 p-8 rounded-2xl border border-gray-200 dark:border-gray-600 text-center">
            <div className="w-16 h-16 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-300 font-medium">No document categories tracked or data available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {Object.entries(employeedocumentation).map(([category, docStatus], index) => (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-750 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-2xl transition-shadow duration-300"
              >
                <div 
                  className="p-6 cursor-pointer"
                  onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                        docStatus.completion_percentage === 100 
                          ? 'bg-gradient-to-br from-green-500 to-emerald-500' 
                          : 'bg-gradient-to-br from-blue-500 to-indigo-500'
                      }`}>
                        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                          {category.replace(/_/g, ' ')}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {docStatus.docs_uploaded} of {docStatus.total_docs_tracked} uploaded
                        </p>
                      </div>
                    </div>
                                        <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${
                          docStatus.completion_percentage === 100
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-blue-600 dark:text-blue-400'
                        }`}>
                          {docStatus.completion_percentage}%
                        </p>
                      </div>
                      <motion.div
                        animate={{ rotate: expandedCategory === category ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </motion.div>
                    </div>                  </div>

                  <div className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${docStatus.completion_percentage}%` }}
                      transition={{ duration: 1, delay: 0.6 + index * 0.1, ease: "easeOut" }}
                      className={`h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 shadow-lg`}
                    ></motion.div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedCategory === category && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="border-t border-gray-200 dark:border-gray-700"
                    >
                      <div className="p-6 bg-gray-50 dark:bg-gray-800/50">
                        {docStatus.missing_documents.length > 0 ? (
                          <div>
                            <div className="flex items-center space-x-2 mb-4">
                              <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">Missing Documents</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {docStatus.missing_documents.map((doc, docIndex) => (
                                <motion.div
                                  key={docIndex}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: docIndex * 0.05 }}
                                  className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-800"
                                >
                                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                  <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{doc.replace(/_/g, ' ')}</span>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full mx-auto mb-3 flex items-center justify-center">
                              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <p className="text-sm font-medium text-green-700 dark:text-green-300">All documents uploaded!</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </motion.section>

      <DocumentViewerModal
        isOpen={showAllUploadedDocumentsModal}
        onClose={() => setShowAllUploadedDocumentsModal(false)}
        session={session}
        documentType={null} // Initially null, allowing selection within the modal
        availableDocumentTypes={documentTypes}
      />
    </motion.div>
  );
};

export default OnboardingStatusDashboard;