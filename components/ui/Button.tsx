import React from 'react';
import { motion } from 'framer-motion';
import Loader from './Loader';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
  isLoading?: boolean; // New prop
  size?: 'sm' | 'md' | 'lg'; // Added size prop for consistency
}

export default function Button({ children, variant = 'primary', isLoading = false, size = 'md', ...props }: ButtonProps) {
  const baseClasses = 'rounded-md font-medium transition-colors duration-300';
  const sizeClasses = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-5 py-3 text-lg',
  };
  const variantClasses = {
    primary: 'bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff] text-white border border-transparent hover:from-[#e0c9ef] hover:to-[#b9c9ef]',
    secondary: 'bg-gray-200 text-gray-800 border border-gray-300 hover:bg-gray-300',
    ghost: 'bg-transparent text-gray-700 dark:text-gray-300 border border-transparent hover:bg-gray-100 dark:hover:bg-gray-700',
    destructive: 'bg-red-600 text-white border border-transparent hover:bg-red-700',
    outline: 'bg-transparent text-gray-700 border border-gray-300 hover:bg-gray-50',
  };

  return (
    <motion.button
      suppressHydrationWarning
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} flex items-center justify-center ${props.disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      whileHover={!(props.disabled || isLoading) ? { scale: 1.05 } : {}}
      whileTap={!(props.disabled || isLoading) ? { scale: 0.95 } : {}}
      {...props}
      disabled={props.disabled || isLoading} // Ensure disabled prop is passed
    >
      {isLoading ? <Loader /> : children}
    </motion.button>
  );
}
