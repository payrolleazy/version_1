'use client'

import { Inconsolata } from "next/font/google";
import "@/app/globals.css";
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

// Initialize the font with subsets
const inconsolata = Inconsolata({ subsets: ["latin"] });

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { SessionContextProvider } from '@supabase/auth-helpers-react'

import Navbar from '@/components/Navbar'
import EmployeeSidebar from '@/components/EmployeeSidebar'
import { useState } from 'react'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [supabase] = useState(() => createClientComponentClient())

  // Hide sidebar on login page
  const isAuthPage = pathname?.includes('/auth/');

  return (
    <html lang="en">
      <body className={`${inconsolata.className} antialiased`}>
        <SessionContextProvider supabaseClient={supabase}>
          <Navbar />
          <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
            {!isAuthPage && <EmployeeSidebar />}
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex-1 p-4"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </SessionContextProvider>
      </body>
    </html>
  );
}