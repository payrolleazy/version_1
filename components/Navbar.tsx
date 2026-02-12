'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import { usePathname } from 'next/navigation'

// Super Admin Role ID
const SUPER_ADMIN_ROLE_ID = '95b1c199-b3c1-428e-bbb4-0722429f3c96';

export default function Navbar() {
  const [supabase] = useState(() => createClientComponentClient())
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const checkSessionAndRoles = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      if (session) {
        // Check user roles
        const { data: userRoles, error: rolesError } = await supabase
          .from('UserRoles')
          .select('roleId')
          .eq('userId', session.user.id);

        if (rolesError) {
          console.error('Error fetching user roles:', rolesError);
          setIsSuperAdmin(false);
        } else {
          const userRoleIds = userRoles?.map((r) => r.roleId) || [];
          setIsSuperAdmin(userRoleIds.includes(SUPER_ADMIN_ROLE_ID));
        }
      } else {
        setIsSuperAdmin(false);
      }
      setLoading(false);
    };

    checkSessionAndRoles();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // Re-check roles on auth state change
      if (session) {
        supabase
          .from('UserRoles')
          .select('roleId')
          .eq('userId', session.user.id)
          .then(({ data: userRoles, error: rolesError }) => {
            if (rolesError) {
              console.error('Error fetching user roles on auth change:', rolesError);
              setIsSuperAdmin(false);
            } else {
              const userRoleIds = userRoles?.map((r) => r.roleId) || [];
              setIsSuperAdmin(userRoleIds.includes(SUPER_ADMIN_ROLE_ID));
            }
          });
      } else {
        setIsSuperAdmin(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error logging out:', error)
    } else {
      console.log('Successfully logged out, redirecting to login page.')
      router.push('/auth/login')
    }
    setLoading(false)
  }

  const showGetStartedButton = !session && pathname !== '/auth/login' && pathname !== '/auth/signup'

  // Determine the correct dashboard link based on user role
  const dashboardLink = session && isSuperAdmin ? '/super_admin' : '/'; // <--- New logic

  return (
    <nav className="bg-background border border-gray-300 shadow-md">
      <div className="container mx-auto flex justify-between items-center p-4">
        <Link href={dashboardLink}> {/* <--- Use dashboardLink here */}
          <p className="text-xl font-bold text-primary">Payrolleazy</p>
        </Link>
        <div className="flex space-x-4 items-center">

          {showGetStartedButton ? (
            <Link href="/auth/login">
              <Button variant="primary">Get Started</Button>
            </Link>
          ) : session ? (
            <Button onClick={handleLogout} disabled={loading}>
              Logout
            </Button>
          ) : null}
        </div>
      </div>
    </nav>
  )
}