'use client'

'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';

export default function MasterAdminDashboard() {
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
      console.log('Successfully logged out, redirecting to master admin login page.');
      router.push('/master_admin/auth/login'); // Redirect to master admin login
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
    router.push('/master_admin/auth/login'); // Redirect if no session
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-foreground mb-4">Welcome, Master Admin {session.user.email}!</h1>
      <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">This is your Master Admin Dashboard.</p>
      <Button onClick={handleLogout} disabled={loading}>
        Logout
      </Button>
    </div>
  );
}
