'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Loader from '@/components/ui/Loader';
import Input from '@/components/ui/Input';
import Modal from '@/components/Modal';
import Tabs from '@/components/Tabs';
import { useExport } from '@/lib/useExport';

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================

// The Master Record (Lifecycle Manager)
interface PfArrearMaster {
    id: number;
    arrear_code: string;
    arrear_reason: string;
    arrear_period_start: string;
    arrear_period_end: string;
    total_affected_employees: number;
    approval_status: 'PENDING' | 'APPROVED' | 'PROCESSED' | 'REJECTED'; 
    interest_applicable: boolean;
    interest_rate: number;
    interest_calculation_method: 'SIMPLE' | 'COMPOUND' | 'FLAT';
    created_at: string;
    rejection_reason?: string;
    tenant_id: string; // Required for Upsert
}

// The Detail Record (Financial Liability)
interface PfArrearComputation {
    id: number;
    user_id: string; 
    emp_code: string; // Fetched via backend enrichment
    full_name: string; // Fetched via backend enrichment
    original_pf_wages: number;
    revised_pf_wages: number;
    differential_employee_contribution: number;
    differential_employer_contribution: number;
    interest_on_differential: number;
    total_arrear_amount: number;
}

// The Queue Record (For Progress Polling)
interface ArrearQueueItem {
    id: number;
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    total_employees_in_chunk: number;
    processed_count: number;
}

// ============================================================================
// 2. GATEWAY CONFIGURATIONS
// ============================================================================
const CONFIGS = {
    // Reads wcm_pf_arrear_master
    READ_ARREAR_MASTER: '9c4deacb-944b-4c33-b227-88f9b007a13e', 
    
    // Reads wcm_pf_arrear_computations (Enriched)
    READ_ARREAR_DETAILS: 'e5f6a7b8-c9d0-1234-5678-90abcdef1234', 
    
    // Function: Splits users & inserts into Queue table
    TRIGGER_ASYNC_JOB: 'wcm-pf-queue-arrear-jobs', 
    
    // Reads wcm_pf_arrear_processing_queue
    READ_QUEUE_STATUS: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    
    // Updates Status/Policy (Master Table)
    UPSERT_ARREAR: '00b26868-3940-46f4-9cd6-420450f3e660', 
    
    // Export Job Config
    EXPORT_ARREAR: 'wcm-pf-export-arrear-breakdown' 
};

// ============================================================================
// 3. HELPER FUNCTIONS
// ============================================================================
async function callGateway(endpoint: string, payload: any, token: string) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, accessToken: token }),
    });
    const result = await response.json();
    if (!response.ok || (result.hasOwnProperty('success') && !result.success)) {
        throw new Error(result.message || result.error || 'API Request Failed');
    }
    return result;
}

const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);

