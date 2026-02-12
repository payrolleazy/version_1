'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { EOAP_GATEWAY_CONFIGS } from '@/lib/constants';
import { callPgFunction } from '@/lib/useGateway';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState } from '@/components/ui/ErrorBoundary';
import WorkflowStepsList from './WorkflowStepsList';
import DocumentChecklistView from './DocumentChecklistView';
import ActionConfirmModal from './ActionConfirmModal';

interface EmployeeDetail {
  user_id: string;
  candidate_name: string;
  email: string;
  phone: string;
  position_title: string;
  department: string;
  workflow_id: string;
  workflow_status: string;
  progress_percentage: number;
  created_at: string;
  steps: any[];
  documents: any[];
  assets: any[];
}

interface FailureLog {
  id: string;
  step_name: string;
  error_message: string;
  occurred_at: string;
  resolved: boolean;
}

interface EmployeeOnboardingDetailProps {
  userId: string;
}

export default function EmployeeOnboardingDetail({ userId }: EmployeeOnboardingDetailProps) {
  const { session } = useSessionContext();
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [failures, setFailures] = useState<FailureLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [modalOpen, setModalOpen] = useState(false);
  const [actionType, setActionType] = useState('');

  const fetchDetail = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const [detailResult, failuresResult] = await Promise.all([
        callPgFunction(EOAP_GATEWAY_CONFIGS.EMPLOYEE_DETAIL, { user_id: userId }, session.access_token),
        callPgFunction(EOAP_GATEWAY_CONFIGS.WORKFLOW_FAILURES, { user_id: userId }, session.access_token),
      ]);
      if (detailResult.success) {
        setDetail(detailResult.data);
      } else {
        setError(detailResult.error || 'Failed to load employee detail');
      }
      if (failuresResult.success) {
        setFailures(Array.isArray(failuresResult.data) ? failuresResult.data : []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, userId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleStepComplete = async (stepId: string) => {
    if (!session?.access_token) return;
    try {
      const result = await callPgFunction(
        EOAP_GATEWAY_CONFIGS.STEP_UPDATE,
        { step_id: stepId, status: 'COMPLETED' },
        session.access_token
      );
      if (result.success) fetchDetail();
      else setError(result.error || 'Failed to update step');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAction = (action: string) => {
    setActionType(action);
    setModalOpen(true);
  };

  const handleActionConfirm = async (comments: string) => {
    if (!session?.access_token || !detail) return;
    try {
      const result = await callPgFunction(
        EOAP_GATEWAY_CONFIGS.ACTION_INITIATE,
        { workflow_id: detail.workflow_id, action: actionType, comments },
        session.access_token
      );
      if (result.success) {
        setModalOpen(false);
        fetchDetail();
      } else {
        setError(result.error || 'Action failed');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!session) return <div className="min-h-screen flex items-center justify-center"><p>Loading session...</p></div>;
  if (loading) return <LoadingState message="Loading employee detail..." />;
  if (error) return <div className="p-6 bg-red-50 border-l-4 border-red-500 text-red-700 rounded"><p>{error}</p><button onClick={fetchDetail} className="mt-2 text-sm underline">Retry</button></div>;
  if (!detail) return <div className="p-6 text-gray-500">Employee not found</div>;

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'steps', label: 'Workflow Steps' },
    { id: 'documents', label: 'Documents' },
    { id: 'assets', label: 'Assets' },
    { id: 'failures', label: `Failures (${failures.length})` },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{detail.candidate_name}</h2>
          <p className="text-gray-500">{detail.position_title} - {detail.department}</p>
        </div>
        <div className="flex items-center space-x-3">
          <StatusBadge status={detail.workflow_status} size="lg" />
          <div className="flex space-x-2">
            {detail.workflow_status === 'ON_HOLD' && (
              <button onClick={() => handleAction('RESTART')} className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200">Resume</button>
            )}
            {!['COMPLETED', 'CANCELLED', 'HR_REJECTED'].includes(detail.workflow_status) && (
              <button onClick={() => handleAction('CANCEL')} className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200">Cancel</button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Progress</span>
          <span className="text-sm font-bold text-gray-900">{detail.progress_percentage || 0}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500" style={{ width: `${detail.progress_percentage || 0}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Email', value: detail.email },
              { label: 'Phone', value: detail.phone },
              { label: 'Position', value: detail.position_title },
              { label: 'Department', value: detail.department },
              { label: 'Workflow ID', value: detail.workflow_id },
              { label: 'Started', value: detail.created_at ? new Date(detail.created_at).toLocaleDateString() : '-' },
            ].map((item) => (
              <div key={item.label} className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider">{item.label}</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{item.value || '-'}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'steps' && (
          <WorkflowStepsList steps={detail.steps || []} onCompleteStep={handleStepComplete} />
        )}

        {activeTab === 'documents' && (
          <DocumentChecklistView documents={detail.documents || []} />
        )}

        {activeTab === 'assets' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Asset</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Assigned</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(!detail.assets || detail.assets.length === 0) ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No assets assigned</td></tr>
                ) : (
                  detail.assets.map((asset: any, i: number) => (
                    <tr key={i} className="hover:bg-blue-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{asset.asset_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{asset.asset_type}</td>
                      <td className="px-6 py-4"><StatusBadge status={asset.status} size="sm" /></td>
                      <td className="px-6 py-4 text-sm text-gray-500">{asset.assigned_at ? new Date(asset.assigned_at).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'failures' && (
          <div className="space-y-3">
            {failures.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No failure logs found</div>
            ) : (
              failures.map((f) => (
                <div key={f.id} className={`p-4 rounded-lg border ${f.resolved ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{f.step_name}</p>
                      <p className="text-sm text-gray-600 mt-1">{f.error_message}</p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={f.resolved ? 'COMPLETED' : 'FAILED'} size="sm" />
                      <p className="text-xs text-gray-500 mt-1">{new Date(f.occurred_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <ActionConfirmModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleActionConfirm}
        actionType={actionType}
        candidateName={detail.candidate_name}
      />
    </div>
  );
}
