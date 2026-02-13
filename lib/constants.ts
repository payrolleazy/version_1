/**
 * Centralized Constants for AMS/LMS/TPS/EOAP/HMS Modules
 * This file contains all configuration IDs, role IDs, and shared constants
 */

// ============================================================================
// ROLE IDs
// ============================================================================
export const ROLE_IDS = {
  EMPLOYEE: '9e9942d7-0d41-4405-8546-e32e155d4d2c',
  ADMIN: '9d498d99-120a-4a98-871f-19e0e876d64d',
  SUPER_ADMIN: '95b1c199-b3c1-428e-bbb4-0722429f3c96',
  MASTER_ADMIN: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  PAYROLL_ADMIN: 'dbbeefb8-985b-49f4-94a5-6f3a8a3c1ce6',
  CANDIDATE: '390c05eb-2f6a-474e-957d-3496458f388a',
} as const;

// ============================================================================
// AMS (Attendance Management System) Gateway Configs
// ============================================================================
export const AMS_GATEWAY_CONFIGS = {
  // Employee Operations
  EMPLOYEE_DASHBOARD: 'ams-employee-attendance-dashboard',
  CAPTURE_PUNCH: 'ams-capture-punch-async',
  PUNCH_STATUS: 'ams-get-punch-status',
  MY_ATTENDANCE: 'ams-read-my-attendance',
  MY_SCHEDULE: 'ams-read-my-schedule',
  MY_REGULARIZATION_REQUESTS: 'ams-my-regularization-requests',
  RECORDS_FOR_REGULARIZATION: 'ams-records-for-regularization',
  SUBMIT_REGULARIZATION: 'ams-submit-regularization',
  CANCEL_REGULARIZATION: 'ams-cancel-regularization',

  // Manager Operations
  MANAGER_DASHBOARD: 'ams-manager-dashboard',
  TEAM_ATTENDANCE: 'ams-read-team-attendance',
  TEAM_REGULARIZATIONS: 'ams-get-team-regularizations',
  PENDING_REGULARIZATIONS: 'ams-pending-regularizations',
  PROCESS_REGULARIZATION: 'ams-process-regularization',
  BULK_REGULARIZATION: 'ams-bulk-regularization',

  // Admin Operations
  READ_SHIFTS: '5961077b-526a-493f-b616-c33bf057899d',
  MANAGE_SHIFTS: 'ams-manage-shifts',
  READ_GEOFENCES: '70b6a0d1-e185-453c-b047-ade74fa76cc1',
  MANAGE_GEOFENCES: 'ams-manage-geofences',
  UPSERT_GEOFENCES: 'ams-upsert-geofences-rpc',
  READ_HOLIDAYS: 'e3a55088-d0b8-4dc0-8211-fe9ab75bde69',
  MANAGE_HOLIDAYS: 'ams-manage-holidays',
  READ_COMPANY_SETTINGS: '1a8b155f-14fd-4e2b-93c2-0aae5ab9d1ad',
  UPDATE_SETTINGS: 'ams-update-settings',
  READ_EMPLOYEE_SCHEDULES: 'c8d9e0f1-a2b3-4567-2345-890123456789',
  MANAGE_EMPLOYEE_SCHEDULES: 'ams-manage-employee-schedules',
  ATTENDANCE_REPORT: 'ams-attendance-report',
} as const;

// ============================================================================
// LMS (Leave Management System) Gateway Configs
// ============================================================================
export const LMS_GATEWAY_CONFIGS = {
  // Employee Operations
  EMPLOYEE_DASHBOARD: 'lms-employee-dashboard',
  READ_LEAVE_TYPES: 'b1c2d3e4-f5a6-7890-abcd-ef1234567890',
  READ_MY_LEAVE_REQUESTS: 'lms-read-my-leave-requests',
  READ_MY_LEAVE_LEDGER: 'lms-read-my-leave-ledger',
  VALIDATE_LEAVE_REQUEST: 'lms-validate-leave-request',
  APPLY_LEAVE: 'lms-apply-leave-enhanced',
  CANCEL_LEAVE_REQUEST: 'lms-cancel-leave-request',
  GET_BALANCE_SUMMARY: 'lms-get-balance-summary',
  GET_BALANCE_BY_YEAR: 'lms-get-balance-by-year',

  // Manager Operations
  MANAGER_DASHBOARD: 'lms-manager-dashboard',
  GET_TEAM_LEAVE_REQUESTS: 'lms-get-team-leave-requests',
  PROCESS_APPROVAL: 'lms-process-approval-advanced',
  BULK_APPROVALS: 'lms-bulk-approvals',

  // Admin Operations
  ADMIN_DASHBOARD: 'lms-admin-dashboard',
  READ_POLICIES: 'e4f5a6b7-c8d9-0123-def0-456789012345',
  READ_POLICY_ASSIGNMENTS: 'f5a6b7c8-d9e0-1234-ef01-567890123456',
  MANAGE_LEAVE_TYPE: 'lms-manage-leave-type',
  MANAGE_POLICY: 'lms-manage-policy-advanced',
  ASSIGN_POLICY: 'lms-assign-policy',
  UTILIZATION_REPORT: 'lms-utilization-report',
  WORKFLOW_PERFORMANCE_REPORT: 'lms-workflow-performance-report',
  AUDIT_TRAIL: 'lms-audit-trail',
} as const;

