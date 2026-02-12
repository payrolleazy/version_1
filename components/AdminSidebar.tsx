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
    className={`w-full flex flex-col items-center justify-center py-4 px-2 transition-all duration-200 border-l-4 group relative shrink-0
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

export default function AdminSidebar() {
  const pathname = usePathname();
  const [activeCategory, setActiveCategory] = useState<string>('Dashboard');

  const isActive = (href: string) => pathname === href;

  // Auto-select category based on current URL to ensure the menu is open on refresh
  useEffect(() => {
    if (pathname.includes('/admin/onboarding')) {
      setActiveCategory('Onboarding');
    } else if (pathname.includes('/admin/attendance')) {
      setActiveCategory('Attendance');
    } else if (pathname.includes('/admin/leave')) {
      setActiveCategory('Leave');
    } else if (pathname.includes('/admin/payroll')) {
      setActiveCategory('Payroll');
    } else if (pathname.includes('/admin/user-roles') || pathname.includes('/admin/employee-roles')) {
      setActiveCategory('User Management');
    } else if (pathname.includes('/admin/hierarchy')) {
      setActiveCategory('Hierarchy');
    } else if (pathname === '/admin') {
      setActiveCategory('Dashboard');
    }
  }, [pathname]);

  return (
    <aside className="w-[320px] h-screen flex sticky top-0 bg-gray-50 dark:bg-gray-900 shadow-xl z-50 font-sans overflow-hidden">
      
      {/* --- LEFT RAIL (Fixed Categories) --- */}
      {/* 
          UPDATES: 
          1. h-full: Ensures it takes full height.
          2. overflow-y-auto: Enables vertical scrolling within this column if items exceed height.
          3. pb-24: Adds padding at bottom so the last item isn't cut off by taskbars.
          4. scrollbar-none: Hides the ugly scrollbar but allows scrolling functionality.
      */}
      <div className="w-[80px] h-full bg-gradient-to-b from-[#e0c9ef] to-[#b9c9ef] flex flex-col items-center py-4 space-y-2 z-20 shadow-lg overflow-y-auto scrollbar-none border-r border-purple-200/50 pb-24">
        
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

        <div className="w-8 h-px bg-purple-300/50 my-2 shrink-0"></div>

        {/* Attendance */}
        <RailItem 
          id="Attendance" 
          label="Attend" 
          isActive={activeCategory === 'Attendance'} 
          onClick={() => setActiveCategory('Attendance')}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        {/* Leave */}
        <RailItem 
          id="Leave" 
          label="Leave" 
          isActive={activeCategory === 'Leave'} 
          onClick={() => setActiveCategory('Leave')}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />

        {/* Payroll */}
        <RailItem 
          id="Payroll" 
          label="Pay" 
          isActive={activeCategory === 'Payroll'} 
          onClick={() => setActiveCategory('Payroll')}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 00-2-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />

        {/* User Management */}
        <RailItem 
          id="User Management" 
          label="Users" 
          isActive={activeCategory === 'User Management'} 
          onClick={() => setActiveCategory('User Management')}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />

        {/* Onboarding */}
        <RailItem 
          id="Onboarding" 
          label="Onboard" 
          isActive={activeCategory === 'Onboarding'} 
          onClick={() => setActiveCategory('Onboarding')}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          }
        />

        {/* Hierarchy */}
        <RailItem 
          id="Hierarchy" 
          label="Org" 
          isActive={activeCategory === 'Hierarchy'} 
          onClick={() => setActiveCategory('Hierarchy')}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />

      </div>

      {/* --- RIGHT PANE (Dynamic Content) --- */}
      <div className="flex-1 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden h-full">
        
        {/* Header Area */}
        <div className="h-16 flex items-center px-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white tracking-tight">
            {activeCategory === 'Dashboard' ? 'Overview' : activeCategory}
          </h2>
        </div>

        {/* Scrollable Links Area */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700 pb-20">
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
                   <SidebarLink href="/admin" label="Main Dashboard" isActive={isActive('/admin')} />
                   <div className="mt-8 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                      <p className="text-sm text-purple-800 dark:text-purple-200">Welcome to the Admin Portal. Select a module from the left rail to manage your organization.</p>
                   </div>
                 </div>
              )}

              {/* Attendance Content */}
              {activeCategory === 'Attendance' && (
                <>
                  <p className="text-xs text-gray-500 mb-4 px-2">CONFIGURATION</p>
                  <SidebarLink href="/admin/attendance/shifts" label="Shift Management" isActive={isActive('/admin/attendance/shifts')} />
                  <SidebarLink href="/admin/attendance/schedules" label="Employee Schedules" isActive={isActive('/admin/attendance/schedules')} />
                  <SidebarLink href="/admin/attendance/geofences" label="Geofence Locations" isActive={isActive('/admin/attendance/geofences')} />
                  <SidebarLink href="/admin/attendance/holidays" label="Holiday Calendar" isActive={isActive('/admin/attendance/holidays')} />
                  <SidebarLink href="/admin/attendance/settings" label="Attendance Settings" isActive={isActive('/admin/attendance/settings')} />
                </>
              )}

              {/* Leave Content */}
              {activeCategory === 'Leave' && (
                <>
                  <p className="text-xs text-gray-500 mb-4 px-2">POLICIES & RULES</p>
                  <SidebarLink href="/admin/leave/types" label="Leave Types" isActive={isActive('/admin/leave/types')} />
                  <SidebarLink href="/admin/leave/policies" label="Leave Policies" isActive={isActive('/admin/leave/policies')} />
                  <SidebarLink href="/admin/leave/assignments" label="Policy Assignments" isActive={isActive('/admin/leave/assignments')} />
                  <div className="my-4 border-t border-gray-100 dark:border-gray-800"></div>
                  <p className="text-xs text-gray-500 mb-4 px-2">REPORTS</p>
                  <SidebarLink href="/admin/leave/analytics" label="Leave Analytics" isActive={isActive('/admin/leave/analytics')} />
                </>
              )}

              {/* Payroll Content */}
              {activeCategory === 'Payroll' && (
                <>
                  <p className="text-xs text-gray-500 mb-4 px-2">BATCH PROCESSING</p>
                  <SidebarLink href="/admin/payroll/batches" label="Payroll Batches" isActive={isActive('/admin/payroll/batches')} />
                  <SidebarLink href="/admin/payroll/batches/create" label="Create New Batch" isActive={isActive('/admin/payroll/batches/create')} />
                </>
              )}

              {/* User Management Content */}
              {activeCategory === 'User Management' && (
                <>
                  <p className="text-xs text-gray-500 mb-4 px-2">ACCESS CONTROL</p>
                  <SidebarLink href="/admin/user-roles" label="Candidates" isActive={isActive('/admin/user-roles')} />
                  <SidebarLink href="/admin/employee-roles" label="Employees" isActive={isActive('/admin/employee-roles')} />
                </>
              )}

              {/* Onboarding Content */}
              {activeCategory === 'Onboarding' && (
                <>
                  <p className="text-xs text-gray-500 mb-4 px-2">WORKFLOWS</p>
                  <SidebarLink href="/admin/onboarding/dashboard" label="Dashboard" isActive={isActive('/admin/onboarding/dashboard')} />
                  <SidebarLink href="/admin/onboarding/pending-hires" label="Pending Hires" isActive={isActive('/admin/onboarding/pending-hires')} />
                  <SidebarLink href="/admin/onboarding/active-workflows" label="Active Workflows" isActive={isActive('/admin/onboarding/active-workflows')} />
                  
                  <div className="my-4 border-t border-gray-100 dark:border-gray-800"></div>
                  <p className="text-xs text-gray-500 mb-4 px-2">ASSETS & CONFIG</p>
                  <SidebarLink href="/admin/onboarding/assets" label="Asset Inventory" isActive={isActive('/admin/onboarding/assets')} />
                  <SidebarLink href="/admin/onboarding/position-asset-checklist" label="Position Checklist" isActive={isActive('/admin/onboarding/position-asset-checklist')} />
                  <SidebarLink href="/admin/onboarding/workflow-templates" label="Workflow Templates" isActive={isActive('/admin/onboarding/workflow-templates')} />
                  <SidebarLink href="/admin/onboarding/email-templates" label="Email Templates" isActive={isActive('/admin/onboarding/email-templates')} />
                  
                  <div className="my-4 border-t border-gray-100 dark:border-gray-800"></div>
                  <p className="text-xs text-gray-500 mb-4 px-2">LOGS & REPORTS</p>
                  <SidebarLink href="/admin/onboarding/audit-log" label="Audit Log" isActive={isActive('/admin/onboarding/audit-log')} />
                  <SidebarLink href="/admin/onboarding/email-log" label="Email Log" isActive={isActive('/admin/onboarding/email-log')} />
                  <SidebarLink href="/admin/onboarding/analytics" label="Analytics" isActive={isActive('/admin/onboarding/analytics')} />
                </>
              )}

              {/* Hierarchy Content */}
              {activeCategory === 'Hierarchy' && (
                <>
                  <p className="text-xs text-gray-500 mb-4 px-2">ORGANIZATION STRUCTURE</p>
                  <SidebarLink href="/admin/hierarchy/dashboard" label="Dashboard & Health" isActive={isActive('/admin/hierarchy/dashboard')} />
                  <SidebarLink href="/admin/hierarchy/org-chart" label="Org Chart" isActive={isActive('/admin/hierarchy/org-chart')} />
                  
                  <div className="my-4 border-t border-gray-100 dark:border-gray-800"></div>
                  <p className="text-xs text-gray-500 mb-4 px-2">MASTER DATA</p>
                  <SidebarLink href="/admin/hierarchy/positions" label="Position Master" isActive={isActive('/admin/hierarchy/positions')} />
                  <SidebarLink href="/admin/hierarchy/departments" label="Department Master" isActive={isActive('/admin/hierarchy/departments')} />
                  <SidebarLink href="/admin/hierarchy/designations" label="Designation Master" isActive={isActive('/admin/hierarchy/designations')} />
                  <SidebarLink href="/admin/hierarchy/branches" label="Branch Master" isActive={isActive('/admin/hierarchy/branches')} />
                  <SidebarLink href="/admin/hierarchy/locations" label="Location Master" isActive={isActive('/admin/hierarchy/locations')} />
                  
                  <div className="my-4 border-t border-gray-100 dark:border-gray-800"></div>
                  <p className="text-xs text-gray-500 mb-4 px-2">OPERATIONS</p>
                  <SidebarLink href="/admin/hierarchy/assign-employee" label="Assign Employee" isActive={isActive('/admin/hierarchy/assign-employee')} />
                  <SidebarLink href="/admin/hierarchy/reporting-line" label="Reporting Line" isActive={isActive('/admin/hierarchy/reporting-line')} />
                  <SidebarLink href="/admin/hierarchy/position-history" label="Position History" isActive={isActive('/admin/hierarchy/position-history')} />
                </>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}