'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

export default function MasterAdminSidebar() {
  const pathname = usePathname();
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  const toggleAccordion = (menuTitle: string) => {
    setOpenAccordion(openAccordion === menuTitle ? null : menuTitle);
  };

  const isActive = (href: string) => pathname === href;
  const isInSection = (section: string) => pathname.includes(section);

  // Auto-expand accordion based on current path
  useEffect(() => {
    if (pathname.includes('/master_admin/onboarding')) {
      setOpenAccordion('Onboarding');
    } else if (pathname.includes('/master_admin/org_info')) {
      setOpenAccordion('Organization');
    } else if (pathname.includes('/master_admin/change_requests')) {
      setOpenAccordion('Workflow');
    } else if (pathname.includes('_role')) {
      setOpenAccordion('User Management');
    } else if (pathname.includes('/master_admin/hierarchy')) {
      setOpenAccordion('Hierarchy');
    }
  }, [pathname]);

  return (
    <motion.aside
      className="w-1/5 bg-white dark:bg-gray-800 shadow-lg p-4 overflow-y-auto"
      initial={{ x: '-100%' }}
      animate={{ x: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      <nav className="flex-1">
        {/* Dashboard Link - Direct, not in accordion */}
        <div className="mb-2">
          <Link href="/master_admin" className={`flex items-center p-2 text-gray-900 rounded-lg dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 group ${isActive('/master_admin') ? 'bg-gray-100 dark:bg-gray-700' : ''}`}>
               <span className="ms-3">Dashboard</span>
            </Link>
        </div>

        {/* Organization Accordion */}
        <div className="mb-2">
          <button
            onClick={() => toggleAccordion('Organization')}
            className="w-full text-left text-base font-medium p-3 rounded-md transition-all duration-300 ease-in-out text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff] focus:outline-none flex justify-between items-center">
            <span>Organization</span>
            <span>{openAccordion === 'Organization' ? '▲' : '▼'}</span>
          </button>
          {openAccordion === 'Organization' && (
            <div className="pl-4 mt-1 space-y-1">
              <Link href="/master_admin/org_info" passHref>
                <p
                  className={`block p-2 text-sm rounded-md transition-all duration-300 ease-in-out ${isActive('/master_admin/org_info') ? 'text-black font-medium' : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'}`}>
                  Organizational Info
                </p>
              </Link>
            </div>
          )}
        </div>

        {/* User Management Accordion */}
        <div className="mb-2">
          <button
            onClick={() => toggleAccordion('User Management')}
            className="w-full text-left text-base font-medium p-3 rounded-md transition-all duration-300 ease-in-out text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff] focus:outline-none flex justify-between items-center">
            <span>User Management</span>
            <span>{openAccordion === 'User Management' ? '▲' : '▼'}</span>
          </button>
          {openAccordion === 'User Management' && (
            <div className="pl-4 mt-1 space-y-1">
              <Link href="/master_admin/admin_role" passHref>
                <p
                  className={`block p-2 text-sm rounded-md transition-all duration-300 ease-in-out ${isActive('/master_admin/admin_role') ? 'text-black font-medium' : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'}`}>
                  Assign Admin Role
                </p>
              </Link>
              <Link href="/master_admin/recruiter_role" passHref>
                <p
                  className={`block p-2 text-sm rounded-md transition-all duration-300 ease-in-out ${isActive('/master_admin/recruiter_role') ? 'text-black font-medium' : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'}`}>
                  Assign Recruiter Role
                </p>
              </Link>
              <Link href="/master_admin/payroll_admin_role" passHref>
                <p
                  className={`block p-2 text-sm rounded-md transition-all duration-300 ease-in-out ${isActive('/master_admin/payroll_admin_role') ? 'text-black font-medium' : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'}`}>
                  Assign Payroll Admin Role
                </p>
              </Link>
              <Link href="/master_admin/retainer_role" passHref>
                <p
                  className={`block p-2 text-sm rounded-md transition-all duration-300 ease-in-out ${isActive('/master_admin/retainer_role') ? 'text-black font-medium' : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'}`}>
                  Assign Retainer Role
                </p>
              </Link>
              <Link href="/master_admin/intern_role" passHref>
                <p
                  className={`block p-2 text-sm rounded-md transition-all duration-300 ease-in-out ${isActive('/master_admin/intern_role') ? 'text-black font-medium' : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'}`}>
                  Assign Intern Role
                </p>
              </Link>
            </div>
          )}
        </div>

        {/* Workflow Accordion */}
        <div className="mb-2">
          <button
            onClick={() => toggleAccordion('Workflow')}
            className="w-full text-left text-base font-medium p-3 rounded-md transition-all duration-300 ease-in-out text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff] focus:outline-none flex justify-between items-center">
            <span>Workflow</span>
            <span>{openAccordion === 'Workflow' ? '▲' : '▼'}</span>
          </button>
          {openAccordion === 'Workflow' && (
            <div className="pl-4 mt-1 space-y-1">
              <Link href="/master_admin/change_requests" passHref>
                <p
                  className={`block p-2 text-sm rounded-md transition-all duration-300 ease-in-out ${isActive('/master_admin/change_requests') ? 'text-black font-medium' : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'}`}>
                  Approvals
                </p>
              </Link>
            </div>
          )}
        </div>

        {/* Hierarchy Accordion */}
        <div className="mb-2">
          <button
            onClick={() => toggleAccordion('Hierarchy')}
            className={`w-full text-left text-base font-medium p-3 rounded-md transition-all duration-300 ease-in-out flex justify-between items-center ${
              isInSection('/master_admin/hierarchy')
                ? 'text-purple-700 bg-purple-50 dark:bg-purple-900/30'
                : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'
            } focus:outline-none`}>
            <span>Hierarchy</span>
            <span className="text-xs">{openAccordion === 'Hierarchy' ? '▲' : '▼'}</span>
          </button>
          {openAccordion === 'Hierarchy' && (
            <div className="pl-4 mt-1 space-y-1">
              <Link href="/master_admin/hierarchy/dashboard" passHref>
                <p className={`block p-2 text-sm rounded-md transition-all duration-300 ease-in-out ${isActive('/master_admin/hierarchy/dashboard') ? 'text-purple-700 font-medium bg-purple-50' : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'}`}>Dashboard</p>
              </Link>
              <Link href="/master_admin/hierarchy/org-chart" passHref>
                <p className={`block p-2 text-sm rounded-md transition-all duration-300 ease-in-out ${isActive('/master_admin/hierarchy/org-chart') ? 'text-purple-700 font-medium bg-purple-50' : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'}`}>Org Chart</p>
              </Link>
            </div>
          )}
        </div>

        {/* Onboarding Accordion */}
        <div className="mb-2">
          <button
            onClick={() => toggleAccordion('Onboarding')}
            className={`w-full text-left text-base font-medium p-3 rounded-md transition-all duration-300 ease-in-out flex justify-between items-center ${
              isInSection('/master_admin/onboarding')
                ? 'text-purple-700 bg-purple-50 dark:bg-purple-900/30'
                : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'
            } focus:outline-none`}>
            <span>Onboarding</span>
            <span className="text-xs">{openAccordion === 'Onboarding' ? '▲' : '▼'}</span>
          </button>
          {openAccordion === 'Onboarding' && (
            <div className="pl-4 mt-1 space-y-1">
              <Link href="/master_admin/onboarding/dashboard" passHref>
                <p className={`block p-2 text-sm rounded-md transition-all duration-300 ease-in-out ${isActive('/master_admin/onboarding/dashboard') ? 'text-purple-700 font-medium bg-purple-50' : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'}`}>Dashboard</p>
              </Link>
              <Link href="/master_admin/onboarding/pending-hires" passHref>
                <p className={`block p-2 text-sm rounded-md transition-all duration-300 ease-in-out ${isActive('/master_admin/onboarding/pending-hires') ? 'text-purple-700 font-medium bg-purple-50' : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'}`}>Pending Hires</p>
              </Link>
              <Link href="/master_admin/onboarding/active-workflows" passHref>
                <p className={`block p-2 text-sm rounded-md transition-all duration-300 ease-in-out ${isActive('/master_admin/onboarding/active-workflows') ? 'text-purple-700 font-medium bg-purple-50' : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'}`}>Active Workflows</p>
              </Link>
              <Link href="/master_admin/onboarding/assets" passHref>
                <p className={`block p-2 text-sm rounded-md transition-all duration-300 ease-in-out ${isActive('/master_admin/onboarding/assets') ? 'text-purple-700 font-medium bg-purple-50' : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'}`}>Asset Inventory</p>
              </Link>
              <Link href="/master_admin/onboarding/position-asset-checklist" passHref>
                <p className={`block p-2 text-sm rounded-md transition-all duration-300 ease-in-out ${isActive('/master_admin/onboarding/position-asset-checklist') ? 'text-purple-700 font-medium bg-purple-50' : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'}`}>Position Checklist</p>
              </Link>
              <Link href="/master_admin/onboarding/workflow-templates" passHref>
                <p className={`block p-2 text-sm rounded-md transition-all duration-300 ease-in-out ${isActive('/master_admin/onboarding/workflow-templates') ? 'text-purple-700 font-medium bg-purple-50' : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'}`}>Workflow Templates</p>
              </Link>
              <Link href="/master_admin/onboarding/email-templates" passHref>
                <p className={`block p-2 text-sm rounded-md transition-all duration-300 ease-in-out ${isActive('/master_admin/onboarding/email-templates') ? 'text-purple-700 font-medium bg-purple-50' : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'}`}>Email Templates</p>
              </Link>
              <Link href="/master_admin/onboarding/audit-log" passHref>
                <p className={`block p-2 text-sm rounded-md transition-all duration-300 ease-in-out ${isActive('/master_admin/onboarding/audit-log') ? 'text-purple-700 font-medium bg-purple-50' : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'}`}>Audit Log</p>
              </Link>
              <Link href="/master_admin/onboarding/email-log" passHref>
                <p className={`block p-2 text-sm rounded-md transition-all duration-300 ease-in-out ${isActive('/master_admin/onboarding/email-log') ? 'text-purple-700 font-medium bg-purple-50' : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'}`}>Email Log</p>
              </Link>
              <Link href="/master_admin/onboarding/analytics" passHref>
                <p className={`block p-2 text-sm rounded-md transition-all duration-300 ease-in-out ${isActive('/master_admin/onboarding/analytics') ? 'text-purple-700 font-medium bg-purple-50' : 'text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]'}`}>Analytics</p>
              </Link>
            </div>
          )}
        </div>
      </nav>
    </motion.aside>
  );
}
