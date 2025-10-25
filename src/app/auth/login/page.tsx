'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
    } else {
      router.push('/');
    }

    setLoading(false);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" }}
      transition={{ duration: 0.2 }}
      className="w-full max-w-sm p-8 bg-white rounded-lg border border-gray-300 shadow-md"
    >
      <h2 className="text-2xl font-bold mb-4">Login to your account</h2>
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
          <Input
            type="email"
            id="email"
            onChange={(e) => setEmail(e.target.value)}
            value={email}
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
          <Input
            type="password"
            id="password"
            onChange={(e) => setPassword(e.target.value)}
            value={password}
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Login'}
        </Button>
        {message && <p className="text-red-500 text-sm">{message}</p>}
      </form>
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">Don&apos;t have an account? <Link href="/auth/signup"><Button variant="secondary" className="ml-2">Sign Up</Button></Link></p>
      </div>
    </motion.div>
  );
}