'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

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

  return (
    <nav className="bg-background border border-gray-300 shadow-md">
      <div className="container mx-auto flex justify-between items-center p-4">
        <Link href="/">
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