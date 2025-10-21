import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Loader from './Loader';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export default function Button({ children, variant = 'primary', ...props }: ButtonProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const baseClasses = 'px-4 py-0.5 rounded-md font-medium transition-colors duration-300';
  const variantClasses = {
    primary: 'bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff] text-white border border-transparent hover:from-[#e0c9ef] hover:to-[#b9c9ef]',
    secondary: 'bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff] text-white border border-transparent hover:from-[#e0c9ef] hover:to-[#b9c9ef]',
  };

  if (!mounted) {
    return (
      <button
        className={`${baseClasses} ${variantClasses[variant]} flex items-center justify-center`}
        {...props}
      >
        {props.disabled ? <Loader /> : children}
      </button>
    );
  }

  return (
    <motion.button
      className={`${baseClasses} ${variantClasses[variant]} flex items-center justify-center`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      {...props}
    >
      {props.disabled ? <Loader /> : children}
    </motion.button>
  );
}
