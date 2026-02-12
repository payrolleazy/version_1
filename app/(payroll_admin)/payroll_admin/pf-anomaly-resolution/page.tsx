'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Loader from '@/components/ui/Loader';
import Modal from '@/components/Modal';
import Input from '@/components/ui/Input';

// ============================================================================ 
// 1. TYPES & INTERFACES
// ============================================================================ 
interface Anomaly {
    id: number;
    user_id: string;
    emp_code: string;
    employee_name: string;
    payroll_period: string;
    anomaly_type: string;
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    resolution_status: 'OPEN' | 'CLOSED' | 'INVESTIGATING';
    anomaly_description: string;
    detected_at: string;
    details?: Record<string, any>; // For extra data in modal
}

// ============================================================================ 
// 2. CONFIGURATION CONSTANTS (PLACEHOLDERS)
// ============================================================================ 
const CONFIGS = {
  READ_ANOMALIES: '643c5c14-b299-41b4-8545-6a407faaa748',
  RESOLVE_ANOMALY: 'f6a7b8c9-d0e1-2345-6789-0abcdef12345',
};

// ============================================================================ 
// 3. HELPER: GENERIC API CALLER
// ============================================================================ 
async function callGateway(endpoint: string, payload: any, token: string) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ ...payload, accessToken: token }),
  });
  const result = await response.json();
  if (!response.ok || (result.hasOwnProperty('success') && !result.success)) {
    throw new Error(result.message || result.error || 'API Request Failed');
  }
  return result;
}

