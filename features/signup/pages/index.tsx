'use client'

import MultiStepForm from '../components/MultiStepForm';
import Link from 'next/link';
import Button from '@/components/ui/Button';

export default function SignUpPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 w-full max-w-md"
    >
      <MultiStepForm />
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">Already have an account? <Link href="/auth/login"><Button variant="secondary" className="ml-2">Sign In</Button></Link></p>
      </div>
    </div>
  );
}
