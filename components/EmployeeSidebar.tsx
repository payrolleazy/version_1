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

export default function EmployeeSidebar() {
  const pathname = usePathname();
  const [activeCategory, setActiveCategory] = useState<string>('Dashboard');

  const isActive = (href: string) => pathname === href;

  // Auto-select category based on current URL
  useEffect(() => {
    if (pathname.includes('/employee/hierarchy')) {
      setActiveCategory('Organization');
    } else if (pathname.includes('/employee/onboarding')) {
      setActiveCategory('Onboarding');
    } else if (pathname.includes('/employee/attendance/regularization')) {
      setActiveCategory('Regularization');
    } else if (pathname.includes('/employee/attendance/leave')) {
      setActiveCategory('Leave');
    } else if (pathname.includes('/employee/attendance')) {
      setActiveCategory('Attendance');
    } else if (pathname.includes('/employee/manager')) {
      setActiveCategory('Manager');
    } else if (pathname === '/employee') {
      setActiveCategory('Dashboard');
    }
  }, [pathname]);

  return (
    <aside className="w-[320px] h-screen flex sticky top-0 bg-gray-50 dark:bg-gray-900 shadow-xl z-50 font-sans">

      {/* --- LEFT RAIL (Fixed Categories) --- */}
      <div className="w-[80px] bg-gradient-to-b from-[#e0c9ef] to-[#b9c9ef] flex flex-col items-center py-4 space-y-2 z-20 shadow-lg overflow-y-auto scrollbar-none border-r border-purple-200/50">

        {/* Dashboard */}
        <RailItem
          id="Dashboard"
          label="Home"
          isActive={activeCategory === 'Dashboard'}
          onClick={() => setActiveCategory('Dashboard')}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          }
        />

        <div className="w-8 h-px bg-purple-300/50 my-2"></div>

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

        {/* Regularization */}
        <RailItem
          id="Regularization"
          label="Regular"
          isActive={activeCategory === 'Regularization'}
          onClick={() => setActiveCategory('Regularization')}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
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

        {/* Organization */}
        <RailItem
          id="Organization"
          label="Org"
          isActive={activeCategory === 'Organization'}
          onClick={() => setActiveCategory('Organization')}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />

        <div className="w-8 h-px bg-purple-300/50 my-2"></div>

        {/* Manager (Only shown if user has manager role) */}
        <RailItem
          id="Manager"
          label="Team"
          isActive={activeCategory === 'Manager'}
          onClick={() => setActiveCategory('Manager')}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
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
                  <SidebarLink href="/employee" label="My Dashboard" isActive={isActive('/employee')} />
                  <div className="mt-8 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                    <p className="text-sm text-purple-800 dark:text-purple-200">Welcome to the Employee Portal. Select a module from the left rail to begin.</p>
                  </div>
                </div>
              )}

              {/* Attendance Content */}
              {activeCategory === 'Attendance' && (
                <>
                  <p className="text-xs text-gray-500 mb-4 px-2">MY ATTENDANCE</p>
                  <SidebarLink href="/employee/attendance" label="Attendance Dashboard" isActive={isActive('/employee/attendance')} />
                  <SidebarLink href="/employee/attendance/history" label="Attendance History" isActive={isActive('/employee/attendance/history')} />
                  <SidebarLink href="/employee/attendance/holidays" label="Holiday Calendar" isActive={isActive('/employee/attendance/holidays')} />
                </>
              )}

              {/* Leave Content */}
              {activeCategory === 'Leave' && (
                <>
                  <p className="text-xs text-gray-500 mb-4 px-2">LEAVE MANAGEMENT</p>
                  <SidebarLink href="/employee/attendance/leave" label="Leave Dashboard" isActive={isActive('/employee/attendance/leave')} />
                  <SidebarLink href="/employee/attendance/leave/apply" label="Apply for Leave" isActive={isActive('/employee/attendance/leave/apply')} />
                  <SidebarLink href="/employee/attendance/leave/history" label="Leave History" isActive={isActive('/employee/attendance/leave/history')} />
                  <SidebarLink href="/employee/attendance/leave/ledger" label="Balance Ledger" isActive={isActive('/employee/attendance/leave/ledger')} />
                  <SidebarLink href="/employee/attendance/holidays" label="Holiday Calendar" isActive={isActive('/employee/attendance/holidays')} />
                </>
              )}

              {/* Regularization Content */}
              {activeCategory === 'Regularization' && (
                <>
                  <p className="text-xs text-gray-500 mb-4 px-2">REGULARIZATION</p>
                  <SidebarLink href="/employee/attendance/regularization/apply" label="Apply Regularization" isActive={isActive('/employee/attendance/regularization/apply')} />
                  <SidebarLink href="/employee/attendance/regularization/requests" label="My Requests" isActive={isActive('/employee/attendance/regularization/requests')} />
                </>
              )}

              {/* Onboarding Content */}
              {activeCategory === 'Onboarding' && (
                <>
                  <p className="text-xs text-gray-500 mb-4 px-2">ONBOARDING</p>
                  <SidebarLink href="/employee/onboarding" label="My Onboarding Status" isActive={isActive('/employee/onboarding')} />
                </>
              )}

              {/* Organization Content */}
              {activeCategory === 'Organization' && (
                <>
                  <p className="text-xs text-gray-500 mb-4 px-2">MY ORGANIZATION</p>
                  <SidebarLink href="/employee/hierarchy/my-profile" label="My Org Profile" isActive={isActive('/employee/hierarchy/my-profile')} />
                  <SidebarLink href="/employee/hierarchy/org-chart" label="Org Chart" isActive={isActive('/employee/hierarchy/org-chart')} />
                  <SidebarLink href="/employee/hierarchy/reporting-line" label="My Reporting Line" isActive={isActive('/employee/hierarchy/reporting-line')} />
                </>
              )}

              {/* Manager Content */}
              {activeCategory === 'Manager' && (
                <>
                  <p className="text-xs text-gray-500 mb-4 px-2">TEAM MANAGEMENT</p>
                  <SidebarLink href="/employee/manager/attendance" label="Team Dashboard" isActive={isActive('/employee/manager/attendance')} />
                  <SidebarLink href="/employee/manager/leave/approval" label="Leave Approvals" isActive={isActive('/employee/manager/leave/approval')} />
                  <SidebarLink href="/employee/manager/leave/history" label="Team Leave History" isActive={isActive('/employee/manager/leave/history')} />
                  <SidebarLink href="/employee/manager/attendance/records" label="Team Records" isActive={isActive('/employee/manager/attendance/records')} />
                  <SidebarLink href="/employee/manager/attendance/approvals" label="Regularization Approvals" isActive={isActive('/employee/manager/attendance/approvals')} />
                </>
              )}

              

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}