// ============================================================================
// TPS (Time & Payroll System) Gateway Configs
// ============================================================================
export const TPS_GATEWAY_CONFIGS = {
  // Admin Operations
  READ_BATCHES: 'tps-read-batches',
  READ_EMPLOYEE_SUMMARY: 'tps-read-employee-summary',
  CREATE_BATCH: 'tps-create-batch',
  CALCULATE_SUMMARY: 'tps-calculate-summary',
  GET_PERIOD_STATUS: 'tps-get-period-status',
  FREEZE_PERIOD: 'tps-freeze-period',
  PROCESS_BATCH: 'tps-process-batch',
  FINALIZE_PERIOD: 'tps-finalize-period',
  EXPORT_PAYROLL: 'tps-export-payroll',
} as const;

// ============================================================================
// EOAP (Employee Onboarding & Asset Provisioning) Gateway Configs
// ============================================================================
export const EOAP_GATEWAY_CONFIGS = {
  DASHBOARD_STATS: 'eoap-dashboard-stats',
  ANALYTICS: 'eoap-analytics-deep-dive',
  PENDING_HIRES: 'eoap-pending-hires',
  ACTION_INITIATE: 'eoap-action-initiate',
  EMPLOYEE_DETAIL: 'eoap-employee-detail-view',
  STEP_UPDATE: 'eoap-step-update',
  WORKFLOW_FAILURES: 'eoap-workflow-failures',
  EMP_ONBOARDING_STATUS: 'emp-onboarding-dashboard-data',
} as const;

// ============================================================================
// EOAP Read Configs (config_ids for a_crud_universal_read)
// ============================================================================
export const EOAP_READ_CONFIGS = {
  ASSETS: 'ccd559bc-0b57-42d0-9acf-09f0cadf17eb',
  AUDIT_LOG: '9e800f45-245c-4607-9889-9214540b02d9',
  EMAIL_LOG: '27ceee24-fee5-471a-b1ed-e86088548cd1',
  ACTIVE_WORKFLOWS_LIST: '1d8aacc7-5074-4a76-be90-764180030d9f',
  EMAIL_TEMPLATES: 'a4a215a3-42c5-42d9-8451-b7d97b3948b9',
  WORKFLOW_TEMPLATES: '0e8f2ea4-d3b8-4d33-b5a0-d0edc4d9de52',
  WORKFLOW_TEMPLATE_STEPS: '454da2ea-c8c3-4aaa-bff6-339f9f17763f',
  POSITION_ASSET_CHECKLIST: '8bb2250c-63d9-4787-a78a-3ebf9131eb44',
  DOCUMENTS: '2f9e7ca1-3fc0-4125-8e65-f69c5858900e',
  EMPLOYEE_ASSETS: '91604366-b2e0-4b29-9362-076261fcab09',
  STEPS: 'b2e0ad35-5910-4fe0-9487-4dbac502dd28',
} as const;

// ============================================================================
// EOAP Upsert Configs (config_ids for a_crud_universal_bulk_upsert)
// ============================================================================
export const EOAP_UPSERT_CONFIGS = {
  ASSETS: 'b1c9025b-bdea-418b-9756-e77230cdac9f',
  EMAIL_TEMPLATES: '4f8528e3-ee66-4530-a968-e4243e33ce4a',
  WORKFLOW_TEMPLATES: 'd26458de-de06-41de-99fa-cfa67a72f81f',
  WORKFLOW_TEMPLATE_STEPS: '6718edb8-5bb1-4cf6-91bc-58a9419975a8',
  POSITION_ASSET_CHECKLIST: '4bacb460-ad7d-411d-a8c2-1d07083c95d0',
} as const;

