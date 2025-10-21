import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';

export default function Step3({ prevStep, values }: { prevStep: () => void, values: any }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleSubmit = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(process.env.NEXT_PUBLIC_SUPABASE_EDGE_FUNCTION_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          full_name: values.fullName,
          mobile_no: values.mobileNo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error) {
          if (typeof data.error === 'object' && data.error.server) {
            setMessage(data.error.server);
          } else if (typeof data.error === 'object') {
            const fieldErrors = Object.values(data.error).flat().join('; ');
            setMessage(fieldErrors || 'An unexpected validation error occurred.');
          } else {
            setMessage(data.error || 'An unexpected error occurred.');
          }
        } else {
          setMessage('An unexpected error occurred.');
        }
        return;
      }

      if (data.success) {
        setMessage('Signup successful! Please check your email to verify your account.');
        router.push('/auth/login');
      } else {
        setMessage(data.error || 'An unexpected error occurred.');
      }
    } catch (error: any) {
      setMessage(error.message || 'Network error or unexpected issue.');
    }
    setLoading(false);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Review your details</h2>
      <div className="space-y-2">
        <div>
          <span className="font-medium">Email:</span> <span>{values.email}</span>
        </div>
        <div>
          <span className="font-medium">Full Name:</span> <span>{values.fullName}</span>
        </div>
        <div>
          <span className="font-medium">Mobile Number:</span> <span>{values.mobileNo}</span>
        </div>
      </div>
      <div className="flex justify-between mt-6">
        <Button onClick={prevStep} variant="secondary">Previous</Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Loading...' : 'Submit'}
        </Button>
      </div>
      {message && <p className="text-green-500 text-sm mt-4">{message}</p>}
    </div>
  );
}
