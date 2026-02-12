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
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [stateToken, setStateToken] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/secure-employee-signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ email, password, configId: 'beff81c1-0ef5-443d-8d5b-c6dfe10f632a' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'An unknown error occurred.');
      }

      if (data.status === 'otp_sent') {
        setShowOtpInput(true);
        setStateToken(data.state_token);
        setMessage('An OTP has been sent to your email.');
      } else {
        const { session, error } = data;
        if (error) {
          throw new Error(error);
        }
        
        if (session) {
          const { error: sessionError } = await supabase.auth.setSession(session);
          if (sessionError) {
              throw new Error(sessionError.message);
          }
          router.push('/');
        } else {
          throw new Error('Login failed: No session returned.');
        }
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/secure-employee-signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ otp, state_token: stateToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'An unknown error occurred.');
      }

      const { session, error } = data;
      if (error) {
        throw new Error(error);
      }
      
      if (session) {
        const { error: sessionError } = await supabase.auth.setSession(session);
        if (sessionError) {
            throw new Error(sessionError.message);
        }
        router.push('/');
      } else {
        throw new Error('Login failed: No session returned.');
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" }}
      transition={{ duration: 0.2 }}
      className="w-full max-w-sm p-8 bg-white rounded-lg border border-gray-300 shadow-md"
    >
      <h2 className="text-2xl font-bold mb-4">{showOtpInput ? 'Enter OTP' : 'Login to your account'}</h2>
      {!showOtpInput ? (
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
        </form>
      ) : (
        <form onSubmit={handleOtpSubmit} className="space-y-4">
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-gray-700">One-Time Password</label>
            <Input
              type="text"
              id="otp"
              onChange={(e) => setOtp(e.target.value)}
              value={otp}
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </Button>
        </form>
      )}
      {message && <p className="text-red-500 text-sm">{message}</p>}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">Don&apos;t have an account? <Link href="/auth/signup"><Button variant="secondary" className="ml-2">Sign Up</Button></Link></p>
      </div>
    </motion.div>
  );
}