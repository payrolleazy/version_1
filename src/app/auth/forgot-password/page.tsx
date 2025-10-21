'use client'

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('Password reset link sent to your email.');
    }

    setLoading(false);
  };

  return (
    <div className="w-full max-w-md">
      <h2 className="text-2xl font-bold mb-4">Forgot your password?</h2>
      <p className="text-gray-600 mb-4">Enter your email address and we will send you a link to reset your password.</p>
      <form onSubmit={handleForgotPassword} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
          <Input
            type="email"
            id="email"
            onChange={(e) => setEmail(e.target.value)}
            value={email}
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Send Reset Link'}
        </Button>
        {message && <p className="text-green-500 text-sm">{message}</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </form>
    </div>
  );
}
