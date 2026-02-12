import React from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function Step1({ nextStep, handleChange, values }: { nextStep: () => void, handleChange: (input: string) => (e: React.ChangeEvent<HTMLInputElement>) => void, values: any }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Create your account</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
          <Input
            type="email"
            id="email"
            onChange={handleChange('email')}
            value={values.email}
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
          <Input
            type="password"
            id="password"
            onChange={handleChange('password')}
            value={values.password}
          />
        </div>
      </div>
      <div className="flex justify-end mt-6">
        <Button onClick={nextStep}>Next</Button>
      </div>
    </div>
  );
}
