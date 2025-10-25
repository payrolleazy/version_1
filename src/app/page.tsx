'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Dashboard from '@/components/Dashboard'
import type { Session } from '@supabase/supabase-js'

export default function Home() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
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
            className="w-full relative flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-400 text-white p-8"
          >
            <div className="text-center z-10">
              <h1 className="text-5xl font-bold drop-shadow-lg">Welcome to Payrolleazy</h1>
              <p className="mt-4 text-xl opacity-95">Your seamless payroll solution.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
