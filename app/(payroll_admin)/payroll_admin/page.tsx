'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Button from '@/components/ui/Button';

export default function PayrollAdminDashboard() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [supabase] = useState(() => createClientComponentClient());

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

  useEffect(() => {
    if (!loading && !session) {
      router.push('/payroll_admin/auth/login');
    }
  }, [loading, session, router]);

  const handleLogout = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error);
    } else {
      console.log('Successfully logged out, redirecting to payroll_admin login page.');
      router.push('/payroll_admin/auth/login'); // Redirect to payroll_admin login
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-foreground mb-4">Welcome, Payroll Admin {session.user.email}!</h1>
      <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">This is your Payroll Admin Dashboard.</p>
      <Button onClick={handleLogout} disabled={loading}>
        Logout
      </Button>
    </div>
  );
}
