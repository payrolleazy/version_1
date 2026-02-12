'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Loader from '@/components/ui/Loader';
import Link from 'next/link';

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================

interface EmployeeTaxSummary {
  tenant_id: string;
  user_id: string;
  employee_name: string;
  employee_code: string;
  financial_year: string;
  selected_regime: string;
  is_regime_locked: boolean;
  latest_monthly_tds: number;
  latest_annual_tax: number;
  total_tds_ytd: number;
  declaration_status: 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'FROZEN' | 'NOT_SUBMITTED';
  last_updated: string;
}

interface ChallanRecord {
  id: number;
  challan_serial_number: string;
  status: 'DRAFT' | 'GENERATED' | 'PAID' | 'FAILED';
  total_amount_paid: number;
  quarter: string;
  created_at: string;
}

interface DashboardMetrics {
  totalEmployees: number;
  totalAnnualLiability: number;
  totalCollectedYTD: number;
  pendingDeclarations: number;
  pendingChallans: number;
  regimeOldCount: number;
  regimeNewCount: number;
}

// ============================================================================
// 2. CONFIGURATION CONSTANTS (From provided JSON dump)
// ============================================================================
const CONFIGS = {
  // Reads from wcm_it_mv_employee_tax_summary
  READ_MV_SUMMARY: '7c259bc4-ca5e-451d-92b4-fb642f9672b7', 
  // Reads from wcm_it_tds_challan_register
  READ_CHALLANS: '7c21e597-01da-4eb8-baa5-67fbfe57428f', 
};

