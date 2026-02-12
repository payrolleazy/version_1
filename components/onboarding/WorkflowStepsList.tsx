'use client';

import React from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface WorkflowStep {
  id: string;
  step_name: string;
  step_order: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
}

interface WorkflowStepsListProps {
  steps: WorkflowStep[];
  onCompleteStep?: (stepId: string) => void;
}

export default function WorkflowStepsList({ steps, onCompleteStep }: WorkflowStepsListProps) {
  if (!steps || steps.length === 0) {
    return <div className="p-8 text-center text-gray-500">No workflow steps found</div>;
  }

  const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order);

  return (
    <div className="space-y-3">
      {sortedSteps.map((step, index) => (
        <div
          key={step.id}
          className={`flex items-start space-x-4 p-4 rounded-lg border transition-colors ${
            step.status === 'COMPLETED' ? 'bg-green-50 border-green-200' :
            step.status === 'IN_PROGRESS' ? 'bg-blue-50 border-blue-200' :
            step.status === 'FAILED' ? 'bg-red-50 border-red-200' :
            'bg-white border-gray-200'
          }`}
        >
          {/* Step Number */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            step.status === 'COMPLETED' ? 'bg-green-500 text-white' :
            step.status === 'IN_PROGRESS' ? 'bg-blue-500 text-white' :
            step.status === 'FAILED' ? 'bg-red-500 text-white' :
            'bg-gray-200 text-gray-600'
          }`}>
            {step.status === 'COMPLETED' ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              index + 1
            )}
          </div>

          {/* Step Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900">{step.step_name}</h4>
              <StatusBadge status={step.status} size="sm" />
            </div>
            {step.notes && <p className="text-sm text-gray-500 mt-1">{step.notes}</p>}
            <div className="flex space-x-4 mt-2 text-xs text-gray-400">
              {step.started_at && <span>Started: {new Date(step.started_at).toLocaleString()}</span>}
              {step.completed_at && <span>Completed: {new Date(step.completed_at).toLocaleString()}</span>}
            </div>
          </div>

          {/* Manual Complete Button */}
          {onCompleteStep && (step.status === 'PENDING' || step.status === 'IN_PROGRESS' || step.status === 'FAILED') && (
            <button
              onClick={() => onCompleteStep(step.id)}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors"
            >
              Complete
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
