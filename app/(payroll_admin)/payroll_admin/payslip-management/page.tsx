"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  FileText,
  Play,
  RefreshCw,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  RotateCcw,
  Users,
  BarChart3,
  Activity,
  Zap,
  TrendingUp,
  Calendar,
  X,
} from "lucide-react";

// Types based on backend tables
interface PayslipRun {
  id: string;
  tenant_id: string;
  payroll_batch_id: string;
  total_employees: number;
  processed_count: number;
  succeeded_count: number;
  failed_count: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "PARTIAL";
  started_at: string | null;
  completed_at: string | null;
  estimated_completion_at: string | null;
  created_by: string;
  avg_processing_time_ms: number | null;
  error_summary: Record<string, any> | null;
  created_at: string;
  // Joined fields
  batch_name?: string;
  payroll_period?: string;
}

interface PayslipQueueItem {
  id: string;
  run_id: string;
  user_id: string;
  status: "PENDING" | "CLAIMED" | "PROCESSING" | "COMPLETED" | "FAILED";
  idempotency_key: string;
  worker_id: string | null;
  claimed_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  storage_path: string | null;
  file_version: number;
  file_size_bytes: number | null;
  file_hash: string | null;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  error_details: Record<string, any> | null;
  error_type: string | null;
  processing_time_ms: number | null;
  created_at: string;
  // Joined fields
  employee_name?: string;
  employee_code?: string;
}

interface DeadLetterItem {
  id: string;
  original_queue_item_id: string;
  run_id: string;
  user_id: string;
  tenant_id: string;
  final_error_message: string;
  error_history: Record<string, any>[];
  total_attempts: number;
  resolution_status: "UNRESOLVED" | "RESOLVED" | "IGNORED";
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  // Joined fields
  employee_name?: string;
}

interface PerformanceMetrics {
  id: string;
  hour_bucket: string;
  tenant_id: string;
  total_processed: number;
  total_succeeded: number;
  total_failed: number;
  avg_processing_time_ms: number;
  p50_processing_time_ms: number;
  p95_processing_time_ms: number;
  p99_processing_time_ms: number;
}

interface PayrollBatch {
  id: string;
  batch_name: string;
  payroll_period: string;
  status: string;
}

// Status badge component
const StatusBadge: React.FC<{ status: string; type?: "run" | "queue" | "dead" }> = ({
  status,
  type = "run",
}) => {
  const getStatusConfig = () => {
    const statusUpper = status?.toUpperCase() || "UNKNOWN";

    if (type === "run") {
      switch (statusUpper) {
        case "PENDING":
          return { bg: "bg-yellow-100", text: "text-yellow-800", icon: Clock };
        case "IN_PROGRESS":
          return { bg: "bg-blue-100", text: "text-blue-800", icon: Loader2 };
        case "COMPLETED":
          return { bg: "bg-green-100", text: "text-green-800", icon: CheckCircle };
        case "FAILED":
          return { bg: "bg-red-100", text: "text-red-800", icon: XCircle };
        case "PARTIAL":
          return { bg: "bg-orange-100", text: "text-orange-800", icon: AlertTriangle };
        default:
          return { bg: "bg-gray-100", text: "text-gray-800", icon: Clock };
      }
    } else if (type === "queue") {
      switch (statusUpper) {
        case "PENDING":
          return { bg: "bg-gray-100", text: "text-gray-800", icon: Clock };
        case "CLAIMED":
          return { bg: "bg-purple-100", text: "text-purple-800", icon: Zap };
        case "PROCESSING":
          return { bg: "bg-blue-100", text: "text-blue-800", icon: Loader2 };
        case "COMPLETED":
          return { bg: "bg-green-100", text: "text-green-800", icon: CheckCircle };
        case "FAILED":
          return { bg: "bg-red-100", text: "text-red-800", icon: XCircle };
        default:
          return { bg: "bg-gray-100", text: "text-gray-800", icon: Clock };
      }
    } else {
      switch (statusUpper) {
        case "UNRESOLVED":
          return { bg: "bg-red-100", text: "text-red-800", icon: XCircle };
        case "RESOLVED":
          return { bg: "bg-green-100", text: "text-green-800", icon: CheckCircle };
        case "IGNORED":
          return { bg: "bg-gray-100", text: "text-gray-800", icon: AlertTriangle };
        default:
          return { bg: "bg-gray-100", text: "text-gray-800", icon: Clock };
      }
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      <Icon className={`w-3 h-3 ${statusUpper === "IN_PROGRESS" || statusUpper === "PROCESSING" ? "animate-spin" : ""}`} />
      {status}
    </span>
  );
};

// Progress bar component
const ProgressBar: React.FC<{
  processed: number;
  total: number;
  succeeded: number;
  failed: number;
}> = ({ processed, total, succeeded, failed }) => {
  const successPercent = total > 0 ? (succeeded / total) * 100 : 0;
  const failedPercent = total > 0 ? (failed / total) * 100 : 0;
  const pendingPercent = total > 0 ? ((total - processed) / total) * 100 : 100;

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{processed} / {total} processed</span>
        <span>{Math.round((processed / total) * 100 || 0)}%</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${successPercent}%` }}
        />
        <div
          className="h-full bg-red-500 transition-all duration-300"
          style={{ width: `${failedPercent}%` }}
        />
        <div
          className="h-full bg-gray-300 transition-all duration-300"
          style={{ width: `${pendingPercent}%` }}
        />
      </div>
      <div className="flex justify-between text-xs mt-1">
        <span className="text-green-600">{succeeded} succeeded</span>
        <span className="text-red-600">{failed} failed</span>
      </div>
    </div>
  );
};

// Tab button component
const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  count?: number;
}> = ({ active, onClick, icon: Icon, label, count }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
      active
        ? "border-blue-500 text-blue-600"
        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
    }`}
  >
    <Icon className="w-4 h-4" />
    <span>{label}</span>
    {count !== undefined && count > 0 && (
      <span className={`px-2 py-0.5 rounded-full text-xs ${
        active ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"
      }`}>
        {count}
      </span>
    )}
  </button>
);