// ============================================================================
// 3. HELPER: GENERIC API CALLER
// ============================================================================
async function callGateway(endpoint: string, payload: any, token: string) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
    },
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
export default function IncomeTaxDashboardPage() {
  const { session } = useSessionContext();
  const accessToken = session?.access_token;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data State
  const [taxSummaries, setTaxSummaries] = useState<EmployeeTaxSummary[]>([]);
  const [recentChallans, setRecentChallans] = useState<ChallanRecord[]>([]);
  const [currentFY, setCurrentFY] = useState<string>('FY2025-26'); // Default, could be dynamic

  // ==========================
  // DATA FETCHING
  // ==========================
  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);

    try {
      // Parallel Fetching using Universal Gateway
      const [summaryRes, challanRes] = await Promise.all([
        // 1. Fetch Employee Summaries (Snapshot of tax health)
        callGateway('/api/a_crud_universal_read', {
          config_id: CONFIGS.READ_MV_SUMMARY,
          params: { 
            filters: { financial_year: currentFY },
            limit: 1000 // Reasonable limit for dashboard analytics
          }
        }, accessToken),

        // 2. Fetch Recent Challans
        callGateway('/api/a_crud_universal_read', {
          config_id: CONFIGS.READ_CHALLANS,
          params: { 
            filters: { financial_year: currentFY },
            orderBy: [['created_at', 'DESC']],
            limit: 5 
          }
        }, accessToken)
      ]);

      setTaxSummaries(summaryRes.data || []);
      setRecentChallans(challanRes.data || []);

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, currentFY]);

  useEffect(() => {
    if (accessToken) fetchData();
  }, [accessToken, fetchData]);

  // ==========================
  // METRICS CALCULATION
  // ==========================
  const metrics: DashboardMetrics = useMemo(() => {
    return taxSummaries.reduce((acc, curr) => {
      acc.totalEmployees++;
      acc.totalAnnualLiability += (curr.latest_annual_tax || 0);
      acc.totalCollectedYTD += (curr.total_tds_ytd || 0);
      
      if (curr.declaration_status === 'SUBMITTED') {
        acc.pendingDeclarations++;
      }
      
      if (curr.selected_regime === 'OLD_REGIME') acc.regimeOldCount++;
      else acc.regimeNewCount++;

      return acc;
    }, {
      totalEmployees: 0,
      totalAnnualLiability: 0,
      totalCollectedYTD: 0,
      pendingDeclarations: 0,
      pendingChallans: recentChallans.filter(c => c.status === 'DRAFT' || c.status === 'GENERATED').length,
      regimeOldCount: 0,
      regimeNewCount: 0
    });
  }, [taxSummaries, recentChallans]);

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  if (loading && taxSummaries.length === 0) return <Loader />;

  return (
    <div className="p-8 bg-gray-50 min-h-screen font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Income Tax (TDS) Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Overview for Financial Year: <span className="font-mono font-medium text-gray-700">{currentFY}</span></p>
        </div>
        <div className="flex space-x-3 mt-4 md:mt-0">
           <Button variant="secondary" onClick={fetchData} size="sm">Refresh Data</Button>
           <Link href="/payroll_admin/it-computation">
             <Button size="sm">Run Computation</Button>
           </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded shadow-sm">
          <p className="font-bold">Error loading dashboard</p>
          <p>{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total Projected Liability" 
          value={formatCurrency(metrics.totalAnnualLiability)}
          icon="💰"
          color="blue"
        />
        <StatCard 
          title="TDS Collected YTD" 
          value={formatCurrency(metrics.totalCollectedYTD)}
          subValue={`${Math.round((metrics.totalCollectedYTD / (metrics.totalAnnualLiability || 1)) * 100)}% of goal`}
          icon="cb"
          color="green"
        />
        <StatCard 
          title="Pending Declarations" 
          value={metrics.pendingDeclarations}
          subValue="Form 12BB Verifications"
          icon="📝"
          color="yellow"
          isActionable={metrics.pendingDeclarations > 0}
          link="/payroll_admin/it-declarations"
        />
        <StatCard 
          title="Pending Challans" 
          value={metrics.pendingChallans}
          subValue="Due Payments"
          icon="🏦"
          color="red"
          isActionable={metrics.pendingChallans > 0}
          link="/payroll_admin/it-compliance"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Recent Activity & Regime Split */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Regime Distribution */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Regime Adoption</h2>
            <div className="flex items-center h-4 rounded-full overflow-hidden bg-gray-100 mb-2">
              <div 
                className="h-full bg-blue-500 transition-all duration-500" 
                style={{ width: `${(metrics.regimeOldCount / (metrics.totalEmployees || 1)) * 100}%` }}
              />
              <div 
                className="h-full bg-purple-500 transition-all duration-500" 
                style={{ width: `${(metrics.regimeNewCount / (metrics.totalEmployees || 1)) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <div className="flex items-center"><div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div> Old Regime ({metrics.regimeOldCount})</div>
              <div className="flex items-center"><div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div> New Regime ({metrics.regimeNewCount})</div>
            </div>
          </div>

          {/* High Value Taxpayers Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Top Tax Liabilities</h2>
              <Link href="/payroll_admin/it-employee-profiles" className="text-sm text-blue-600 hover:underline">View All</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Regime</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Annual Tax</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly TDS</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {taxSummaries
                    .sort((a, b) => b.latest_annual_tax - a.latest_annual_tax)
                    .slice(0, 5)
                    .map((emp) => (
                    <tr key={emp.user_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{emp.employee_name}</div>
                        <div className="text-xs text-gray-500">{emp.employee_code}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${emp.selected_regime === 'OLD_REGIME' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                          {emp.selected_regime.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-mono">
                        {formatCurrency(emp.latest_annual_tax)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 font-mono">
                        {formatCurrency(emp.latest_monthly_tds)}
                      </td>
                    </tr>
                  ))}
                  {taxSummaries.length === 0 && (
                    <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">No data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Column: Quick Actions & Challans */}
        <div className="space-y-8">
          
          {/* Quick Actions Card */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link href="/payroll_admin/it-declarations">
                <Button variant="secondary" className="w-full justify-start text-left">
                  <span className="mr-2">📝</span> Verify Proofs
                </Button>
              </Link>
              <Link href="/payroll_admin/it-employee-profiles">
                <Button variant="secondary" className="w-full justify-start text-left">
                  <span className="mr-2">👤</span> Manage Employee Profiles
                </Button>
              </Link>
              <Link href="/payroll_admin/it-compliance">
                <Button variant="secondary" className="w-full justify-start text-left">
                  <span className="mr-2">📄</span> Generate Form 16
                </Button>
              </Link>
            </div>
          </div>

          {/* Recent Challans */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Challans</h2>
            <div className="space-y-4">
              {recentChallans.map((challan) => (
                <div key={challan.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-100">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{challan.quarter}</div>
                    <div className="text-xs text-gray-500 font-mono">{challan.challan_serial_number}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">{formatCurrency(challan.total_amount_paid)}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      challan.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {challan.status}
                    </span>
                  </div>
                </div>
              ))}
               {recentChallans.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-2">No recent challans</p>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
              <Link href="/payroll_admin/it-compliance" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                View All Challans &rarr;
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 5. SUB-COMPONENTS
// ============================================================================

const StatCard = ({ title, value, subValue, icon, color, isActionable, link }: { 
  title: string, value: string | number, subValue?: string, icon: string, color: string, isActionable?: boolean, link?: string 
}) => {
  
  const content = (
    <div className={`bg-white p-6 rounded-lg shadow-sm border-l-4 border-${color}-500 hover:shadow-md transition-shadow h-full`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
          {subValue && <p className="text-xs text-gray-500 mt-2">{subValue}</p>}
        </div>
        <div className={`p-3 bg-${color}-50 rounded-full text-xl`}>
          {icon}
        </div>
      </div>
      {isActionable && (
        <div className="mt-4 pt-3 border-t border-gray-100">
           <span className="text-sm text-blue-600 font-medium flex items-center">
             Action Required &rarr;
           </span>
        </div>
      )}
    </div>
  );

  if (link) {
    return <Link href={link}>{content}</Link>;
  }
  return content;
};