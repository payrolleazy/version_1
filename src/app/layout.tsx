'use client'

import { Inconsolata } from "next/font/google";
import "./globals.css";
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

// Initialize the font with subsets
const inconsolata = Inconsolata({ subsets: ["latin"] });

import Navbar from '@/components/Navbar'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  return (
    <html lang="en">
      {/* Apply the font's className directly to the body */}
      <body className={`${inconsolata.className} antialiased`}>
        <Navbar />
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </body>
    </html>
  );
}