export default function PayslipManagementPage() {
  const supabase = createClient();

  // Tab state
  const [activeTab, setActiveTab] = useState<"runs" | "queue" | "deadletter" | "metrics">("runs");

  // Data states
  const [payslipRuns, setPayslipRuns] = useState<PayslipRun[]>([]);
  const [queueItems, setQueueItems] = useState<PayslipQueueItem[]>([]);
  const [deadLetterItems, setDeadLetterItems] = useState<DeadLetterItem[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics[]>([]);
  const [completedBatches, setCompletedBatches] = useState<PayrollBatch[]>([]);

  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<PayslipRun | null>(null);
  const [selectedQueueItem, setSelectedQueueItem] = useState<PayslipQueueItem | null>(null);
  const [selectedDeadLetter, setSelectedDeadLetter] = useState<DeadLetterItem | null>(null);

  // Filter states
  const [runStatusFilter, setRunStatusFilter] = useState<string>("all");
  const [queueStatusFilter, setQueueStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Modal states
  const [showInitiateModal, setShowInitiateModal] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [initiating, setInitiating] = useState(false);

  // Polling state for live updates
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Fetch payslip runs
  const fetchPayslipRuns = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("a_crud_universal_read", {
        body: {
          config_id: "d9e8f7a6-5b4c-3d2e-1f0a-9b8c7d6e5f4a",
          filters: runStatusFilter !== "all" ? { status: runStatusFilter } : {},
          order_by: "created_at",
          order_direction: "desc",
          page: 1,
          page_size: 100,
        },
      });

      if (error) throw error;
      setPayslipRuns(data?.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch payslip runs");
    } finally {
      setLoading(false);
    }
  }, [supabase, runStatusFilter]);

  // Fetch queue items for selected run
  const fetchQueueItems = useCallback(async (runId?: string) => {
    try {
      setLoading(true);
      const filters: Record<string, any> = {};
      if (runId) filters.run_id = runId;
      if (queueStatusFilter !== "all") filters.status = queueStatusFilter;

      const { data, error } = await supabase.functions.invoke("a_crud_universal_read", {
        body: {
          config_id: "e0f9a8b7-6c5d-4e3f-2a1b-0c9d8e7f6a5b",
          filters,
          order_by: "created_at",
          order_direction: "desc",
          page: 1,
          page_size: 200,
        },
      });

      if (error) throw error;
      setQueueItems(data?.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch queue items");
    } finally {
      setLoading(false);
    }
  }, [supabase, queueStatusFilter]);

  // Fetch dead letter items
  const fetchDeadLetterItems = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("wcm_payslip_dead_letter_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setDeadLetterItems(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch dead letter items");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Fetch performance metrics
  const fetchPerformanceMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("wcm_payslip_performance_metrics")
        .select("*")
        .order("hour_bucket", { ascending: false })
        .limit(24);

      if (error) throw error;
      setPerformanceMetrics(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch performance metrics");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Fetch completed payroll batches for initiation
  const fetchCompletedBatches = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("wcm_payroll_processing_batches")
        .select("id, batch_name, payroll_period, status")
        .eq("status", "COMPLETED")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setCompletedBatches(data || []);
    } catch (err: any) {
      console.error("Failed to fetch completed batches:", err);
    }
  }, [supabase]);

  // Initiate payslip generation
  const initiatePayslipGeneration = async () => {
    if (!selectedBatchId) {
      setError("Please select a payroll batch");
      return;
    }

    try {
      setInitiating(true);
      const { data, error } = await supabase.rpc("wcm_initiate_payslip_generation", {
        p_batch_id: selectedBatchId,
        p_force_regenerate: forceRegenerate,
      });

      if (error) throw error;

      setShowInitiateModal(false);
      setSelectedBatchId("");
      setForceRegenerate(false);
      fetchPayslipRuns();
    } catch (err: any) {
      setError(err.message || "Failed to initiate payslip generation");
    } finally {
      setInitiating(false);
    }
  };

  // Trigger worker manually
  const triggerWorker = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("wcm-payslip-global-worker", {
        body: {},
      });

      if (error) throw error;

      // Refresh data after triggering
      setTimeout(() => {
        fetchPayslipRuns();
        if (selectedRun) fetchQueueItems(selectedRun.id);
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to trigger worker");
    } finally {
      setLoading(false);
    }
  };

  // Download payslip
  const downloadPayslip = async (storagePath: string, employeeName?: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("company_documents")
        .download(storagePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = employeeName ? `Payslip_${employeeName}.pdf` : "Payslip.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "Failed to download payslip");
    }
  };

  // Retry failed item
  const retryFailedItem = async (queueItemId: string) => {
    try {
      setLoading(true);
      // Reset the queue item to PENDING status
      const { error } = await supabase
        .from("wcm_payslip_queue_items")
        .update({
          status: "PENDING",
          error_message: null,
          error_details: null,
          error_type: null,
          worker_id: null,
          claimed_at: null,
          started_at: null,
        })
        .eq("id", queueItemId);

      if (error) throw error;

      fetchQueueItems(selectedRun?.id);
    } catch (err: any) {
      setError(err.message || "Failed to retry item");
    } finally {
      setLoading(false);
    }
  };

  // Mark dead letter as resolved
  const resolveDeadLetter = async (id: string, resolution: "RESOLVED" | "IGNORED") => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from("wcm_payslip_dead_letter_queue")
        .update({
          resolution_status: resolution,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      fetchDeadLetterItems();
    } catch (err: any) {
      setError(err.message || "Failed to update dead letter item");
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchPayslipRuns();
    fetchCompletedBatches();
  }, [fetchPayslipRuns, fetchCompletedBatches]);

  // Fetch tab-specific data
  useEffect(() => {
    switch (activeTab) {
      case "runs":
        fetchPayslipRuns();
        break;
      case "queue":
        fetchQueueItems(selectedRun?.id);
        break;
      case "deadletter":
        fetchDeadLetterItems();
        break;
      case "metrics":
        fetchPerformanceMetrics();
        break;
    }
  }, [activeTab, fetchPayslipRuns, fetchQueueItems, fetchDeadLetterItems, fetchPerformanceMetrics, selectedRun]);

  // Auto-refresh for live monitoring
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      if (activeTab === "runs") fetchPayslipRuns();
      if (activeTab === "queue" && selectedRun) fetchQueueItems(selectedRun.id);
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, selectedRun, fetchPayslipRuns, fetchQueueItems]);

  // Filter queue items by search
  const filteredQueueItems = useMemo(() => {
    if (!searchTerm) return queueItems;
    const term = searchTerm.toLowerCase();
    return queueItems.filter(
      (item) =>
        item.user_id?.toLowerCase().includes(term) ||
        item.employee_name?.toLowerCase().includes(term) ||
        item.employee_code?.toLowerCase().includes(term)
    );
  }, [queueItems, searchTerm]);

  // Calculate summary stats
  const runStats = useMemo(() => {
    const inProgress = payslipRuns.filter((r) => r.status === "IN_PROGRESS").length;
    const failed = payslipRuns.filter((r) => r.status === "FAILED" || r.status === "PARTIAL").length;
    return { inProgress, failed };
  }, [payslipRuns]);

  const deadLetterCount = useMemo(() => {
    return deadLetterItems.filter((d) => d.resolution_status === "UNRESOLVED").length;
  }, [deadLetterItems]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-7 h-7 text-blue-600" />
              Payslip Management
            </h1>
            <p className="text-gray-600 mt-1">
              Generate, monitor, and manage employee payslips
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300"
              />
              Auto-refresh
            </label>
            <button
              onClick={triggerWorker}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              Trigger Worker
            </button>
            <button
              onClick={() => setShowInitiateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Play className="w-4 h-4" />
              Generate Payslips
            </button>
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="border-b border-gray-200 px-4 flex">
          <TabButton
            active={activeTab === "runs"}
            onClick={() => setActiveTab("runs")}
            icon={FileText}
            label="Payslip Runs"
            count={runStats.inProgress}
          />
          <TabButton
            active={activeTab === "queue"}
            onClick={() => setActiveTab("queue")}
            icon={Users}
            label="Queue Monitor"
          />
          <TabButton
            active={activeTab === "deadletter"}
            onClick={() => setActiveTab("deadletter")}
            icon={AlertTriangle}
            label="Dead Letter Queue"
            count={deadLetterCount}
          />
          <TabButton
            active={activeTab === "metrics"}
            onClick={() => setActiveTab("metrics")}
            icon={BarChart3}
            label="Performance"
          />
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Payslip Runs Tab */}
          {activeTab === "runs" && (
            <div>
              {/* Filters */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <select
                    value={runStatusFilter}
                    onChange={(e) => setRunStatusFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="all">All Statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="FAILED">Failed</option>
                    <option value="PARTIAL">Partial</option>
                  </select>
                </div>
                <button
                  onClick={() => fetchPayslipRuns()}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>

              {/* Runs Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Batch</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Period</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Progress</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Started</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Avg Time</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payslipRuns.map((run) => (
                      <tr
                        key={run.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${
                          selectedRun?.id === run.id ? "bg-blue-50" : ""
                        }`}
                      >
                        <td className="py-3 px-4">
                          <span className="font-medium text-gray-900">
                            {run.batch_name || run.payroll_batch_id.substring(0, 8)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {run.payroll_period || "-"}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={run.status} type="run" />
                        </td>
                        <td className="py-3 px-4 min-w-[200px]">
                          <ProgressBar
                            processed={run.processed_count}
                            total={run.total_employees}
                            succeeded={run.succeeded_count}
                            failed={run.failed_count}
                          />
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {run.started_at
                            ? new Date(run.started_at).toLocaleString()
                            : "-"}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {run.avg_processing_time_ms
                            ? `${run.avg_processing_time_ms.toFixed(0)}ms`
                            : "-"}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedRun(run);
                                setActiveTab("queue");
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                              title="View Queue"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {(run.status === "FAILED" || run.status === "PARTIAL") && (
                              <button
                                onClick={() => {
                                  setSelectedBatchId(run.payroll_batch_id);
                                  setForceRegenerate(true);
                                  setShowInitiateModal(true);
                                }}
                                className="p-2 text-orange-600 hover:bg-orange-50 rounded"
                                title="Retry Failed"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {payslipRuns.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-500">
                          No payslip runs found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Queue Monitor Tab */}
          {activeTab === "queue" && (
            <div>
              {/* Selected Run Info */}
              {selectedRun && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-blue-600">Viewing queue for:</span>
                      <h3 className="font-medium text-blue-900">
                        {selectedRun.batch_name || selectedRun.payroll_batch_id}
                      </h3>
                    </div>
                    <button
                      onClick={() => setSelectedRun(null)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Filters */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by employee..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <select
                  value={queueStatusFilter}
                  onChange={(e) => setQueueStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="all">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="CLAIMED">Claimed</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="FAILED">Failed</option>
                </select>
                <button
                  onClick={() => fetchQueueItems(selectedRun?.id)}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {/* Queue Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Employee</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Worker</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Retries</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Processing Time</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">File</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQueueItems.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <span className="font-medium text-gray-900">
                              {item.employee_name || item.user_id.substring(0, 8)}
                            </span>
                            {item.employee_code && (
                              <span className="text-sm text-gray-500 ml-2">
                                ({item.employee_code})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={item.status} type="queue" />
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {item.worker_id?.substring(0, 8) || "-"}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <span className={item.retry_count > 0 ? "text-orange-600" : "text-gray-600"}>
                            {item.retry_count} / {item.max_retries}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {item.processing_time_ms ? `${item.processing_time_ms}ms` : "-"}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {item.storage_path ? (
                            <span className="text-green-600">
                              {(item.file_size_bytes || 0) > 1024
                                ? `${((item.file_size_bytes || 0) / 1024).toFixed(1)}KB`
                                : `${item.file_size_bytes || 0}B`}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {item.storage_path && (
                              <button
                                onClick={() => downloadPayslip(item.storage_path!, item.employee_name)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                title="Download"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            )}
                            {item.status === "FAILED" && (
                              <button
                                onClick={() => retryFailedItem(item.id)}
                                className="p-2 text-orange-600 hover:bg-orange-50 rounded"
                                title="Retry"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            {item.error_message && (
                              <button
                                onClick={() => setSelectedQueueItem(item)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded"
                                title="View Error"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredQueueItems.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-500">
                          {selectedRun
                            ? "No queue items found for this run"
                            : "Select a payslip run to view queue items"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Dead Letter Queue Tab */}
          {activeTab === "deadletter" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">
                  Failed Items Requiring Attention
                </h3>
                <button
                  onClick={fetchDeadLetterItems}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>

              <div className="space-y-4">
                {deadLetterItems.map((item) => (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-4 ${
                      item.resolution_status === "UNRESOLVED"
                        ? "border-red-200 bg-red-50"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <StatusBadge status={item.resolution_status} type="dead" />
                          <span className="text-sm text-gray-600">
                            {item.total_attempts} attempts
                          </span>
                        </div>
                        <p className="font-medium text-gray-900 mb-1">
                          Employee: {item.employee_name || item.user_id}
                        </p>
                        <p className="text-sm text-red-700 mb-2">
                          {item.final_error_message}
                        </p>
                        <p className="text-xs text-gray-500">
                          Created: {new Date(item.created_at).toLocaleString()}
                        </p>
                      </div>
                      {item.resolution_status === "UNRESOLVED" && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedDeadLetter(item)}
                            className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-100 rounded"
                          >
                            View Details
                          </button>
                          <button
                            onClick={() => resolveDeadLetter(item.id, "RESOLVED")}
                            className="px-3 py-1 text-sm text-green-600 hover:bg-green-100 rounded"
                          >
                            Mark Resolved
                          </button>
                          <button
                            onClick={() => resolveDeadLetter(item.id, "IGNORED")}
                            className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-200 rounded"
                          >
                            Ignore
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {deadLetterItems.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No dead letter items found
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Performance Metrics Tab */}
          {activeTab === "metrics" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-medium text-gray-900">Processing Performance (Last 24 Hours)</h3>
                <button
                  onClick={fetchPerformanceMetrics}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                {(() => {
                  const totals = performanceMetrics.reduce(
                    (acc, m) => ({
                      processed: acc.processed + m.total_processed,
                      succeeded: acc.succeeded + m.total_succeeded,
                      failed: acc.failed + m.total_failed,
                      avgTime:
                        acc.avgTime +
                        m.avg_processing_time_ms * m.total_processed,
                    }),
                    { processed: 0, succeeded: 0, failed: 0, avgTime: 0 }
                  );
                  const avgTime =
                    totals.processed > 0
                      ? totals.avgTime / totals.processed
                      : 0;

                  return (
                    <>
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="w-5 h-5 text-blue-600" />
                          <span className="text-sm text-gray-600">Total Processed</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">
                          {totals.processed.toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="text-sm text-gray-600">Succeeded</span>
                        </div>
                        <p className="text-2xl font-bold text-green-600">
                          {totals.succeeded.toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="w-5 h-5 text-red-600" />
                          <span className="text-sm text-gray-600">Failed</span>
                        </div>
                        <p className="text-2xl font-bold text-red-600">
                          {totals.failed.toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-5 h-5 text-purple-600" />
                          <span className="text-sm text-gray-600">Avg Time</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-600">
                          {avgTime.toFixed(0)}ms
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Metrics Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Hour</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">Processed</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">Succeeded</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">Failed</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">Avg (ms)</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">P50 (ms)</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">P95 (ms)</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">P99 (ms)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceMetrics.map((metric) => (
                      <tr key={metric.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-900">
                          {new Date(metric.hour_bucket).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          {metric.total_processed}
                        </td>
                        <td className="py-3 px-4 text-right text-green-600">
                          {metric.total_succeeded}
                        </td>
                        <td className="py-3 px-4 text-right text-red-600">
                          {metric.total_failed}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          {metric.avg_processing_time_ms?.toFixed(0) || "-"}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          {metric.p50_processing_time_ms?.toFixed(0) || "-"}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          {metric.p95_processing_time_ms?.toFixed(0) || "-"}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          {metric.p99_processing_time_ms?.toFixed(0) || "-"}
                        </td>
                      </tr>
                    ))}
                    {performanceMetrics.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-500">
                          No performance metrics available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Initiate Payslip Generation Modal */}
      {showInitiateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Generate Payslips
              </h2>
              <button
                onClick={() => {
                  setShowInitiateModal(false);
                  setSelectedBatchId("");
                  setForceRegenerate(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Payroll Batch
                </label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">-- Select a completed batch --</option>
                  {completedBatches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.batch_name} - {batch.payroll_period}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="forceRegenerate"
                  checked={forceRegenerate}
                  onChange={(e) => setForceRegenerate(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="forceRegenerate" className="text-sm text-gray-700">
                  Force regenerate existing payslips
                </label>
              </div>
              {forceRegenerate && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  This will regenerate all payslips for this batch, including those already generated.
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowInitiateModal(false);
                  setSelectedBatchId("");
                  setForceRegenerate(false);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={initiatePayslipGeneration}
                disabled={!selectedBatchId || initiating}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {initiating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Start Generation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Queue Item Error Modal */}
      {selectedQueueItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Error Details</h2>
              <button
                onClick={() => setSelectedQueueItem(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Error Type</h4>
                  <p className="text-red-600">{selectedQueueItem.error_type || "Unknown"}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Error Message</h4>
                  <p className="text-red-700 bg-red-50 p-3 rounded-lg">
                    {selectedQueueItem.error_message}
                  </p>
                </div>
                {selectedQueueItem.error_details && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Error Details</h4>
                    <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
                      {JSON.stringify(selectedQueueItem.error_details, null, 2)}
                    </pre>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Retry Count:</span>
                    <span className="ml-2 font-medium">
                      {selectedQueueItem.retry_count} / {selectedQueueItem.max_retries}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Worker ID:</span>
                    <span className="ml-2 font-medium">
                      {selectedQueueItem.worker_id || "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setSelectedQueueItem(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
              {selectedQueueItem.status === "FAILED" && (
                <button
                  onClick={() => {
                    retryFailedItem(selectedQueueItem.id);
                    setSelectedQueueItem(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dead Letter Details Modal */}
      {selectedDeadLetter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Dead Letter Details</h2>
              <button
                onClick={() => setSelectedDeadLetter(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Employee</h4>
                  <p className="text-gray-900">
                    {selectedDeadLetter.employee_name || selectedDeadLetter.user_id}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Final Error</h4>
                  <p className="text-red-700 bg-red-50 p-3 rounded-lg">
                    {selectedDeadLetter.final_error_message}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">
                    Error History ({selectedDeadLetter.total_attempts} attempts)
                  </h4>
                  <div className="space-y-2">
                    {selectedDeadLetter.error_history?.map((err, idx) => (
                      <div key={idx} className="bg-gray-50 p-3 rounded-lg text-sm">
                        <pre className="whitespace-pre-wrap text-gray-700">
                          {JSON.stringify(err, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setSelectedDeadLetter(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
              {selectedDeadLetter.resolution_status === "UNRESOLVED" && (
                <>
                  <button
                    onClick={() => {
                      resolveDeadLetter(selectedDeadLetter.id, "IGNORED");
                      setSelectedDeadLetter(null);
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                  >
                    Ignore
                  </button>
                  <button
                    onClick={() => {
                      resolveDeadLetter(selectedDeadLetter.id, "RESOLVED");
                      setSelectedDeadLetter(null);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark Resolved
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
