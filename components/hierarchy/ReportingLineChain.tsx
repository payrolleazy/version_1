'use client';

import React from 'react';
import { motion } from 'framer-motion';

// ============================================================================
// Types
// ============================================================================
export interface ReportingLineNode {
  id: number;
  position_name: string;
  position_status?: string;
  department_name?: string;
  designation_name?: string;
  employee_name?: string;
  full_name?: string;
  emp_code?: string;
  depth?: number;
  [key: string]: any;
}

interface ReportingLineChainProps {
  chain: ReportingLineNode[];
  currentPositionId?: number;
  direction?: 'up' | 'down';
}

// ============================================================================
// Main Component
// ============================================================================
export default function ReportingLineChain({ chain, currentPositionId, direction = 'down' }: ReportingLineChainProps) {
  if (chain.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        <p>No reporting line data available.</p>
      </div>
    );
  }

  const orderedChain = direction === 'up' ? [...chain].reverse() : chain;

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto">
      {orderedChain.map((node, index) => {
        const isCurrent = currentPositionId !== undefined && node.id === currentPositionId;
        const isOccupied = !!(node.employee_name || node.full_name || node.emp_code);
        const isLast = index === orderedChain.length - 1;

        return (
          <React.Fragment key={node.id}>
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className={`
                w-full p-4 rounded-lg border-2 transition-all
                ${isCurrent
                  ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
                  : 'border-gray-200 bg-white hover:shadow-sm'}
              `}
            >
              <div className="flex items-center gap-3">
                {/* Depth indicator */}
                <div className={`
                  flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                  ${isCurrent
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-500'}
                `}>
                  {node.depth !== undefined ? node.depth : index}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold text-sm truncate ${isCurrent ? 'text-blue-900' : 'text-gray-900'}`}>
                      {node.position_name}
                    </span>
                    <span className="text-xs text-gray-400">#{node.id}</span>
                    {isCurrent && (
                      <span className="text-xs px-2 py-0.5 bg-blue-500 text-white rounded-full">You</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {isOccupied ? (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {node.employee_name || node.full_name}
                        {node.emp_code && <span className="text-gray-400">({node.emp_code})</span>}
                      </span>
                    ) : (
                      <span className="text-amber-600 italic">Vacant</span>
                    )}
                    {node.department_name && <span>{node.department_name}</span>}
                    {node.designation_name && <span>{node.designation_name}</span>}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Connector Arrow */}
            {!isLast && (
              <div className="flex flex-col items-center py-1">
                <div className="w-0.5 h-4 bg-gray-300" />
                <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
