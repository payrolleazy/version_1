'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/Modal';
import { LoadingState, ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { callPgFunction } from '@/lib/useGateway';
import { HMS_GATEWAY_CONFIGS } from '@/lib/constants';
import OrgChartTree, { OrgChartNode } from '@/components/hierarchy/OrgChartTree';

export default function AdminOrgChartPage() {
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const router = useRouter();

  const [orgData, setOrgData] = useState<OrgChartNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Detail modal
  const [selectedNode, setSelectedNode] = useState<OrgChartNode | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Assign modal
  const [assignTarget, setAssignTarget] = useState<OrgChartNode | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  const fetchOrgChart = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await callPgFunction(HMS_GATEWAY_CONFIGS.ORG_CHART, {}, session.access_token);
      if (result.success) {
        const chartData = result.data?.data || result.data || [];
        setOrgData(Array.isArray(chartData) ? chartData : []);
      } else {
        throw new Error(result.error || 'Failed to fetch org chart');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!isSessionLoading && !session) router.push('/admin/auth/login');
    if (session) fetchOrgChart();
  }, [session, isSessionLoading, router, fetchOrgChart]);

  const handleNodeClick = (node: OrgChartNode) => {
    setSelectedNode(node);
    setIsDetailOpen(true);
  };

  const handleAssignClick = (node: OrgChartNode) => {
    setAssignTarget(node);
    setEmployeeSearch('');
    setIsAssignOpen(true);
  };

  const handleAssignEmployee = async () => {
    if (!session?.access_token || !assignTarget || !employeeSearch.trim()) return;
    setAssignLoading(true);
    try {
      const result = await callPgFunction(
        HMS_GATEWAY_CONFIGS.ASSIGN_EMPLOYEE,
        { position_id: assignTarget.id, emp_code: employeeSearch.trim() },
        session.access_token
      );
      if (!result.success) throw new Error(result.error || 'Failed to assign employee.');
      setIsAssignOpen(false);
      await fetchOrgChart();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAssignLoading(false);
    }
  };

  if (isSessionLoading) return <LoadingState message="Initializing session..." />;

  return (
    <ErrorBoundary>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Organization Chart</h1>
              <p className="text-gray-600 mt-1">Visualize and manage the organizational hierarchy.</p>
            </div>
            <Button variant="secondary" onClick={fetchOrgChart}>Refresh</Button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>
          )}

          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="mb-4">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by position, name, department..."
              />
            </div>

            {loading ? (
              <LoadingState message="Loading organization chart..." />
            ) : (
              <OrgChartTree
                data={orgData}
                readOnly={false}
                searchQuery={searchQuery}
                onNodeClick={handleNodeClick}
                onAssignClick={handleAssignClick}
              />
            )}
          </div>
        </div>
      </div>

      {/* Node Detail Modal */}
      {isDetailOpen && selectedNode && (
        <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title="Position Details">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Position Name</p>
                <p className="text-sm font-medium text-gray-900">{selectedNode.position_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Position ID</p>
                <p className="text-sm font-medium text-gray-900">#{selectedNode.id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <p className="text-sm font-medium text-gray-900">{selectedNode.position_status || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Reports To</p>
                <p className="text-sm font-medium text-gray-900">{selectedNode.reporting_position_id ? `#${selectedNode.reporting_position_id}` : 'Root'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Department</p>
                <p className="text-sm font-medium text-gray-900">{selectedNode.department_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Designation</p>
                <p className="text-sm font-medium text-gray-900">{selectedNode.designation_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Occupant</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedNode.employee_name || selectedNode.full_name || <span className="text-amber-600 italic">Vacant</span>}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Employee Code</p>
                <p className="text-sm font-medium text-gray-900">{selectedNode.emp_code || '-'}</p>
              </div>
              {selectedNode.direct_reports !== undefined && (
                <div>
                  <p className="text-xs text-gray-500">Direct Reports</p>
                  <p className="text-sm font-medium text-gray-900">{selectedNode.direct_reports}</p>
                </div>
              )}
              {selectedNode.subtree_size !== undefined && (
                <div>
                  <p className="text-xs text-gray-500">Subtree Size</p>
                  <p className="text-sm font-medium text-gray-900">{selectedNode.subtree_size}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-4 border-t">
              <Button variant="secondary" onClick={() => setIsDetailOpen(false)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Assign Employee Modal */}
      {isAssignOpen && assignTarget && (
        <Modal isOpen={isAssignOpen} onClose={() => setIsAssignOpen(false)} title="Assign Employee">
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                Assigning to: <strong>{assignTarget.position_name}</strong> (#{assignTarget.id})
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee Code *</label>
              <Input
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Enter employee code (e.g. EMP001)"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setIsAssignOpen(false)}>Cancel</Button>
              <Button onClick={handleAssignEmployee} isLoading={assignLoading} disabled={!employeeSearch.trim()}>
                Assign Employee
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </ErrorBoundary>
  );
}
