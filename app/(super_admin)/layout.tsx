'use client'

import { Inconsolata } from "next/font/google";
import "@/app/globals.css";
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

// Initialize the font with subsets
const inconsolata = Inconsolata({ subsets: ["latin"] });

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { SessionContextProvider, useSessionContext } from '@supabase/auth-helpers-react' // <--- Import useSessionContext

import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'
import { useState } from 'react'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [supabase] = useState(() => createClientComponentClient())

  return (
    <html lang="en">
      <body className={`${inconsolata.className} antialiased`}>
        <SessionContextProvider supabaseClient={supabase}>
          <LayoutContent pathname={pathname}> {/* <--- New wrapper component */}
            {children}
          </LayoutContent>
        </SessionContextProvider>
      </body>
    </html>
  );
}

// New component to handle conditional rendering of Sidebar
function LayoutContent({ children, pathname }: { children: React.ReactNode, pathname: string }) {
  const { session } = useSessionContext(); // <--- Get session here

  // Check if the current path is an authentication page
  const isAuthPage = pathname.startsWith('/super_admin/auth');

  return (
    <>
      <Navbar />
      <div className="flex min-h-screen">
        {!isAuthPage && session && <Sidebar />} {/* <--- Conditionally render Sidebar */}
        <main className="flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex items-center justify-center"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </>
  );
}