// ============================================================================ 
// 4. MAIN PAGE COMPONENT
// ============================================================================ 
export default function AnomalyResolutionCenterPage() {
  const { session } = useSessionContext();
  
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('OPEN');
  
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [remarks, setRemarks] = useState('');

  const fetchAnomalies = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);

    try {
        const filters = [];
        if (filterStatus !== 'ALL') filters.push({ column: 'resolution_status', operator: 'eq', value: filterStatus });
        if (filterSeverity !== 'ALL') filters.push({ column: 'severity', operator: 'eq', value: filterSeverity });

      const response = await callGateway('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_ANOMALIES,
        params: { filters, orderBy: [['detected_at', 'DESC']] }
      }, session.access_token);
      
      const mockData: Anomaly[] = [
          { id: 1, user_id: 'u1', emp_code: 'E001', employee_name: 'Anjali Sharma', payroll_period: '2023-11-01', anomaly_type: 'Contribution Spike', severity: 'CRITICAL', resolution_status: 'OPEN', anomaly_description: 'Employee contribution jumped by 150% from previous month.', detected_at: '2023-12-01T10:00:00Z', details: { previous_contribution: 1800, current_contribution: 4500 } },
          { id: 2, user_id: 'u2', emp_code: 'E002', employee_name: 'Bhavin Kumar', payroll_period: '2023-11-01', anomaly_type: 'UAN Not Found', severity: 'WARNING', resolution_status: 'OPEN', anomaly_description: 'UAN is not available in the system for an active employee.', detected_at: '2023-12-01T10:05:00Z' },
          { id: 3, user_id: 'u3', emp_code: 'E003', employee_name: 'Catherine D\'souza', payroll_period: '2023-11-01', anomaly_type: 'Exempted Employee Contribution', severity: 'WARNING', resolution_status: 'INVESTIGATING', anomaly_description: 'Contribution detected for an employee marked as PF-exempt.', detected_at: '2023-12-01T10:10:00Z' },
          { id: 4, user_id: 'u4', emp_code: 'E004', employee_name: 'David Chen', payroll_period: '2023-10-01', anomaly_type: 'Negative Contribution', severity: 'CRITICAL', resolution_status: 'CLOSED', anomaly_description: 'A negative PF contribution was calculated.', detected_at: '2023-11-01T09:00:00Z' },
      ];
      setAnomalies(response.data || mockData);

    } catch (e: any) {
      setError(`Failed to fetch anomalies. Using mock data. Error: ${e.message}`);
      // Using mock data on error
      const mockData: Anomaly[] = [
          { id: 1, user_id: 'u1', emp_code: 'E001', employee_name: 'Anjali Sharma', payroll_period: '2023-11-01', anomaly_type: 'Contribution Spike', severity: 'CRITICAL', resolution_status: 'OPEN', anomaly_description: 'Employee contribution jumped by 150% from previous month.', detected_at: '2023-12-01T10:00:00Z', details: { previous_contribution: 1800, current_contribution: 4500 } },
          { id: 2, user_id: 'u2', emp_code: 'E002', employee_name: 'Bhavin Kumar', payroll_period: '2023-11-01', anomaly_type: 'UAN Not Found', severity: 'WARNING', resolution_status: 'OPEN', anomaly_description: 'UAN is not available in the system for an active employee.', detected_at: '2023-12-01T10:05:00Z' },
      ];
      setAnomalies(mockData.filter(a => (filterStatus === 'ALL' || a.resolution_status === filterStatus) && (filterSeverity === 'ALL' || a.severity === filterSeverity)));
    } finally {
      setLoading(false);
    }
  }, [session, filterStatus, filterSeverity]);

  useEffect(() => {
    if (session) fetchAnomalies();
  }, [session, fetchAnomalies]);

  const handleOpenModal = (anomaly: Anomaly) => {
    setSelectedAnomaly(anomaly);
    setIsModalOpen(true);
    setRemarks('');
  };

  const handleResolveAction = async (action: 'CLOSE' | 'INVESTIGATE') => {
    if (!selectedAnomaly || !session) return;
    setActionLoading(true);
    setError(null);

    try {
        await callGateway('/api/a_crud_universal_pg_function_gateway', {
            config_id: CONFIGS.RESOLVE_ANOMALY,
            params: { p_anomaly_id: selectedAnomaly.id, p_action: action, p_remarks: remarks, p_user_id: session.user.id }
        }, session.access_token);
        setIsModalOpen(false);
        await fetchAnomalies();
    } catch(e: any) {
        setError(`Action failed: ${e.message}`);
    } finally {
        setActionLoading(false);
    }
  };

  const getSeverityPill = (severity: Anomaly['severity']) => ({
      'CRITICAL': 'bg-red-100 text-red-800',
      'WARNING': 'bg-yellow-100 text-yellow-800',
      'INFO': 'bg-blue-100 text-blue-800',
  }[severity]);

  const filteredAnomalies = anomalies.filter(a =>
    (filterStatus === 'ALL' || a.resolution_status === filterStatus) &&
    (filterSeverity === 'ALL' || a.severity === filterSeverity)
  );

  if (loading) return <Loader />;

  return (
    <div className="p-8 bg-white rounded-lg shadow-md min-h-screen">
      <div className="mb-4">
        <a href="/payroll_admin/pf-dashboard" className="text-blue-600 hover:underline">&larr; Back to PF Dashboard</a>
      </div>
      <h1 className="text-3xl font-bold mb-6">Anomaly Resolution Center</h1>
      {error && <div className="bg-yellow-100 border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4">{error}</div>}

      <div className="flex space-x-4 mb-4">
          {/* Filter controls */}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-4 border-b text-left">Employee</th>
              <th className="py-2 px-4 border-b text-left">Anomaly Type</th>
              <th className="py-2 px-4 border-b text-left">Severity</th>
              <th className="py-2 px-4 border-b text-left">Status</th>
              <th className="py-2 px-4 border-b text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredAnomalies.map(anomaly => (
              <tr key={anomaly.id}>
                <td className="py-2 px-4 border-b">{anomaly.employee_name} ({anomaly.emp_code})</td>
                <td className="py-2 px-4 border-b">{anomaly.anomaly_type}</td>
                <td className="py-2 px-4 border-b">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getSeverityPill(anomaly.severity)}`}>
                        {anomaly.severity}
                    </span>
                </td>
                <td className="py-2 px-4 border-b">{anomaly.resolution_status}</td>
                <td className="py-2 px-4 border-b text-center">
                  <Button onClick={() => handleOpenModal(anomaly)} size="sm" variant="outline">Details</Button>
                </td>
              </tr>
            ))}
            {filteredAnomalies.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-gray-500">No anomalies match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && selectedAnomaly && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Anomaly Details: #${selectedAnomaly.id}`}>
            <div className="space-y-4 text-sm">
                <p><strong>Employee:</strong> {selectedAnomaly.employee_name} ({selectedAnomaly.emp_code})</p>
                <p><strong>Description:</strong> {selectedAnomaly.anomaly_description}</p>
                {/* Render details object nicely */}
                {selectedAnomaly.details && (
                    <div className="bg-gray-50 p-3 rounded">
                        <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(selectedAnomaly.details, null, 2)}</pre>
                    </div>
                )}
                <div>
                    <label className="block font-medium">Remarks</label>
                    <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3} className="w-full mt-1 p-2 border rounded"/>
                </div>
                 <div className="flex justify-end space-x-2 border-t pt-4">
                    <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={actionLoading}>Cancel</Button>
                    <Button onClick={() => handleResolveAction('INVESTIGATE')} isLoading={actionLoading} variant="outline">Mark as Investigating</Button>
                    <Button onClick={() => handleResolveAction('CLOSE')} isLoading={actionLoading}>Mark as Resolved</Button>
                </div>
            </div>
        </Modal>
      )}
    </div>
  );
}