// ============================================================================
// HMS (Hierarchy Management System) Gateway Configs
// ============================================================================
export const HMS_GATEWAY_CONFIGS = {
  // === Position Attributes - Position ===
  POSITION_READ_APPROVED: 'position-read-approved-ui',
  POSITION_READ_PENDING: 'position-read-pending-ui',
  POSITION_READ_SCHEMA: 'position-read-schema',
  POSITION_APPROVE: 'position-approve-universal',
  POSITION_REJECT: 'position-reject-universal',
  POSITION_BULK_INSERT: 'position-bulk-insert',
  POSITION_SCHEMA_INSERT: 'position-schema-insert',
  POSITION_TEMPLATE_DOWNLOAD: 'position-template-download',
  POSITION_EXPORT_EXCEL: 'position-master-export-to-excel',

  // === Position Attributes - Department ===
  DEPARTMENT_READ_APPROVED: 'department-read-approved-ui',
  DEPARTMENT_READ_PENDING: 'department-read-pending-ui',
  DEPARTMENT_READ_SCHEMA: 'department-read-schema',
  DEPARTMENT_APPROVE: 'department-approve-universal',
  DEPARTMENT_REJECT: 'department-reject-universal',
  DEPARTMENT_BULK_INSERT: 'department-bulk-insert',
  DEPARTMENT_SCHEMA_INSERT: 'departments-schema-insert',
  DEPARTMENT_TEMPLATE_DOWNLOAD: 'department-template-download',
  DEPARTMENT_EXPORT_EXCEL: 'department-master-export-to-excel',
  DEPARTMENT_EXCEL_UPLOAD: 'department-universal-excel-upload',

  // === Position Attributes - Designation ===
  DESIGNATION_READ_APPROVED: 'designation-read-approved-ui',
  DESIGNATION_READ_PENDING: 'designation-read-pending-ui',
  DESIGNATION_READ_SCHEMA: 'designation-read-schema',
  DESIGNATION_APPROVE: 'designation-approve-universal',
  DESIGNATION_REJECT: 'designation-reject-universal',
  DESIGNATION_BULK_INSERT: 'designation-bulk-insert',
  DESIGNATION_SCHEMA_INSERT: 'designations-schema-insert',
  DESIGNATION_TEMPLATE_DOWNLOAD: 'designation-template-download',
  DESIGNATION_EXPORT_EXCEL: 'designation-master-export-to-excel',
  DESIGNATION_EXCEL_UPLOAD: 'designation-universal-excel-upload',

  // === Position Attributes - Branch ===
  BRANCH_READ_APPROVED: 'branch-read-approved-ui',
  BRANCH_READ_PENDING: 'branch-read-pending-ui',
  BRANCH_READ_SCHEMA: 'branch-read-schema',
  BRANCH_APPROVE: 'branch-approve-universal',
  BRANCH_REJECT: 'branch-reject-universal',
  BRANCH_BULK_INSERT: 'branch-bulk-insert',
  BRANCH_SCHEMA_INSERT: 'branch-schema-insert',
  BRANCH_TEMPLATE_DOWNLOAD: 'branch-template-download',
  BRANCH_EXPORT_EXCEL: 'branch-master-export-to-excel',
  BRANCH_EXCEL_UPLOAD: 'branch-universal-excel-upload',

  // === Position Attributes - Location ===
  LOCATION_READ_APPROVED: 'branch-read-approved-ui',
  LOCATION_READ_PENDING: 'location-read-pending',
  LOCATION_READ_SCHEMA: 'location-read-schema',
  LOCATION_APPROVE: 'location-approve-universal',
  LOCATION_REJECT: 'location-reject-universal',
  LOCATION_BULK_INSERT: 'location-bulk-insert',
  LOCATION_SCHEMA_INSERT: 'location-schema-insert',
  LOCATION_TEMPLATE_DOWNLOAD: 'location-template-download',
  LOCATION_EXPORT_EXCEL: 'location-master-export-to-excel',

  // === Hierarchy Operations ===
  ORG_CHART: 'hierarchy_get_org_chart',
  ORG_CHART_EMPLOYEE: 'hierarchy_get_org_chart_employee',
  ORG_CHART_MASTER_ADMIN: 'hierarchy_get_org_chart_master_admin',
  CREATE_POSITION: 'hierarchy_create_position',
  DELETE_POSITION: 'hierarchy_delete_position',
  ASSIGN_EMPLOYEE: 'hierarchy_assign_employee',
  SEARCH_POSITIONS: 'hierarchy_search_positions',
  BULK_IMPORT: 'hierarchy_bulk_import',
  POSITION_HISTORY: 'hierarchy_get_position_history',
  REPORTING_LINE: 'hierarchy_get_reporting_line',
  REPORTING_LINE_EMPLOYEE: 'hierarchy_get_reporting_line_employee',
  METRICS: 'hierarchy_get_metrics',
  METRICS_MASTER_ADMIN: 'hierarchy_get_metrics_master_admin',
  METRICS_SUPER_ADMIN: 'hierarchy_get_metrics_super_admin',
  HEALTH_CHECK: 'hierarchy_health_check',
  HEALTH_CHECK_MASTER_ADMIN: 'hierarchy_health_check_master_admin',
  HEALTH_CHECK_SUPER_ADMIN: 'hierarchy_health_check_super_admin',
  MAINTENANCE: 'hierarchy_maintenance_tenant',
  MAINTENANCE_SUPER_ADMIN: 'hierarchy_maintenance_super_admin',
  BACKUP: 'hierarchy_create_backup',
  EXPORT_DYNAMIC: 'hierarchy_export_dynamic',
  SELF_TEST: 'hierarchy_self_test',
  REBUILD_VIEW: 'hierarchy_rebuild_optimized_view',
  REFRESH_VIEW: 'hierarchy_refresh_view',

  // === Cross-Module ===
  DYNAMIC_HIERARCHY_VIEW: 'read_dynamic_hierarchy_view',
  EMPLOYEE_ORG_PROFILE: 'employee-read-organizational-profile',
} as const;

