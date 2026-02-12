'use client';

import React from 'react';
import { STATUS_COLORS } from '@/lib/constants';

// ============================================================================
// Types
// ============================================================================
type StatusType = keyof typeof STATUS_COLORS;

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  className?: string;
}

// ============================================================================
// Helper Function
// ============================================================================
function getStatusColors(status: string) {
  if (!status) {
    return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' };
  }
  const normalizedStatus = status.toUpperCase().replace(/ /g, '_') as StatusType;
  return STATUS_COLORS[normalizedStatus] || {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-200',
  };
}

function formatStatusLabel(status: string): string {
  if (!status) return 'Unknown';
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// ============================================================================
// Status Badge Component
// ============================================================================
export function StatusBadge({
  status,
  size = 'md',
  showDot = false,
  className = '',
}: StatusBadgeProps) {
  const colors = getStatusColors(status);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full
        ${colors.bg} ${colors.text} ${colors.border} border
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {showDot && (
        <span className={`${dotSizes[size]} rounded-full ${colors.text.replace('text-', 'bg-')}`} />
      )}
      {formatStatusLabel(status)}
    </span>
  );
}

// ============================================================================
// Attendance Status Badge
// ============================================================================
interface AttendanceStatusBadgeProps {
  status: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export function AttendanceStatusBadge({ status, size = 'md' }: AttendanceStatusBadgeProps) {
  if (!status) {
    return (
      <span className="text-gray-400 text-sm">-</span>
    );
  }

  return <StatusBadge status={status} size={size} showDot />;
}

// ============================================================================
// Leave Request Status Badge
// ============================================================================
interface LeaveStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LeaveStatusBadge({ status, size = 'md' }: LeaveStatusBadgeProps) {
  return <StatusBadge status={status} size={size} />;
}

// ============================================================================
// TPS Batch Status Badge
// ============================================================================
interface BatchStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

export function BatchStatusBadge({ status, size = 'md' }: BatchStatusBadgeProps) {
  return <StatusBadge status={status} size={size} showDot />;
}

// ============================================================================
// Priority Badge
// ============================================================================
interface PriorityBadgeProps {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  size?: 'sm' | 'md' | 'lg';
}

const PRIORITY_COLORS = {
  low: { bg: 'bg-gray-100', text: 'text-gray-600' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-700' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700' },
  urgent: { bg: 'bg-red-100', text: 'text-red-700' },
};

export function PriorityBadge({ priority, size = 'md' }: PriorityBadgeProps) {
  const colors = PRIORITY_COLORS[priority];

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full capitalize
        ${colors.bg} ${colors.text}
        ${sizeClasses[size]}
      `}
    >
      {priority}
    </span>
  );
}

// ============================================================================
// Boolean Badge (Yes/No, Active/Inactive, etc.)
// ============================================================================
interface BooleanBadgeProps {
  value: boolean;
  trueLabel?: string;
  falseLabel?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function BooleanBadge({
  value,
  trueLabel = 'Yes',
  falseLabel = 'No',
  size = 'md',
}: BooleanBadgeProps) {
  const colors = value
    ? { bg: 'bg-green-100', text: 'text-green-700' }
    : { bg: 'bg-gray-100', text: 'text-gray-600' };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        ${colors.bg} ${colors.text}
        ${sizeClasses[size]}
      `}
    >
      {value ? trueLabel : falseLabel}
    </span>
  );
}

// ============================================================================
// Count Badge
// ============================================================================
interface CountBadgeProps {
  count: number;
  variant?: 'default' | 'primary' | 'danger' | 'warning';
  size?: 'sm' | 'md' | 'lg';
}

const COUNT_VARIANTS = {
  default: 'bg-gray-100 text-gray-700',
  primary: 'bg-blue-100 text-blue-700',
  danger: 'bg-red-100 text-red-700',
  warning: 'bg-yellow-100 text-yellow-700',
};

export function CountBadge({ count, variant = 'default', size = 'sm' }: CountBadgeProps) {
  if (count === 0) return null;

  const sizeClasses = {
    sm: 'text-xs min-w-[20px] h-5 px-1.5',
    md: 'text-sm min-w-[24px] h-6 px-2',
    lg: 'text-base min-w-[28px] h-7 px-2.5',
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center font-medium rounded-full
        ${COUNT_VARIANTS[variant]}
        ${sizeClasses[size]}
      `}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default StatusBadge;
