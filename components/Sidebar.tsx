'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

// Reusable accordion link component
interface AccordionLinkProps {
  href: string;
  label: string;
  isActive: boolean;
}

const AccordionLink = ({ href, label, isActive }: AccordionLinkProps) => (
  <Link href={href} passHref>
    <p className={`block p-2 text-sm rounded-md transition-all duration-300 ease-in-out ${
      isActive
        ? 'text-purple-700 font-medium bg-purple-50 dark:bg-purple-900/30 dark:text-purple-200'
        : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'
    }`}>
      {label}
    </p>
  </Link>
);

export default function AdminSidebar() {
  const pathname = usePathname();
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  const toggleAccordion = (menuTitle: string) => {
    setOpenAccordion(openAccordion === menuTitle ? null : menuTitle);
  };

  const isActive = (href: string) => pathname === href;
  const isInSection = (section: string) => pathname.includes(section);

  // Auto-expand accordion based on current path
  useEffect(() => {
    if (pathname.includes('/admin/onboarding')) {
      setOpenAccordion('Onboarding');
    } else if (pathname.includes('/admin/attendance')) {
      setOpenAccordion('Attendance');
    } else if (pathname.includes('/admin/leave')) {
      setOpenAccordion('Leave');
    } else if (pathname.includes('/admin/payroll')) {
      setOpenAccordion('Payroll');
    } else if (pathname.includes('/admin/user-roles') || pathname.includes('/admin/employee-roles')) {
      setOpenAccordion('User Management');
    } else if (pathname.includes('/admin/hierarchy')) {
      setOpenAccordion('Hierarchy');
    }
    
  }, [pathname]);

  return (
    <motion.aside
      className="w-64 bg-white dark:bg-gray-800 shadow-lg overflow-y-auto h-screen sticky top-0"
      initial={{ x: '-100%' }}
      animate={{ x: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      {/* Logo/Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">Admin Portal</h1>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {/* Dashboard Link */}
        <div className="mb-4">
          <Link href="/admin" className={`flex items-center p-3 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group ${isActive('/admin') ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30' : ''}`}>
            <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="font-medium">Dashboard</span>
          </Link>
        </div>

        {/* Attendance Management Accordion */}
        <div className="mb-2">
          <button
            onClick={() => toggleAccordion('Attendance')}
            className={`w-full text-left text-base font-medium p-3 rounded-md transition-all duration-300 ease-in-out flex justify-between items-center ${
              isInSection('/admin/attendance')
                ? 'text-purple-700 bg-purple-50 dark:bg-purple-900/30'
                : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'
            }`}
          >
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Attendance
            </span>
            <span className="text-xs">{openAccordion === 'Attendance' ? '▲' : '▼'}</span>
          </button>
          {openAccordion === 'Attendance' && (
            <div className="pl-4 mt-1 space-y-1">
              <AccordionLink href="/admin/attendance/shifts" label="Shift Management" isActive={isActive('/admin/attendance/shifts')} />
              <AccordionLink href="/admin/attendance/schedules" label="Employee Schedules" isActive={isActive('/admin/attendance/schedules')} />
              <AccordionLink href="/admin/attendance/geofences" label="Geofence Locations" isActive={isActive('/admin/attendance/geofences')} />
              <AccordionLink href="/admin/attendance/holidays" label="Holiday Calendar" isActive={isActive('/admin/attendance/holidays')} />
              <AccordionLink href="/admin/attendance/settings" label="Attendance Settings" isActive={isActive('/admin/attendance/settings')} />
            </div>
          )}
        </div>

        {/* Leave Management Accordion */}
        <div className="mb-2">
          <button
            onClick={() => toggleAccordion('Leave')}
            className={`w-full text-left text-base font-medium p-3 rounded-md transition-all duration-300 ease-in-out flex justify-between items-center ${
              isInSection('/admin/leave')
                ? 'text-purple-700 bg-purple-50 dark:bg-purple-900/30'
                : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'
            }`}
          >
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Leave Management
            </span>
            <span className="text-xs">{openAccordion === 'Leave' ? '▲' : '▼'}</span>
          </button>
          {openAccordion === 'Leave' && (
            <div className="pl-4 mt-2 space-y-1">
              <AccordionLink href="/admin/leave/types" label="Leave Types" isActive={isActive('/admin/leave/types')} />
              <AccordionLink href="/admin/leave/policies" label="Leave Policies" isActive={isActive('/admin/leave/policies')} />
              <AccordionLink href="/admin/leave/analytics" label="Leave Analytics" isActive={isActive('/admin/leave/analytics')} />
              <AccordionLink href="/admin/leave/assignments" label="Policy Assignments" isActive={isActive('/admin/leave/assignments')} />
            </div>
          )}
        </div>

        {/* Payroll Processing Accordion */}
        <div className="mb-2">
          <button
            onClick={() => toggleAccordion('Payroll')}
            className={`w-full text-left text-base font-medium p-3 rounded-md transition-all duration-300 ease-in-out flex justify-between items-center ${
              isInSection('/admin/payroll')
                ? 'text-purple-700 bg-purple-50 dark:bg-purple-900/30'
                : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'
            }`}
          >
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Payroll
            </span>
            <span className="text-xs">{openAccordion === 'Payroll' ? '▲' : '▼'}</span>
          </button>
          {openAccordion === 'Payroll' && (
            <div className="pl-4 mt-1 space-y-1">
              <AccordionLink href="/admin/payroll/batches" label="Payroll Batches" isActive={isActive('/admin/payroll/batches')} />
              <AccordionLink href="/admin/payroll/batches/create" label="Create New Batch" isActive={isActive('/admin/payroll/batches/create')} />
            </div>
          )}
        </div>

        {/* User Management Accordion */}
        <div className="mb-2">
          <button
            onClick={() => toggleAccordion('User Management')}
            className={`w-full text-left text-base font-medium p-3 rounded-md transition-all duration-300 ease-in-out flex justify-between items-center ${
              (isActive('/admin/user-roles') || isActive('/admin/employee-roles'))
                ? 'text-purple-700 bg-purple-50 dark:bg-purple-900/30'
                : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'
            }`}
          >
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              User Management
            </span>
            <span className="text-xs">{openAccordion === 'User Management' ? '▲' : '▼'}</span>
          </button>
          {openAccordion === 'User Management' && (
            <div className="pl-4 mt-1 space-y-1">
              <AccordionLink href="/admin/user-roles" label="Candidates" isActive={isActive('/admin/user-roles')} />
              <AccordionLink href="/admin/employee-roles" label="Employees" isActive={isActive('/admin/employee-roles')} />
            </div>
          )}
        </div>

        {/* Onboarding Accordion */}
        <div className="mb-2">
          <button
            onClick={() => toggleAccordion('Onboarding')}
            className={`w-full text-left text-base font-medium p-3 rounded-md transition-all duration-300 ease-in-out flex justify-between items-center ${
              isInSection('/admin/onboarding')
                ? 'text-purple-700 bg-purple-50 dark:bg-purple-900/30'
                : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'
            }`}
          >
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Onboarding
            </span>
            <span className="text-xs">{openAccordion === 'Onboarding' ? '▲' : '▼'}</span>
          </button>
          {openAccordion === 'Onboarding' && (
            <div className="pl-4 mt-1 space-y-1">
              <AccordionLink href="/admin/onboarding/dashboard" label="Dashboard" isActive={isActive('/admin/onboarding/dashboard')} />
              <AccordionLink href="/admin/onboarding/pending-hires" label="Pending Hires" isActive={isActive('/admin/onboarding/pending-hires')} />
              <AccordionLink href="/admin/onboarding/active-workflows" label="Active Workflows" isActive={isActive('/admin/onboarding/active-workflows')} />
              <AccordionLink href="/admin/onboarding/assets" label="Asset Inventory" isActive={isActive('/admin/onboarding/assets')} />
              <AccordionLink href="/admin/onboarding/position-asset-checklist" label="Position Checklist" isActive={isActive('/admin/onboarding/position-asset-checklist')} />
              <AccordionLink href="/admin/onboarding/workflow-templates" label="Workflow Templates" isActive={isActive('/admin/onboarding/workflow-templates')} />
              <AccordionLink href="/admin/onboarding/email-templates" label="Email Templates" isActive={isActive('/admin/onboarding/email-templates')} />
              <AccordionLink href="/admin/onboarding/audit-log" label="Audit Log" isActive={isActive('/admin/onboarding/audit-log')} />
              <AccordionLink href="/admin/onboarding/email-log" label="Email Log" isActive={isActive('/admin/onboarding/email-log')} />
              <AccordionLink href="/admin/onboarding/analytics" label="Analytics" isActive={isActive('/admin/onboarding/analytics')} />
            </div>
          )}
        </div>

        {/* Hierarchy Management Accordion */}
        <div className="mb-2">
          <button
            onClick={() => toggleAccordion('Hierarchy')}
            className={`w-full text-left text-base font-medium p-3 rounded-md transition-all duration-300 ease-in-out flex justify-between items-center ${
              isInSection('/admin/hierarchy')
                ? 'text-purple-700 bg-purple-50 dark:bg-purple-900/30'
                : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'
            }`}
          >
            <span className="flex items-center">
              {/* Organization Chart / Hierarchy Icon */}
              <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Hierarchy
            </span>
            <span className="text-xs">{openAccordion === 'Hierarchy' ? '▲' : '▼'}</span>
          </button>
          {openAccordion === 'Hierarchy' && (
            <div className="pl-4 mt-1 space-y-1">
              <AccordionLink href="/admin/hierarchy/dashboard" label="Dashboard & Health" isActive={isActive('/admin/hierarchy/dashboard')} />
              <AccordionLink href="/admin/hierarchy/org-chart" label="Org Chart" isActive={isActive('/admin/hierarchy/org-chart')} />
              <AccordionLink href="/admin/hierarchy/positions" label="Position Master" isActive={isActive('/admin/hierarchy/positions')} />
              <AccordionLink href="/admin/hierarchy/departments" label="Department Master" isActive={isActive('/admin/hierarchy/departments')} />
              <AccordionLink href="/admin/hierarchy/designations" label="Designation Master" isActive={isActive('/admin/hierarchy/designations')} />
              <AccordionLink href="/admin/hierarchy/branches" label="Branch Master" isActive={isActive('/admin/hierarchy/branches')} />
              <AccordionLink href="/admin/hierarchy/locations" label="Location Master" isActive={isActive('/admin/hierarchy/locations')} />
              
              {/* Added Link */}
              <AccordionLink href="/admin/hierarchy/assign-employee" label="Assign Employee" isActive={isActive('/admin/hierarchy/assign-employee')} />
              
              <AccordionLink href="/admin/hierarchy/reporting-line" label="Reporting Line" isActive={isActive('/admin/hierarchy/reporting-line')} />
              <AccordionLink href="/admin/hierarchy/position-history" label="Position History" isActive={isActive('/admin/hierarchy/position-history')} />
            </div>
          )}
        </div>

      </nav>
    </motion.aside>
  );
}