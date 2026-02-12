'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/Modal';
import Tabs from '@/components/Tabs';
import { DataTable, Column } from '@/components/ui/DataTable';
import { ErrorBoundary, LoadingState } from '@/components/ui/ErrorBoundary';
import { BooleanBadge } from '@/components/ui/StatusBadge';
import { LMS_GATEWAY_CONFIGS } from '@/lib/constants';
import { callReadGateway, callPgFunction } from '@/lib/useGateway';

// ============================================================================
// Types - Matched to DB Schema (lms_leave_policies + lms_leave_types)
// ============================================================================

// Matches allowed_columns from read config 'e4f5a6b7-c8d9-0123-def0-456789012345'
// Target table: lms_leave_policies
interface LeavePolicy {
  id: number;
  policy_code: string;
  policy_name: string;
  leave_type_id: number;
  policy_rules: PolicyRules;
  automation_rules: Record<string, any>;
  compliance_rules: Record<string, any>;
  is_active: boolean;
  version: number;
  effective_date: string;
  expiry_date: string | null;
  policy_status: string;
  approved_by: string | null;
  created_by: string;
}

// Matches allowed_columns from read config 'b1c2d3e4-f5a6-7890-abcd-ef1234567890'
// Target table: lms_leave_types
interface LeaveType {
  id: number;
  leave_type_code: string;
  leave_type_name: string;
  description?: string;
  category?: string;
  is_active?: boolean;
}

// ============================================================================
// PolicyRules - Matches DB column default JSONB structure exactly
// ============================================================================
interface PolicyRules {
  accrual: {
    type: string;
    amount: number;
    frequency: string;
    prorate_joining: boolean;
    prorate_leaving: boolean;
    accrual_calendar: string;
    accrual_start_date: string;
    max_accrual_per_year: number;
  };
  eligibility: {
    custom_conditions: any[];
    max_service_months: number | null;
    min_service_months: number;
    department_restrictions: any[];
    designation_restrictions: any[];
    not_applicable_for_status: string[];
    applicable_employment_types: string[];
  };
  application_rules: {
    max_duration: number;
    min_duration: number;
    max_days_notice: number;
    min_days_notice: number;
    blackout_periods: any[];
    requires_approval: boolean;
    working_days_only: boolean;
    partial_day_support: boolean;
    max_negative_balance: number;
    sandwich_leave_policy: string;
    allow_negative_balance: boolean;
    applications_per_month: number | null;
    consecutive_days_limit: number;
    auto_approve_conditions: Record<string, any>;
    weekends_and_holidays_deducted: boolean;
  };
  approval_workflow: {
    type: string;
    levels: number;
    escalation_hours: number;
    bulk_approval_allowed: boolean;
    notification_settings: {
      notify_hr: boolean;
      notify_finance: boolean;
      notify_applicant: boolean;
      custom_notifications: any[];
    };
    skip_levels_conditions: Record<string, any>;
    delegate_approval_allowed: boolean;
    auto_approve_if_no_manager: boolean;
  };
  integration_rules: {
    api_webhooks: any[];
    sync_to_payroll: boolean;
    sync_to_attendance: boolean;
    external_approval_required: boolean;
  };
  balance_management: {
    forfeit_unused: boolean;
    transfer_allowed: boolean;
    max_balance_limit: number | null;
    encashment_allowed: boolean;
    encashment_conditions: Record<string, any>;
  };
  year_end_processing: {
    type: string;
    encash_excess: boolean;
    processing_date: string;
    max_carry_forward_days: number | null;
    carry_forward_expiry_months: number | null;
  };
}

// Flat Form State for UI Binding
interface FormData {
  leave_type_id: string;
  policy_name: string;
  policy_code: string;

  // Accrual
  annual_quota: number;
  accrual_type: 'monthly' | 'annual' | 'none';

