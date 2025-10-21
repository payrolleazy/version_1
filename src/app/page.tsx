'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Dashboard from '@/components/Dashboard'
import Button from '@/components/ui/Button'

export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div >
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {session ? (
        <Dashboard session={session} />
      ) : (
        <div className="min-h-screen flex flex-row bg-gray-50 dark:bg-gray-900">
          {/* Welcome Part (3 units) */}
          <div
            className="w-full relative flex items-center justify-center bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff] text-white p-8"
          >
            <div className="text-center z-10">
              <h1 className="text-5xl font-bold">Welcome to Payrolleazy</h1>
              <p className="mt-4 text-xl">Your seamless payroll solution.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
