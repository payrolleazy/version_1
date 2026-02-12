'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

// --- Reusable Sub-Menu Link Component ---
interface SidebarLinkProps {
  href: string;
  label: string;
  isActive: boolean;
}

const SidebarLink = ({ href, label, isActive }: SidebarLinkProps) => (
  <Link href={href} className="block relative group">
    <div
      className={`flex items-center px-4 py-2.5 my-1 text-sm font-medium rounded-lg transition-all duration-200 
      ${isActive 
        ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200 translate-x-1' 
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white hover:translate-x-1'
      }`}
    >
      <AnimatePresence mode='wait'>
        {isActive && (
          <motion.span 
            className="absolute left-0 w-1 h-full bg-purple-600 rounded-r-full" 
            layoutId="activeIndicator"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>
      <span className="ml-2">{label}</span>
    </div>
  </Link>
);

// --- Rail Icon Button Component ---
interface RailItemProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

const RailItem = ({ id, label, icon, isActive, onClick }: RailItemProps) => (
  <button
    onClick={onClick}
    className={`w-full flex flex-col items-center justify-center py-4 px-2 transition-all duration-200 border-l-4 group relative
      ${isActive 
        ? 'bg-white/60 backdrop-blur-sm border-purple-600 text-purple-900 shadow-sm' 
        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/30'
      }`}
  >
    <div className={`p-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-purple-100' : ''}`}>
      {icon}
    </div>
    <span className="text-[10px] font-bold mt-1 text-center tracking-wide leading-tight">{label}</span>
  </button>
);

export default function PayrollAdminSidebar() {
  const pathname = usePathname();
  // Default to Dashboard or determine based on path
  const [activeCategory, setActiveCategory] = useState<string>('Dashboard');

  const isActive = (href: string) => pathname === href;

  // Auto-select category based on current URL to ensure the menu is open on refresh
  useEffect(() => {
    if (pathname.includes('/pay-structures') || pathname.includes('/payroll_areas') || pathname.includes('/wcm-components') || pathname.includes('/variable-inputs')) {
      setActiveCategory('Configuration');
    } else if (pathname.includes('/tps-finalization') || pathname.includes('/payroll-run') || pathname.includes('/arrear-management') || pathname.includes('/assign') || pathname.includes('/fbp-manager') || pathname.includes('/generate-variable') || pathname.includes('/calculation-results') || pathname.includes('/fnf-processing') || pathname.includes('/payslip-management') || pathname.includes('/audit-trail')) {
      setActiveCategory('PayrollProcessing');
    } else if (pathname.includes('/pf-')) {
      setActiveCategory('PF Module');
    } else if (pathname.includes('/esic-')) {
      setActiveCategory('ESIC Module');
    } else if (pathname.includes('/it-')) {
      setActiveCategory('IT Module');
    } else if (pathname === '/payroll_admin') {
      setActiveCategory('Dashboard');
    }
  }, [pathname]);

  return (
    <aside className="w-[320px] h-screen flex sticky top-0 bg-gray-50 dark:bg-gray-900 shadow-xl z-50 font-sans">
      
      {/* --- LEFT RAIL (Fixed Categories) --- */}
      {/* 
         Updated Background: 
         Matches Button Hover Gradient: from-[#e0c9ef] to-[#b9c9ef] 
      */}
      <div className="w-[80px] bg-gradient-to-b from-[#e0c9ef] to-[#b9c9ef] flex flex-col items-center py-4 space-y-2 z-20 shadow-lg overflow-y-auto scrollbar-none border-r border-purple-200/50">
        
        {/* Dashboard */}
        <RailItem 
          id="Dashboard" 
          label="Home" 
          isActive={activeCategory === 'Dashboard'} 
          onClick={() => setActiveCategory('Dashboard')}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 01-2 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          }
        />

        <div className="w-8 h-px bg-purple-300/50 my-2"></div>

        {/* Configuration */}
        <RailItem 
          id="Configuration" 
          label="Config" 
          isActive={activeCategory === 'Configuration'} 
          onClick={() => setActiveCategory('Configuration')}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          }
        />

        {/* Payroll Processing */}
        <RailItem 
          id="PayrollProcessing" 
          label="Process" 
          isActive={activeCategory === 'PayrollProcessing'} 
          onClick={() => setActiveCategory('PayrollProcessing')}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          }
        />

        {/* PF Module */}
        <RailItem 
          id="PF Module" 
          label="PF" 
          isActive={activeCategory === 'PF Module'} 
          onClick={() => setActiveCategory('PF Module')}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />

        {/* ESIC Module */}
        <RailItem 
          id="ESIC Module" 
          label="ESIC" 
          isActive={activeCategory === 'ESIC Module'} 
          onClick={() => setActiveCategory('ESIC Module')}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          }
        />

        {/* IT Module */}
        <RailItem 
          id="IT Module" 
          label="TDS" 
          isActive={activeCategory === 'IT Module'} 
          onClick={() => setActiveCategory('IT Module')}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
          }
        />
      </div>

      {/* --- RIGHT PANE (Dynamic Content) --- */}
      <div className="flex-1 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
        
        {/* Header Area */}
        <div className="h-16 flex items-center px-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white tracking-tight">
            {activeCategory === 'Dashboard' ? 'Overview' : activeCategory}
          </h2>
        </div>

        {/* Scrollable Links Area */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
          <AnimatePresence mode='wait'>
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-1"
            >
              
              {/* Dashboard Content */}
              {activeCategory === 'Dashboard' && (
                 <div className="space-y-2">
                   <p className="text-xs text-gray-500 mb-4 px-2">QUICK LINKS</p>
                   <SidebarLink href="/payroll_admin" label="Main Dashboard" isActive={isActive('/payroll_admin')} />
                   <div className="mt-8 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                      <p className="text-sm text-purple-800 dark:text-purple-200">Welcome to the Payroll Administration Portal. Select a module from the left rail to begin.</p>
                   </div>
                 </div>
              )}

              {/* Configuration Content */}
              {activeCategory === 'Configuration' && (
                <>
                  <SidebarLink href="/payroll_admin/pay-structures" label="Pay Structures" isActive={isActive('/payroll_admin/pay-structures')} />
                  <SidebarLink href="/payroll_admin/payroll_areas" label="Payroll Areas" isActive={isActive('/payroll_admin/payroll_areas')} />
                  <SidebarLink href="/payroll_admin/wcm-components" label="Pay Components" isActive={isActive('/payroll_admin/wcm-components')} />

                </>
              )}

              {/* Payroll Processing Content */}
              {activeCategory === 'PayrollProcessing' && (
                <>
                  <SidebarLink href="/payroll_admin/tps-finalization" label="Attendance Finalization" isActive={isActive('/payroll_admin/tps-finalization')} />
                  <SidebarLink href="/payroll_admin/payroll-run" label="Payroll Cockpit" isActive={isActive('/payroll_admin/payroll-run')} />
                  <SidebarLink href="/payroll_admin/calculation-results" label="Calculation Results" isActive={isActive('/payroll_admin/calculation-results')} />
                  <SidebarLink href="/payroll_admin/arrear-management" label="Arrear Management" isActive={isActive('/payroll_admin/arrear-management')} />
                  <SidebarLink href="/payroll_admin/assign-pay-structures" label="Assign Pay Structures" isActive={isActive('/payroll_admin/assign-pay-structures')} />
                  <SidebarLink href="/payroll_admin/fbp-manager" label="FBP Manager" isActive={isActive('/payroll_admin/fbp-manager')} />
                  <SidebarLink href="/payroll_admin/fnf-processing" label="FNF Processing" isActive={isActive('/payroll_admin/fnf-processing')} />
                  <SidebarLink href="/payroll_admin/payslip-management" label="Payslip Management" isActive={isActive('/payroll_admin/payslip-management')} />
                  <SidebarLink href="/payroll_admin/generate-variable-template" label="Variable Input Template" isActive={isActive('/payroll_admin/generate-variable-template')} />
                  <SidebarLink href="/payroll_admin/audit-trail" label="Audit Trail" isActive={isActive('/payroll_admin/audit-trail')} />
                </>
              )}

              {/* PF Module Content */}
              {activeCategory === 'PF Module' && (
                <>
                  <SidebarLink href="/payroll_admin/pf-dashboard" label="PF Dashboard" isActive={isActive('/payroll_admin/pf-dashboard')} />
                  <SidebarLink href="/payroll_admin/pf-configuration" label="PF Configuration" isActive={isActive('/payroll_admin/pf-configuration')} />
                  <SidebarLink href="/payroll_admin/pf-component-mapping" label="PF Component Mapping" isActive={isActive('/payroll_admin/pf-component-mapping')} />
                  <SidebarLink href="/payroll_admin/pf-employee-registration" label="Employee Registration" isActive={isActive('/payroll_admin/pf-employee-registration')} />
                  <SidebarLink href="/payroll_admin/pf-arrears-processing" label="PF Arrears Processing" isActive={isActive('/payroll_admin/pf-arrears-processing')} />
                  <SidebarLink href="/payroll_admin/pf-challan-ecr" label="Challan & ECR" isActive={isActive('/payroll_admin/pf-challan-ecr')} />
                  <SidebarLink href="/payroll_admin/pf-anomaly-resolution" label="Anomaly Resolution" isActive={isActive('/payroll_admin/pf-anomaly-resolution')} />
                </>
              )}

              {/* ESIC Module Content */}
              {activeCategory === 'ESIC Module' && (
                <>
                  <SidebarLink href="/payroll_admin/esic-dashboard" label="ESIC Dashboard" isActive={isActive('/payroll_admin/esic-dashboard')} />
                  <SidebarLink href="/payroll_admin/esic-configuration" label="ESIC Configuration" isActive={isActive('/payroll_admin/esic-configuration')} />
                  <SidebarLink href="/payroll_admin/esic-registration" label="ESIC Registration" isActive={isActive('/payroll_admin/esic-registration')} />
                  <SidebarLink href="/payroll_admin/esic-computation" label="ESIC Computation" isActive={isActive('/payroll_admin/esic-computation')} />
                  <SidebarLink href="/payroll_admin/esic-challan" label="ESIC Challan & ECR" isActive={isActive('/payroll_admin/esic-challan')} />
                  <SidebarLink href="/payroll_admin/esic-ledger" label="ESIC Ledger" isActive={isActive('/payroll_admin/esic-ledger')} />
                </>
              )}

              {/* IT Module Content */}
              {activeCategory === 'IT Module' && (
                <>
                  <SidebarLink href="/payroll_admin/it-dashboard" label="IT Dashboard" isActive={isActive('/payroll_admin/it-dashboard')} />
                  <SidebarLink href="/payroll_admin/it-configuration" label="IT Configuration" isActive={isActive('/payroll_admin/it-configuration')} />
                  <SidebarLink href="/payroll_admin/it-employee-profiles" label="Employee Profiles" isActive={isActive('/payroll_admin/it-employee-profiles')} />
                  <SidebarLink href="/payroll_admin/it-declarations" label="Declarations (12BB)" isActive={isActive('/payroll_admin/it-declarations')} />
                  <SidebarLink href="/payroll_admin/it-computation" label="Computation & Ledger" isActive={isActive('/payroll_admin/it-computation')} />
                  <SidebarLink href="/payroll_admin/it-compliance" label="Compliance (Challan/F16)" isActive={isActive('/payroll_admin/it-compliance')} />
                </>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}