// ============================================================================
// HMS Status Constants
// ============================================================================
export const HMS_APPROVAL_STATUS = {
  APPROVED: 'approved',
  PENDING: 'pending',
  REJECTED: 'rejected',
} as const;

export const HMS_POSITION_STATUS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
} as const;

// ============================================================================
// API Endpoints
// ============================================================================
export const API_ENDPOINTS = {
  GATEWAY: '/api/a_crud_universal_pg_function_gateway',
  READ: '/api/a_crud_universal_read',
  BULK_UPSERT: '/api/a_crud_universal_bulk_upsert',
  EXCEL_TEMPLATE: '/api/excel-template-generator',
  EXCEL_UPLOAD: '/api/universal-excel-upload',
} as const;

// ============================================================================
// Status Enums
// ============================================================================
export const ATTENDANCE_STATUS = {
  PRESENT: 'PRESENT',
  LATE_IN: 'LATE_IN',
  EARLY_OUT: 'EARLY_OUT',
  ABSENT: 'ABSENT',
  ON_LEAVE: 'ON_LEAVE',
  HOLIDAY: 'HOLIDAY',
  WEEKEND: 'WEEKEND',
  MISSED_PUNCH_IN: 'MISSED_PUNCH_IN',
  MISSED_PUNCH_OUT: 'MISSED_PUNCH_OUT',
  PRESENT_REGULARIZED: 'PRESENT_REGULARIZED',
} as const;

export const LEAVE_REQUEST_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  WITHDRAWN: 'WITHDRAWN',
} as const;

export const REGULARIZATION_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export const TPS_BATCH_STATUS = {
  OPEN: 'OPEN',
  FROZEN: 'FROZEN',
  PROCESSING: 'PROCESSING',
  PROCESSED: 'PROCESSED',
  FINALIZED: 'FINALIZED',
} as const;

export const EOAP_WORKFLOW_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_HR_REVIEW: 'PENDING_HR_REVIEW',
  PENDING_MANAGER_REVIEW: 'PENDING_MANAGER_REVIEW',
  HR_APPROVED: 'HR_APPROVED',
  HR_REJECTED: 'HR_REJECTED',
  MANAGER_REJECTED: 'MANAGER_REJECTED',
  ACTIVATION_IN_PROGRESS: 'ACTIVATION_IN_PROGRESS',
  ASSETS_PENDING: 'ASSETS_PENDING',
  DOCUMENTS_PENDING: 'DOCUMENTS_PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  ON_HOLD: 'ON_HOLD',
  CANCELLED: 'CANCELLED',
} as const;

export const EOAP_STEP_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const;

export const EOAP_ASSET_STATUS = {
  AVAILABLE: 'Available',
  ASSIGNED: 'Assigned',
  RESERVED: 'Reserved',
  IN_REPAIR: 'In Repair',
  DECOMMISSIONED: 'Decommissioned',
  LOST: 'Lost',
  STOLEN: 'Stolen',
} as const;

export const EOAP_EMAIL_STATUS = {
  QUEUED: 'Queued',
  SENT: 'Sent',
  FAILED: 'Failed',
  DELIVERED: 'Delivered',
  BOUNCED: 'Bounced',
  SPAM: 'Spam',
} as const;