  // Year End
  carryforward_type: 'lapse' | 'carry_forward';
  max_carryforward_days: number | null;
  carryforward_expiry_months: number | null;

  // Eligibility
  min_service_months: number;

  // Application Rules
  min_duration: number;
  sandwich_leave_policy: string;

  // Workflow
  approval_levels: number;
  escalation_hours: number;

  // Status (only editable on create; activate/deactivate used for existing)
  policy_status: string;
}

// ============================================================================
// Default state - matches DB column defaults exactly
// ============================================================================
const DEFAULT_RULES: PolicyRules = {
  accrual: {
    type: 'monthly',
    amount: 2.0,
    frequency: 'monthly',
    prorate_joining: true,
    prorate_leaving: true,
    accrual_calendar: 'calendar_year',
    accrual_start_date: 'joining_date',
    max_accrual_per_year: 24,
  },
  eligibility: {
    custom_conditions: [],
    max_service_months: null,
    min_service_months: 0,
    department_restrictions: [],
    designation_restrictions: [],
    not_applicable_for_status: ['terminated', 'suspended'],
    applicable_employment_types: ['permanent', 'contract'],
  },
  application_rules: {
    max_duration: 30,
    min_duration: 0.5,
    max_days_notice: 365,
    min_days_notice: 1,
    blackout_periods: [],
    requires_approval: true,
    working_days_only: true,
    partial_day_support: true,
    max_negative_balance: 0,
    sandwich_leave_policy: 'include',
    allow_negative_balance: false,
    applications_per_month: null,
    consecutive_days_limit: 30,
    auto_approve_conditions: {},
    weekends_and_holidays_deducted: false,
  },
  approval_workflow: {
    type: 'hierarchical',
    levels: 1,
    escalation_hours: 72,
    bulk_approval_allowed: false,
    notification_settings: {
      notify_hr: false,
      notify_finance: false,
      notify_applicant: true,
      custom_notifications: [],
    },
    skip_levels_conditions: {},
    delegate_approval_allowed: true,
    auto_approve_if_no_manager: false,
  },
  integration_rules: {
    api_webhooks: [],
    sync_to_payroll: false,
    sync_to_attendance: true,
    external_approval_required: false,
  },
  balance_management: {
    forfeit_unused: false,
    transfer_allowed: false,
    max_balance_limit: null,
    encashment_allowed: false,
    encashment_conditions: {},
  },
  year_end_processing: {
    type: 'carry_forward',
    encash_excess: false,
    processing_date: 'year_end',
    max_carry_forward_days: 10,
    carry_forward_expiry_months: 12,
  },
};

const DEFAULT_FORM: FormData = {
  leave_type_id: '',
  policy_name: '',
  policy_code: '',
  annual_quota: 24,
  accrual_type: 'monthly',
  carryforward_type: 'carry_forward',
  max_carryforward_days: 10,
  carryforward_expiry_months: 12,
  min_service_months: 0,
  min_duration: 0.5,
  sandwich_leave_policy: 'include',
  approval_levels: 1,
  escalation_hours: 72,
  policy_status: 'active',
};

// ============================================================================
// Helper: Deep merge DB rules with defaults to fill missing keys
// ============================================================================
function deepMergeRules(defaults: PolicyRules, source: any): PolicyRules {
  const result: any = JSON.parse(JSON.stringify(defaults));
  if (!source || typeof source !== 'object') return result;

  for (const sectionKey of Object.keys(result)) {
    if (source[sectionKey] === undefined) continue;
    const defaultSection = result[sectionKey];
    const sourceSection = source[sectionKey];

    if (typeof defaultSection === 'object' && defaultSection !== null && !Array.isArray(defaultSection)
        && typeof sourceSection === 'object' && sourceSection !== null && !Array.isArray(sourceSection)) {
      result[sectionKey] = { ...defaultSection, ...sourceSection };
      // Handle nested notification_settings
      if (sectionKey === 'approval_workflow' && sourceSection.notification_settings && typeof sourceSection.notification_settings === 'object') {
        result[sectionKey].notification_settings = {
          ...defaultSection.notification_settings,
          ...sourceSection.notification_settings,
        };
      }
    } else {
      result[sectionKey] = sourceSection;
    }
  }
  return result as PolicyRules;
}

