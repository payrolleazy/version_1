'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================================
// Types
// ============================================================================
export interface OrgChartNode {
  id: number;
  position_name: string;
  reporting_position_id: number | null;
  position_status?: string;
  department_name?: string;
  designation_name?: string;
  emp_code?: string;
  employee_name?: string;
  full_name?: string;
  depth?: number;
  direct_reports?: number;
  subtree_size?: number;
  [key: string]: any;
}

interface OrgChartTreeProps {
  data: OrgChartNode[];
  readOnly?: boolean;
  onNodeClick?: (node: OrgChartNode) => void;
  onAssignClick?: (node: OrgChartNode) => void;
  searchQuery?: string;
}

interface TreeNodeProps {
  node: OrgChartNode;
  childNodes: OrgChartNode[];
  allNodes: OrgChartNode[];
  readOnly: boolean;
  expandedIds: Set<number>;
  toggleExpand: (id: number) => void;
  matchingIds: Set<number>;
  onNodeClick?: (node: OrgChartNode) => void;
  onAssignClick?: (node: OrgChartNode) => void;
  depth: number;
}

// ============================================================================
// Helper: Build tree structure from flat array
// ============================================================================
function getChildNodes(allNodes: OrgChartNode[], parentId: number): OrgChartNode[] {
  return allNodes.filter(n => n.reporting_position_id === parentId);
}

function getRootNodes(allNodes: OrgChartNode[]): OrgChartNode[] {
  const allIds = new Set(allNodes.map(n => n.id));
  return allNodes.filter(n => !n.reporting_position_id || !allIds.has(n.reporting_position_id));
}

function getMatchingIds(allNodes: OrgChartNode[], query: string): Set<number> {
  if (!query.trim()) return new Set();
  const lower = query.toLowerCase();
  const matched = new Set<number>();

  for (const node of allNodes) {
    const searchFields = [
      node.position_name,
      node.employee_name || node.full_name,
      node.emp_code,
      node.department_name,
      node.designation_name,
    ].filter(Boolean).map(s => (s as string).toLowerCase());

    if (searchFields.some(f => f.includes(lower))) {
      matched.add(node.id);
      // Also add ancestors
      let current = node;
      while (current.reporting_position_id) {
        matched.add(current.reporting_position_id);
        const parent = allNodes.find(n => n.id === current.reporting_position_id);
        if (!parent) break;
        current = parent;
      }
    }
  }
  return matched;
}

// ============================================================================
// TreeNode Component
// ============================================================================
function TreeNode({ node, childNodes, allNodes, readOnly, expandedIds, toggleExpand, matchingIds, onNodeClick, onAssignClick, depth }: TreeNodeProps) {
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = childNodes.length > 0;
  const isOccupied = !!(node.employee_name || node.full_name || node.emp_code);
  const isMatched = matchingIds.size > 0 && matchingIds.has(node.id);
  const isFilterActive = matchingIds.size > 0;

  return (
    <div className={`${depth > 0 ? 'ml-6 border-l-2 border-gray-200 pl-4' : ''}`}>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, delay: depth * 0.05 }}
        className={`
          group flex items-start gap-3 p-3 rounded-lg mb-2 transition-all cursor-pointer
          ${isFilterActive && !isMatched ? 'opacity-40' : ''}
          ${isOccupied
            ? 'bg-white border border-gray-200 hover:shadow-md hover:border-blue-300'
            : 'bg-gray-50 border border-dashed border-gray-300 hover:border-blue-400'}
        `}
        onClick={() => onNodeClick?.(node)}
      >
        {/* Expand/Collapse Toggle */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}
            className="mt-1 flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-500 hover:text-blue-600 rounded hover:bg-blue-50"
          >
            <motion.span
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-sm"
            >
              &#9654;
            </motion.span>
          </button>
        ) : (
          <span className="mt-1 flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-300 text-xs">&#9679;</span>
        )}

        {/* Node Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-gray-900 truncate">{node.position_name}</span>
            <span className="text-xs text-gray-400">#{node.id}</span>
            {node.position_status && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                node.position_status === 'Active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {node.position_status}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            {(node.employee_name || node.full_name) && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                {node.employee_name || node.full_name}
                {node.emp_code && <span className="text-gray-400">({node.emp_code})</span>}
              </span>
            )}
            {!isOccupied && <span className="text-amber-600 italic">Vacant</span>}
            {node.department_name && <span>{node.department_name}</span>}
            {node.designation_name && <span>{node.designation_name}</span>}
          </div>
        </div>

        {/* Actions */}
        {!readOnly && !isOccupied && onAssignClick && (
          <button
            onClick={(e) => { e.stopPropagation(); onAssignClick(node); }}
            className="hidden group-hover:flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 flex-shrink-0"
          >
            Assign
          </button>
        )}

        {hasChildren && (
          <span className="text-xs text-gray-400 flex-shrink-0 mt-1">
            {childNodes.length} report{childNodes.length !== 1 ? 's' : ''}
          </span>
        )}
      </motion.div>

      {/* Children */}
      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {childNodes.map(child => (
              <TreeNode
                key={child.id}
                node={child}
                childNodes={getChildNodes(allNodes, child.id)}
                allNodes={allNodes}
                readOnly={readOnly}
                expandedIds={expandedIds}
                toggleExpand={toggleExpand}
                matchingIds={matchingIds}
                onNodeClick={onNodeClick}
                onAssignClick={onAssignClick}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Main OrgChartTree Component
// ============================================================================
export default function OrgChartTree({ data, readOnly = false, onNodeClick, onAssignClick, searchQuery = '' }: OrgChartTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => {
    // Auto-expand root nodes and first level
    const roots = getRootNodes(data);
    const initial = new Set<number>();
    roots.forEach(r => {
      initial.add(r.id);
      getChildNodes(data, r.id).forEach(c => initial.add(c.id));
    });
    return initial;
  });

  const matchingIds = useMemo(() => getMatchingIds(data, searchQuery), [data, searchQuery]);

  // When search is active, expand all matching paths
  const effectiveExpanded = useMemo(() => {
    if (matchingIds.size > 0) {
      return new Set([...expandedIds, ...matchingIds]);
    }
    return expandedIds;
  }, [expandedIds, matchingIds]);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(data.map(n => n.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const rootNodes = useMemo(() => getRootNodes(data), [data]);

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p>No organizational data available.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={expandAll} className="text-xs px-3 py-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
          Expand All
        </button>
        <button onClick={collapseAll} className="text-xs px-3 py-1.5 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
          Collapse All
        </button>
        <span className="text-xs text-gray-400 ml-2">{data.length} position{data.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Tree */}
      <div className="space-y-1">
        {rootNodes.map(root => (
          <TreeNode
            key={root.id}
            node={root}
            childNodes={getChildNodes(data, root.id)}
            allNodes={data}
            readOnly={readOnly}
            expandedIds={effectiveExpanded}
            toggleExpand={toggleExpand}
            matchingIds={matchingIds}
            onNodeClick={onNodeClick}
            onAssignClick={onAssignClick}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
}
