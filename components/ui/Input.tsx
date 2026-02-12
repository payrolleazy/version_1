'use client'

import React from 'react';
import { motion } from 'framer-motion';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export default function Input({ ...props }: InputProps) {
  return (
    <motion.input
      suppressHydrationWarning
      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm"
      {...props}
    />
  );
}