// ============================================================================
// 4. MAIN COMPONENT
// ============================================================================
export default function PfArrearsProcessingPage() {
    const { session } = useSessionContext();
    const accessToken = session?.access_token;

    // --- Data State ---
    const [arrears, setArrears] = useState<PfArrearMaster[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- Modal State ---
    const [selectedArrear, setSelectedArrear] = useState<PfArrearMaster | null>(null);
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);
    
    // --- Processing State (Async) ---
    const [isProcessingModalOpen, setIsProcessingModalOpen] = useState(false);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [processingStatus, setProcessingStatus] = useState<string>('Initializing...');
    
    // --- Detail State ---
    const [computations, setComputations] = useState<PfArrearComputation[]>([]);
    const [breakdownLoading, setBreakdownLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // --- Policy Form State ---
    const [policyForm, setPolicyForm] = useState({
        interest_applicable: true,
        interest_rate: 12,
        method: 'SIMPLE',
        remarks: ''
    });

    // ------------------------------------------------------------------------
    // DATA FETCHING
    // ------------------------------------------------------------------------
    const fetchArrears = useCallback(async () => {
        if (!accessToken) return;
        setLoading(true);
        try {
            const response = await callGateway('/api/a_crud_universal_read', {
                config_id: CONFIGS.READ_ARREAR_MASTER,
                params: { 
                    limit: 100, 
                    orderBy: [{ column: 'created_at', ascending: false }] 
                }
            }, accessToken);
            setArrears(response.data || []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [accessToken]);

    useEffect(() => {
        if (accessToken) fetchArrears();
    }, [accessToken, fetchArrears]);

    // ------------------------------------------------------------------------
    // ACTION 1: POLICY REVIEW (Pending -> Approved)
    // ------------------------------------------------------------------------
    const openApprovalModal = (arrear: PfArrearMaster) => {
        setSelectedArrear(arrear);
        setPolicyForm({
            interest_applicable: arrear.interest_applicable ?? true,
            interest_rate: arrear.interest_rate || 12,
            method: arrear.interest_calculation_method || 'SIMPLE',
            remarks: ''
        });
        setIsApprovalModalOpen(true);
    };

    const handleApprovalDecision = async (status: 'APPROVED' | 'REJECTED') => {
        if (!accessToken || !selectedArrear) return;
        
        if (status === 'REJECTED' && !policyForm.remarks) {
            alert('Please provide rejection remarks');
            return;
        }

        setActionLoading(true);
        try {
            const payload = [{
                id: selectedArrear.id,
                tenant_id: selectedArrear.tenant_id,
                arrear_code: selectedArrear.arrear_code, // Conflict Key
                approval_status: status,
                rejection_reason: status === 'REJECTED' ? policyForm.remarks : null,
                interest_applicable: policyForm.interest_applicable,
                interest_rate: policyForm.interest_rate,
                interest_calculation_method: policyForm.method,
                approved_by: session!.user.id,
                approved_at: new Date().toISOString()
            }];

            await callGateway('/api/a_crud_universal_bulk_upsert', {
                config_id: CONFIGS.UPSERT_ARREAR,
                input_rows: payload
            }, accessToken);

            setIsApprovalModalOpen(false);
            fetchArrears();
        } catch (e: any) {
            alert(`Action failed: ${e.message}`);
        } finally {
            setActionLoading(false);
        }
    };

    // ------------------------------------------------------------------------
    // ACTION 2: ASYNC EXECUTION (Approved -> Processing -> Processed)
    // ------------------------------------------------------------------------
    const handleProcessAsync = async (arrear: PfArrearMaster) => {
        if (!accessToken) return;
        
        // 1. Start the Job (Splitter Function)
        setIsProcessingModalOpen(true);
        setProcessingStatus('Queueing jobs...');
        setProcessingProgress(0);
        setSelectedArrear(arrear);

        try {
            await callGateway('/api/a_crud_universal_pg_function_gateway', {
                config_id: CONFIGS.TRIGGER_ASYNC_JOB,
                params: { p_arrear_master_id: arrear.id }
            }, accessToken);

            // 2. Start Polling
            pollQueueStatus(arrear.id);

        } catch (e: any) {
            setProcessingStatus('Failed to start');
            alert(`Start failed: ${e.message}`);
            setIsProcessingModalOpen(false);
        }
    };

    const pollQueueStatus = async (arrearId: number) => {
        const intervalId = setInterval(async () => {
            try {
                // Fetch queue status for this master ID
                const response = await callGateway('/api/a_crud_universal_read', {
                    config_id: CONFIGS.READ_QUEUE_STATUS,
                    params: { filters: { arrear_master_id: arrearId } }
                }, accessToken!);

                const jobs = response.data as ArrearQueueItem[];
                
                if (jobs.length === 0) {
                    // No jobs found might mean they haven't been created yet or are cleaned up
                    setProcessingStatus('Waiting for worker...');
                    return;
                }

                // Calculate total progress
                const totalJobs = jobs.length;
                const completedJobs = jobs.filter(j => j.status === 'COMPLETED').length;
                const failedJobs = jobs.filter(j => j.status === 'FAILED').length;
                
                const percentage = Math.round((completedJobs / totalJobs) * 100);
                setProcessingProgress(percentage);
                setProcessingStatus(`Processed ${completedJobs} / ${totalJobs} batches...`);

                // Check for completion
                if (completedJobs + failedJobs === totalJobs) {
                    clearInterval(intervalId);
                    
                    if (failedJobs > 0) {
                        alert(`Processing finished with ${failedJobs} failed batches. Check logs.`);
                        setIsProcessingModalOpen(false);
                    } else {
                        // All Success -> Update Master Status to PROCESSED
                        await markArrearAsProcessed(arrearId);
                    }
                }

            } catch (e) {
                console.error("Polling error", e);
                // Don't clear interval on transient network error, keep trying
            }
        }, 3000); // Check every 3 seconds
    };

    const markArrearAsProcessed = async (arrearId: number) => {
        setProcessingStatus('Finalizing...');
        if (!selectedArrear || !accessToken) return;

        try {
            await callGateway('/api/a_crud_universal_bulk_upsert', {
                config_id: CONFIGS.UPSERT_ARREAR,
                input_rows: [{
                    id: arrearId,
                    tenant_id: selectedArrear.tenant_id,
                    arrear_code: selectedArrear.arrear_code,
                    approval_status: 'PROCESSED'
                }]
            }, accessToken);

            setIsProcessingModalOpen(false);
            fetchArrears(); // Refresh main list
            alert('Arrear processing completed successfully.');
        } catch (e: any) {
            alert(`Failed to finalize status: ${e.message}`);
            setIsProcessingModalOpen(false);
        }
    };

    // ------------------------------------------------------------------------
    // ACTION 3: REPORTING (View Breakdown)
    // ------------------------------------------------------------------------
    const openBreakdownModal = async (arrear: PfArrearMaster) => {
        setSelectedArrear(arrear);
        setIsBreakdownModalOpen(true);
        setBreakdownLoading(true);
        try {
            const response = await callGateway('/api/a_crud_universal_read', {
                config_id: CONFIGS.READ_ARREAR_DETAILS,
                params: { 
                    filters: { arrear_master_id: arrear.id },
                    limit: 2000 // Get a good chunk
                },
                // CRITICAL: This enables the backend JOIN to get emp_code/full_name
                p_enrich_with_employee_details: true 
            }, accessToken!);
            
            setComputations(response.data || []);
        } catch (e: any) {
            alert(`Failed to load details: ${e.message}`);
        } finally {
            setBreakdownLoading(false);
        }
    };

    // Export Hook
    const { initiateExport, status: exportStatus, downloadUrl } = useExport(CONFIGS.EXPORT_ARREAR);
    
    useEffect(() => {
        if (downloadUrl) window.open(downloadUrl, '_blank');
    }, [downloadUrl]);


    // ========================================================================
    // UI RENDER
    // ========================================================================
    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">PF Arrears Processing</h1>
                    <p className="text-gray-500 text-sm">Manage retrospective PF calculations and liabilities</p>
                </div>
                <Button onClick={fetchArrears} variant="secondary" size="sm" isLoading={loading}>
                    Refresh List
                </Button>
            </div>

            {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">{error}</div>}

            {/* Lifecycle Tabs */}
            <div className="bg-white rounded-lg shadow border border-gray-200 min-h-[500px]">
                <Tabs>
                    {/* TAB 1: PENDING APPROVAL */}
                    <Tabs.Tab label="Pending Approval">
                        <div className="p-4">
                            <ArrearsTable 
                                data={arrears.filter(a => a.approval_status === 'PENDING')}
                                actionLabel="Review Policy"
                                onAction={openApprovalModal}
                                emptyMessage="No arrears pending approval."
                            />
                        </div>
                    </Tabs.Tab>

                    {/* TAB 2: READY TO PROCESS */}
                    <Tabs.Tab label="Ready to Process">
                        <div className="p-4">
                            <ArrearsTable 
                                data={arrears.filter(a => a.approval_status === 'APPROVED')}
                                actionLabel="Run Calculation"
                                onAction={handleProcessAsync}
                                actionVariant="primary"
                                emptyMessage="No approved arrears waiting for calculation."
                            />
                        </div>
                    </Tabs.Tab>

                    {/* TAB 3: HISTORY */}
                    <Tabs.Tab label="History & Reports">
                        <div className="p-4">
                            <ArrearsTable 
                                data={arrears.filter(a => ['PROCESSED', 'REJECTED'].includes(a.approval_status))}
                                actionLabel="View Breakdown"
                                onAction={openBreakdownModal}
                                actionVariant="secondary"
                                emptyMessage="No processed history found."
                            />
                        </div>
                    </Tabs.Tab>
                </Tabs>
            </div>

            {/* ================= MODAL: APPROVAL ================= */}
            {isApprovalModalOpen && selectedArrear && (
                <Modal
                    isOpen={true}
                    onClose={() => setIsApprovalModalOpen(false)}
                    title={`Review: ${selectedArrear.arrear_code}`}
                >
                    <div className="space-y-6">
                        <div className="bg-gray-50 p-4 rounded text-sm space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Reason:</span>
                                <span className="font-medium">{selectedArrear.arrear_reason}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Period:</span>
                                <span className="font-medium">{selectedArrear.arrear_period_start} to {selectedArrear.arrear_period_end}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Employees:</span>
                                <span className="font-medium">{selectedArrear.total_affected_employees}</span>
                            </div>
                        </div>

                        <div className="border-t pt-4">
                            <h3 className="text-md font-semibold mb-4">Interest Policy</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Apply Interest?</label>
                                    <input 
                                        type="checkbox" 
                                        checked={policyForm.interest_applicable}
                                        onChange={e => setPolicyForm(prev => ({...prev, interest_applicable: e.target.checked}))}
                                        className="h-5 w-5 text-blue-600 rounded"
                                    />
                                </div>
                                {policyForm.interest_applicable && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Rate (%)</label>
                                            <Input 
                                                type="number" 
                                                value={policyForm.interest_rate}
                                                onChange={e => setPolicyForm(prev => ({...prev, interest_rate: parseFloat(e.target.value)}))}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Method</label>
                                            <select 
                                                value={policyForm.method}
                                                onChange={e => setPolicyForm(prev => ({...prev, method: e.target.value as any}))}
                                                className="w-full border border-gray-300 rounded-md p-2 text-sm"
                                            >
                                                <option value="SIMPLE">Simple</option>
                                                <option value="COMPOUND">Compound</option>
                                                <option value="FLAT">Flat</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="border-t pt-4">
                            <label className="block text-sm font-medium mb-1">Remarks</label>
                            <textarea 
                                value={policyForm.remarks}
                                onChange={e => setPolicyForm(prev => ({...prev, remarks: e.target.value}))}
                                className="w-full border border-gray-300 rounded p-2 text-sm h-20"
                                placeholder="Enter remarks..."
                            />
                        </div>

                        <div className="flex justify-end space-x-3 pt-4 border-t">
                            <Button variant="ghost" onClick={() => setIsApprovalModalOpen(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={() => handleApprovalDecision('REJECTED')} isLoading={actionLoading}>Reject</Button>
                            <Button onClick={() => handleApprovalDecision('APPROVED')} isLoading={actionLoading}>Approve & Queue</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* ================= MODAL: ASYNC PROCESSING ================= */}
            {isProcessingModalOpen && (
                <Modal 
                    isOpen={true} 
                    onClose={() => {}} // Prevent closing manually
                    title="Processing Arrears"
                    maxWidth="max-w-md"
                >
                    <div className="text-center py-8">
                        <div className="mb-4 flex justify-center">
                            <Loader /> 
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">{processingStatus}</h3>
                        <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                            <div 
                                className="bg-blue-600 h-4 rounded-full transition-all duration-500 ease-out" 
                                style={{ width: `${processingProgress}%` }}
                            ></div>
                        </div>
                        <p className="text-sm text-gray-500">Please do not close this window.</p>
                    </div>
                </Modal>
            )}

            {/* ================= MODAL: BREAKDOWN ================= */}
            {isBreakdownModalOpen && selectedArrear && (
                <Modal
                    isOpen={true}
                    onClose={() => setIsBreakdownModalOpen(false)}
                    title={`Results: ${selectedArrear.arrear_code}`}
                    maxWidth="max-w-6xl"
                >
                    <div className="flex flex-col h-[70vh]">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-4 gap-4 mb-4">
                            <div className="bg-blue-50 p-3 rounded border border-blue-100">
                                <p className="text-xs text-blue-500 uppercase">Diff (EE+ER)</p>
                                <p className="text-lg font-bold text-blue-700">
                                    {formatCurrency(computations.reduce((acc, c) => acc + c.differential_employee_contribution + c.differential_employer_contribution, 0))}
                                </p>
                            </div>
                            <div className="bg-yellow-50 p-3 rounded border border-yellow-100">
                                <p className="text-xs text-yellow-600 uppercase">Interest</p>
                                <p className="text-lg font-bold text-yellow-700">
                                    {formatCurrency(computations.reduce((acc, c) => acc + c.interest_on_differential, 0))}
                                </p>
                            </div>
                            <div className="bg-green-50 p-3 rounded border border-green-100">
                                <p className="text-xs text-green-600 uppercase">Total Liability</p>
                                <p className="text-lg font-bold text-green-700">
                                    {formatCurrency(computations.reduce((acc, c) => acc + c.total_arrear_amount, 0))}
                                </p>
                            </div>
                            <div className="flex items-end justify-end">
                                <Button 
                                    size="sm" 
                                    variant="secondary"
                                    onClick={initiateExport}
                                    isLoading={['INITIATING', 'PROCESSING'].includes(exportStatus)}
                                >
                                    Download Excel
                                </Button>
                            </div>
                        </div>

                        {/* Grid */}
                        <div className="flex-1 overflow-auto border rounded relative">
                            {breakdownLoading ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-white z-10"><Loader /></div>
                            ) : (
                                <table className="min-w-full text-sm divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-0">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Emp Code</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Old Wages</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">New Wages</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Diff (EE+ER)</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Interest</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {computations.map(row => (
                                            <tr key={row.id} className="hover:bg-gray-50">
                                                <td className="px-3 py-2 font-medium text-gray-900">{row.emp_code}</td>
                                                <td className="px-3 py-2 text-gray-600">{row.full_name}</td>
                                                <td className="px-3 py-2 text-right text-gray-500">{formatCurrency(row.original_pf_wages)}</td>
                                                <td className="px-3 py-2 text-right text-gray-500">{formatCurrency(row.revised_pf_wages)}</td>
                                                <td className="px-3 py-2 text-right text-blue-600 font-medium">
                                                    {formatCurrency(row.differential_employee_contribution + row.differential_employer_contribution)}
                                                </td>
                                                <td className="px-3 py-2 text-right text-yellow-600">
                                                    {formatCurrency(row.interest_on_differential)}
                                                </td>
                                                <td className="px-3 py-2 text-right text-green-700 font-bold">
                                                    {formatCurrency(row.total_arrear_amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        
                        <div className="pt-4 flex justify-end">
                            <Button variant="ghost" onClick={() => setIsBreakdownModalOpen(false)}>Close</Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

// ============================================================================
// SUB-COMPONENT: TABLE
// ============================================================================
function ArrearsTable({ 
    data, 
    actionLabel, 
    onAction, 
    actionVariant = 'primary', 
    isLoading = false,
    emptyMessage 
}: {
    data: PfArrearMaster[],
    actionLabel: string,
    onAction: (item: PfArrearMaster) => void,
    actionVariant?: 'primary' | 'secondary' | 'ghost' | 'destructive',
    isLoading?: boolean,
    emptyMessage: string
}) {
    if (data.length === 0) {
        return <div className="text-center py-10 text-gray-500 bg-gray-50 rounded border border-dashed border-gray-300">{emptyMessage}</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Code</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Reason</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Period</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase">Employees</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.map(row => (
                        <tr key={row.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-blue-600">{row.arrear_code}</td>
                            <td className="px-4 py-3 text-gray-700">{row.arrear_reason}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs">
                                {row.arrear_period_start} <span className="text-gray-300 mx-1">➜</span> {row.arrear_period_end}
                            </td>
                            <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    {row.total_affected_employees}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                    row.approval_status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                                    row.approval_status === 'PROCESSED' ? 'bg-green-100 text-green-800' :
                                    row.approval_status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                }`}>
                                    {row.approval_status}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                                {row.approval_status !== 'REJECTED' && (
                                    <Button 
                                        size="sm" 
                                        variant={actionVariant} 
                                        onClick={() => onAction(row)}
                                        isLoading={isLoading}
                                    >
                                        {actionLabel}
                                    </Button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}