// ============================================================================
// Color Mappings for UI
// ============================================================================
export const STATUS_COLORS = {
  // Attendance Status Colors
  PRESENT: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  LATE_IN: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  EARLY_OUT: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  ABSENT: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  ON_LEAVE: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  HOLIDAY: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  WEEKEND: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },

  // Leave Request Status Colors
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
  PENDING_APPROVAL: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  APPROVED: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },

  // TPS Batch Status Colors
  OPEN: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  FROZEN: { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-200' },
  PROCESSING: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  PROCESSED: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  FINALIZED: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },

  // EOAP Workflow Status Colors
  PENDING_HR_REVIEW: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  PENDING_MANAGER_REVIEW: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  HR_APPROVED: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  HR_REJECTED: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  MANAGER_REJECTED: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  ACTIVATION_IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  ASSETS_PENDING: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  DOCUMENTS_PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  FAILED: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  ON_HOLD: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },

  // EOAP Step Status Colors
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  IN_PROGRESS: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  SKIPPED: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },

  // EOAP Asset Status Colors (Mixed Case - matches backend enum exactly)
  'Available': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  'Assigned': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  'Reserved': { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' },
  'In Repair': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  'Decommissioned': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
  'Lost': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  'Stolen': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },

  // Onboarding Status Colors (lowercase - matches profiles.onboarding_status enum)
  'pending': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  'approved': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  'rejected': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },

  // EOAP Email Status Colors (Mixed Case - matches backend enum exactly)
  'Queued': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
  'Sent': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  'Failed': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  'Delivered': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  'Bounced': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  'Spam': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
} as const;

// ============================================================================
// Pagination Defaults
// ============================================================================
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
};

// ============================================================================
// Polling/Timeout Settings
// ============================================================================
export const POLLING = {
  PUNCH_STATUS_INTERVAL: 2000, // 2 seconds
  PUNCH_STATUS_TIMEOUT: 30000, // 30 seconds
  EXPORT_STATUS_INTERVAL: 3000, // 3 seconds
  DEFAULT_REQUEST_TIMEOUT: 10000, // 10 seconds
} as const;

// ============================================================================
// Date Format Patterns
// ============================================================================
export const DATE_FORMATS = {
  DISPLAY_DATE: 'DD MMM YYYY', // 28 Jan 2026
  DISPLAY_DATE_SHORT: 'DD/MM/YYYY', // 28/01/2026
  DISPLAY_DATETIME: 'DD MMM YYYY, hh:mm A', // 28 Jan 2026, 09:30 AM
  DISPLAY_TIME: 'hh:mm A', // 09:30 AM
  DISPLAY_TIME_24: 'HH:mm', // 09:30
  ISO_DATE: 'YYYY-MM-DD', // 2026-01-28
  MONTH_YEAR: 'MMMM YYYY', // January 2026
  DAY_MONTH: 'DD MMM', // 28 Jan
} as const;

// ============================================================================
// Session Keys (for localStorage/sessionStorage)
// ============================================================================
export const STORAGE_KEYS = {
  LAST_PUNCH_TIME: 'ams_last_punch_time',
  ATTENDANCE_FILTERS: 'ams_attendance_filters',
  LEAVE_FILTERS: 'lms_leave_filters',
  SELECTED_PAYROLL_PERIOD: 'tps_selected_period',
} as const;

// ============================================================================
// Type Exports
// ============================================================================
export type AttendanceStatusType = typeof ATTENDANCE_STATUS[keyof typeof ATTENDANCE_STATUS];
export type LeaveRequestStatusType = typeof LEAVE_REQUEST_STATUS[keyof typeof LEAVE_REQUEST_STATUS];
export type RegularizationStatusType = typeof REGULARIZATION_STATUS[keyof typeof REGULARIZATION_STATUS];
export type TpsBatchStatusType = typeof TPS_BATCH_STATUS[keyof typeof TPS_BATCH_STATUS];
export type EoapWorkflowStatusType = typeof EOAP_WORKFLOW_STATUS[keyof typeof EOAP_WORKFLOW_STATUS];
export type EoapStepStatusType = typeof EOAP_STEP_STATUS[keyof typeof EOAP_STEP_STATUS];
export type EoapAssetStatusType = typeof EOAP_ASSET_STATUS[keyof typeof EOAP_ASSET_STATUS];
export type EoapEmailStatusType = typeof EOAP_EMAIL_STATUS[keyof typeof EOAP_EMAIL_STATUS];
export type HmsApprovalStatusType = typeof HMS_APPROVAL_STATUS[keyof typeof HMS_APPROVAL_STATUS];
export type HmsPositionStatusType = typeof HMS_POSITION_STATUS[keyof typeof HMS_POSITION_STATUS];
