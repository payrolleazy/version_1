'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';

// Navigation sections for Admin Dashboard
const ADMIN_SECTIONS = [
  {
    title: 'Attendance Management',
    description: 'Manage shifts, schedules, holidays, and attendance settings',
    color: 'bg-blue-500',
    links: [
      { label: 'Shift Management', href: '/admin/attendance/shifts', icon: '⏰' },
      { label: 'Employee Schedules', href: '/admin/attendance/schedules', icon: '📅' },
      { label: 'Geofence Locations', href: '/admin/attendance/geofences', icon: '📍' },
      { label: 'Holiday Calendar', href: '/admin/attendance/holidays', icon: '🗓️' },
      { label: 'Attendance Settings', href: '/admin/attendance/settings', icon: '⚙️' },
    ],
  },
  {
    title: 'Leave Management',
    description: 'Configure leave types, policies, and assignments',
    color: 'bg-green-500',
    links: [
      { label: 'Leave Types', href: '/admin/leave/types', icon: '📋' },
      { label: 'Leave Policies', href: '/admin/leave/policies', icon: '📜' },
    ],
  },
  {
    title: 'Payroll Processing',
    description: 'Manage monthly payroll batches and processing',
    color: 'bg-purple-500',
    links: [
      { label: 'Payroll Batches', href: '/admin/payroll/batches', icon: '💰' },
      { label: 'Create New Batch', href: '/admin/payroll/batches/create', icon: '➕' },
    ],
  },
  {
    title: 'User Management',
    description: 'Manage user roles and permissions',
    color: 'bg-orange-500',
    links: [
      { label: 'Employee Roles', href: '/admin/employee-roles', icon: '👤' },
      { label: 'User Roles', href: '/admin/user-roles', icon: '🔐' },
    ],
  },
];

export default function AdminDashboard() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error);
    } else {
      console.log('Successfully logged out, redirecting to admin login page.');
      router.push('/admin/auth/login');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    router.push('/admin/auth/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-500">Welcome, {session.user.email}</p>
            </div>
            <Button onClick={handleLogout} variant="secondary" disabled={loading}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ADMIN_SECTIONS.map((section, sectionIndex) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: sectionIndex * 0.1 }}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
            >
              {/* Section Header */}
              <div className={`${section.color} px-6 py-4`}>
                <h2 className="text-lg font-bold text-white">{section.title}</h2>
                <p className="text-white/80 text-sm">{section.description}</p>
              </div>

              {/* Section Links */}
              <div className="p-4">
                <div className="space-y-2">
                  {section.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <span className="text-xl">{link.icon}</span>
                      <span className="text-gray-700 group-hover:text-gray-900 font-medium">
                        {link.label}
                      </span>
                      <svg
                        className="w-4 h-4 text-gray-400 ml-auto group-hover:text-gray-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Quick Stats Placeholder */}
        <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-700">-</div>
              <div className="text-sm text-blue-600">Total Employees</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-700">-</div>
              <div className="text-sm text-green-600">Present Today</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-700">-</div>
              <div className="text-sm text-yellow-600">Pending Approvals</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-700">-</div>
              <div className="text-sm text-purple-600">Open Batches</div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 text-center">
            Stats will be populated from real data
          </p>
        </div>
      </main>
    </div>
  );
}