// ============================================================================
// Main Component
// ============================================================================
export default function LeavePoliciesManagementPage() {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const router = useRouter();

  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<LeavePolicy | null>(null);

  // Lookup map: leave_type_id -> LeaveType (policies read doesn't return leave_type_name)
  const leaveTypeMap = useMemo(() => {
    const map = new Map<number, LeaveType>();
    leaveTypes.forEach(t => map.set(t.id, t));
    return map;
  }, [leaveTypes]);

  const fetchAllData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const [typesRes, policiesRes] = await Promise.all([
        callReadGateway<LeaveType[]>(
          LMS_GATEWAY_CONFIGS.READ_LEAVE_TYPES,
          { orderBy: [['leave_type_name', 'ASC']] },
          session.access_token
        ),
        callReadGateway<LeavePolicy[]>(
          LMS_GATEWAY_CONFIGS.READ_POLICIES,
          { orderBy: [['policy_name', 'ASC']] },
          session.access_token
        ),
      ]);

      if (!typesRes.success) throw new Error(typesRes.error || 'Failed to load leave types');
      if (!policiesRes.success) throw new Error(policiesRes.error || 'Failed to load policies');

      setLeaveTypes(Array.isArray(typesRes.data) ? typesRes.data : []);
      setPolicies(Array.isArray(policiesRes.data) ? policiesRes.data : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!sessionLoading && !session) router.push('/admin/auth/login');
    if (session) fetchAllData();
  }, [session, sessionLoading, router, fetchAllData]);

  const handleOpenModal = (policy?: LeavePolicy) => {
    setEditingPolicy(policy || null);
    setIsModalOpen(true);
  };

  // Activate / Deactivate uses separate PG function actions (update action cannot change is_active)
  const handleToggleActive = async (policy: LeavePolicy) => {
    if (!session?.access_token) return;
    try {
      const result = await callPgFunction(
        LMS_GATEWAY_CONFIGS.MANAGE_POLICY,
        {
          action: policy.is_active ? 'deactivate' : 'activate',
          policy_id: policy.id,
        },
        session.access_token
      );
      if (!result.success) throw new Error(result.error || 'Failed to update policy status');
      fetchAllData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const columns: Column<LeavePolicy>[] = [
    { key: 'policy_name', header: 'Policy Name', sortable: true },
    {
      key: 'leave_type_id',
      header: 'Leave Type',
      render: (v) => {
        const lt = leaveTypeMap.get(v as number);
        return lt ? `${lt.leave_type_name} (${lt.leave_type_code})` : `ID: ${v}`;
      },
    },
    {
      key: 'policy_rules',
      header: 'Annual Quota',
      render: (_, row) => (
        <span className="font-bold text-blue-600">
          {row.policy_rules?.accrual?.max_accrual_per_year || 0} Days
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (v) => <BooleanBadge value={v} trueLabel="Active" falseLabel="Inactive" />,
    },
    {
      key: 'id',
      header: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => handleOpenModal(row)}>Edit</Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleActive(row)}
          >
            {row.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      ),
    },
  ];

  if (sessionLoading) return <LoadingState />;

  return (
    <ErrorBoundary>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Leave Policies</h1>
              <p className="text-gray-600 mt-1">Configure advanced logic for accruals, eligibility, and workflows</p>
            </div>
            <Button onClick={() => handleOpenModal()}>+ Create Policy</Button>
          </div>

          {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>}

          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
            <DataTable
              data={policies}
              columns={columns}
              loading={loading}
              emptyMessage="No policies found"
            />
          </div>
        </div>

        {isModalOpen && (
          <PolicyConfigModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSuccess={() => { setIsModalOpen(false); fetchAllData(); }}
            leaveTypes={leaveTypes}
            existingPolicy={editingPolicy}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

// ============================================================================
// Policy Configuration Modal
// ============================================================================

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  leaveTypes: LeaveType[];
  existingPolicy: LeavePolicy | null;
}

function PolicyConfigModal({ isOpen, onClose, onSuccess, leaveTypes, existingPolicy }: ModalProps) {
  const { session } = useSessionContext();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  const [rules, setRules] = useState<PolicyRules>(JSON.parse(JSON.stringify(DEFAULT_RULES)));

  useEffect(() => {
    if (existingPolicy) {
      const pRules = existingPolicy.policy_rules || DEFAULT_RULES;

      // Safely read sandwich_leave_policy (DB stores as string, handle legacy object format)
      let sandwichValue = 'include';
      if (typeof pRules.application_rules?.sandwich_leave_policy === 'string') {
        sandwichValue = pRules.application_rules.sandwich_leave_policy;
      }

      setFormData({
        leave_type_id: String(existingPolicy.leave_type_id),
        policy_name: existingPolicy.policy_name,
        policy_code: existingPolicy.policy_code,

        annual_quota: pRules.accrual?.max_accrual_per_year || 0,
        accrual_type: (pRules.accrual?.type || 'monthly') as FormData['accrual_type'],

        carryforward_type: (pRules.year_end_processing?.type || 'lapse') as FormData['carryforward_type'],
        max_carryforward_days: pRules.year_end_processing?.max_carry_forward_days ?? null,
        carryforward_expiry_months: pRules.year_end_processing?.carry_forward_expiry_months ?? null,

        min_service_months: pRules.eligibility?.min_service_months || 0,

        min_duration: pRules.application_rules?.min_duration || 0.5,
        sandwich_leave_policy: sandwichValue,

        approval_levels: pRules.approval_workflow?.levels || 1,
        escalation_hours: pRules.approval_workflow?.escalation_hours || 72,

        policy_status: existingPolicy.policy_status || 'active',
      });

      // Deep merge existing rules with defaults to fill any missing keys
      setRules(deepMergeRules(DEFAULT_RULES, pRules));
    } else {
      setFormData({
        ...DEFAULT_FORM,
        policy_code: `POL_${Date.now()}`,
      });
      setRules(JSON.parse(JSON.stringify(DEFAULT_RULES)));
    }
  }, [existingPolicy]);

  const handleFormChange = (field: keyof FormData, val: any) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const updateRule = (section: keyof PolicyRules, field: string, value: any) => {
    setRules(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  const handleSubmit = async () => {
    if (!session || !formData.leave_type_id || !formData.policy_name) return;
    setSubmitting(true);
    setError(null);

    try {
      // Compute per-period accrual amount from annual quota
      const accrualAmount = formData.accrual_type === 'monthly'
        ? formData.annual_quota / 12
        : formData.annual_quota;

      // Build final policy_rules JSON matching DB structure
      const finalPolicyRules: PolicyRules = {
        ...rules,
        accrual: {
          ...rules.accrual,
          type: formData.accrual_type,
          amount: Number(accrualAmount.toFixed(4)),
          frequency: formData.accrual_type,
          max_accrual_per_year: Number(formData.annual_quota),
        },
        eligibility: {
          ...rules.eligibility,
          min_service_months: Number(formData.min_service_months),
        },
        application_rules: {
          ...rules.application_rules,
          min_duration: Number(formData.min_duration),
          partial_day_support: Number(formData.min_duration) < 1,
          sandwich_leave_policy: formData.sandwich_leave_policy,
        },
        approval_workflow: {
          ...rules.approval_workflow,
          levels: Number(formData.approval_levels),
          escalation_hours: Number(formData.escalation_hours),
        },
        year_end_processing: {
          ...rules.year_end_processing,
          type: formData.carryforward_type,
          max_carry_forward_days: formData.carryforward_type === 'carry_forward'
            ? Number(formData.max_carryforward_days)
            : null,
          carry_forward_expiry_months: formData.carryforward_type === 'carry_forward'
            ? Number(formData.carryforward_expiry_months)
            : null,
        },
      };

      // Build payload matching lms_manage_policy_advanced(p_params jsonb)
      // Function extracts: action, policy_id, policy_data
      // Gateway injects: user_id, tenant_id from auth token
      const payload = {
        action: existingPolicy ? 'update' : 'create',
        policy_id: existingPolicy?.id || null,
        policy_data: {
          leave_type_id: formData.leave_type_id,
          policy_name: formData.policy_name,
          policy_code: formData.policy_code,
          policy_status: formData.policy_status,
          policy_rules: finalPolicyRules,
          automation_rules: existingPolicy?.automation_rules || {
            auto_expiry: true,
            auto_accrual: true,
            conditional_logic: [],
            workflow_triggers: [],
            auto_notifications: true,
          },
          compliance_rules: existingPolicy?.compliance_rules || {
            privacy_settings: {},
            audit_trail_level: 'full',
            data_retention_years: 7,
            regulatory_requirements: [],
          },
        },
      };

      const result = await callPgFunction(
        LMS_GATEWAY_CONFIGS.MANAGE_POLICY,
        payload,
        session.access_token
      );

      if (!result.success) throw new Error(result.error || result.message || 'Failed to save policy');
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={existingPolicy ? 'Edit Leave Policy' : 'Configure New Policy'} maxWidth="max-w-4xl">
      <div className="h-[70vh] flex flex-col">
        {error && <div className="p-3 mb-2 bg-red-100 text-red-700 rounded text-sm">{error}</div>}

        <Tabs>
          {/* TAB 1: GENERAL */}
          <Tabs.Tab label="General">
            <div className="grid grid-cols-2 gap-4 p-4">
              <div>
                <label className="block text-sm font-medium mb-1">Leave Type *</label>
                <select
                  className="w-full border rounded p-2"
                  value={formData.leave_type_id}
                  onChange={e => handleFormChange('leave_type_id', e.target.value)}
                  disabled={!!existingPolicy}
                >
                  <option value="">Select Type...</option>
                  {leaveTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.leave_type_name} ({t.leave_type_code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Policy Name *</label>
                <Input value={formData.policy_name} onChange={e => handleFormChange('policy_name', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Policy Code *</label>
                <Input
                  value={formData.policy_code}
                  onChange={e => handleFormChange('policy_code', e.target.value)}
                  disabled={!!existingPolicy}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                {existingPolicy ? (
                  <div className="p-2 border rounded bg-gray-50 text-sm">
                    <span className={existingPolicy.is_active ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                      {existingPolicy.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-gray-500 ml-1">({existingPolicy.policy_status})</span>
                    <span className="text-xs text-gray-400 block mt-1">Use Activate/Deactivate in the table to change status</span>
                  </div>
                ) : (
                  <select
                    className="w-full border rounded p-2"
                    value={formData.policy_status}
                    onChange={e => handleFormChange('policy_status', e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                  </select>
                )}
              </div>
            </div>
          </Tabs.Tab>

          {/* TAB 2: ACCRUAL & BALANCE */}
          <Tabs.Tab label="Accrual & Balance">
            <div className="p-4 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 uppercase mb-1">Frequency</label>
                  <select
                    className="w-full border rounded p-2 text-sm"
                    value={formData.accrual_type}
                    onChange={e => handleFormChange('accrual_type', e.target.value as any)}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual (Start of Year)</option>
                    <option value="none">Manual / No Accrual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase mb-1">Annual Quota (Days)</label>
                  <Input type="number" value={formData.annual_quota} onChange={e => handleFormChange('annual_quota', Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase mb-1">Year End Processing</label>
                  <select
                    className="w-full border rounded p-2 text-sm"
                    value={formData.carryforward_type}
                    onChange={e => handleFormChange('carryforward_type', e.target.value as any)}
                  >
                    <option value="lapse">Lapse (Forfeit Unused)</option>
                    <option value="carry_forward">Carry Forward</option>
                  </select>
                </div>
              </div>

              {formData.carryforward_type === 'carry_forward' && (
                <div className="grid grid-cols-2 gap-4 bg-blue-50 p-3 rounded border border-blue-100">
                  <div>
                    <label className="block text-xs text-gray-500 uppercase mb-1">Max Carry Forward Days</label>
                    <Input
                      type="number"
                      value={formData.max_carryforward_days ?? ''}
                      onChange={e => handleFormChange('max_carryforward_days', e.target.value ? Number(e.target.value) : null)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase mb-1">Carry Forward Expiry (Months)</label>
                    <Input
                      type="number"
                      value={formData.carryforward_expiry_months ?? ''}
                      onChange={e => handleFormChange('carryforward_expiry_months', e.target.value ? Number(e.target.value) : null)}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 border p-3 rounded">
                  <input type="checkbox" checked={rules.accrual.prorate_joining} onChange={e => updateRule('accrual', 'prorate_joining', e.target.checked)} />
                  <span className="text-sm">Prorate on Joining</span>
                </label>
                <label className="flex items-center gap-2 border p-3 rounded">
                  <input type="checkbox" checked={rules.accrual.prorate_leaving} onChange={e => updateRule('accrual', 'prorate_leaving', e.target.checked)} />
                  <span className="text-sm">Prorate on Leaving</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 border p-3 rounded">
                  <input type="checkbox" checked={rules.balance_management.encashment_allowed} onChange={e => updateRule('balance_management', 'encashment_allowed', e.target.checked)} />
                  <span className="text-sm">Encashment Allowed</span>
                </label>
                <label className="flex items-center gap-2 border p-3 rounded">
                  <input type="checkbox" checked={rules.year_end_processing.encash_excess} onChange={e => updateRule('year_end_processing', 'encash_excess', e.target.checked)} />
                  <span className="text-sm">Encash Excess on Year End</span>
                </label>
              </div>
            </div>
          </Tabs.Tab>

          {/* TAB 3: WORKFLOW */}
          <Tabs.Tab label="Workflow & Escalation">
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 uppercase mb-1">Approval Levels</label>
                  <Input type="number" min="0" max="5" value={formData.approval_levels} onChange={e => handleFormChange('approval_levels', Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase mb-1">Escalation After (Hours)</label>
                  <Input type="number" value={formData.escalation_hours} onChange={e => handleFormChange('escalation_hours', Number(e.target.value))} />
                  <p className="text-xs text-gray-500 mt-1">Request escalates to next level if not acted upon in this time.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 uppercase mb-1">Min Leave Duration</label>
                  <select
                    className="w-full border rounded p-2 text-sm"
                    value={formData.min_duration}
                    onChange={e => handleFormChange('min_duration', Number(e.target.value))}
                  >
                    <option value={0.5}>0.5 Days (Half Day Allowed)</option>
                    <option value={1}>1.0 Day (Full Day Only)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase mb-1">Min Service Required (Months)</label>
                  <Input type="number" min="0" value={formData.min_service_months} onChange={e => handleFormChange('min_service_months', Number(e.target.value))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 border p-3 rounded">
                  <input type="checkbox" checked={rules.approval_workflow.auto_approve_if_no_manager} onChange={e => updateRule('approval_workflow', 'auto_approve_if_no_manager', e.target.checked)} />
                  <span className="text-sm">Auto-approve if no manager</span>
                </label>
                <label className="flex items-center gap-2 border p-3 rounded">
                  <input type="checkbox" checked={rules.approval_workflow.delegate_approval_allowed} onChange={e => updateRule('approval_workflow', 'delegate_approval_allowed', e.target.checked)} />
                  <span className="text-sm">Allow Delegate Approval</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 border p-3 rounded">
                  <input type="checkbox" checked={rules.application_rules.requires_approval} onChange={e => updateRule('application_rules', 'requires_approval', e.target.checked)} />
                  <span className="text-sm">Requires Approval</span>
                </label>
                <label className="flex items-center gap-2 border p-3 rounded">
                  <input type="checkbox" checked={rules.approval_workflow.bulk_approval_allowed} onChange={e => updateRule('approval_workflow', 'bulk_approval_allowed', e.target.checked)} />
                  <span className="text-sm">Allow Bulk Approval</span>
                </label>
              </div>
            </div>
          </Tabs.Tab>

          {/* TAB 4: ADVANCED RULES */}
          <Tabs.Tab label="Advanced Rules">
            <div className="p-4 space-y-4 h-full overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 border p-3 rounded">
                  <input type="checkbox" checked={rules.application_rules.allow_negative_balance} onChange={e => updateRule('application_rules', 'allow_negative_balance', e.target.checked)} />
                  <span className="text-sm">Allow Negative Balance</span>
                </label>
                <label className="flex items-center gap-2 border p-3 rounded">
                  <input type="checkbox" checked={rules.application_rules.working_days_only} onChange={e => updateRule('application_rules', 'working_days_only', e.target.checked)} />
                  <span className="text-sm">Working Days Only</span>
                </label>
              </div>

              {rules.application_rules.allow_negative_balance && (
                <div>
                  <label className="block text-xs text-gray-500 uppercase mb-1">Max Negative Balance (Days)</label>
                  <Input type="number" min="0" value={rules.application_rules.max_negative_balance} onChange={e => updateRule('application_rules', 'max_negative_balance', Number(e.target.value))} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 uppercase mb-1">Max Leave Duration (Days)</label>
                  <Input type="number" value={rules.application_rules.max_duration} onChange={e => updateRule('application_rules', 'max_duration', Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase mb-1">Min Days Notice</label>
                  <Input type="number" min="0" value={rules.application_rules.min_days_notice} onChange={e => updateRule('application_rules', 'min_days_notice', Number(e.target.value))} />
                </div>
              </div>

              <div className="bg-indigo-50 p-4 rounded border border-indigo-200">
                <h4 className="font-bold text-indigo-800 text-sm mb-2">Sandwich Leave Policy</h4>
                <select
                  className="w-full border border-indigo-300 rounded p-2 text-sm"
                  value={formData.sandwich_leave_policy}
                  onChange={e => handleFormChange('sandwich_leave_policy', e.target.value)}
                >
                  <option value="include">Include (Count weekends/holidays between leaves)</option>
                  <option value="exclude">Exclude (Don&apos;t count weekends/holidays)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 border p-3 rounded">
                  <input type="checkbox" checked={rules.application_rules.weekends_and_holidays_deducted} onChange={e => updateRule('application_rules', 'weekends_and_holidays_deducted', e.target.checked)} />
                  <span className="text-sm">Deduct Weekends & Holidays</span>
                </label>
                <label className="flex items-center gap-2 border p-3 rounded">
                  <input type="checkbox" checked={rules.integration_rules.sync_to_attendance} onChange={e => updateRule('integration_rules', 'sync_to_attendance', e.target.checked)} />
                  <span className="text-sm">Sync to Attendance</span>
                </label>
              </div>
            </div>
          </Tabs.Tab>

        </Tabs>

        {/* Footer Actions */}
        <div className="p-4 border-t flex justify-end gap-3 mt-auto bg-white sticky bottom-0">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={submitting}>Save Policy</Button>
        </div>

      </div>
    </Modal>
  );
}
