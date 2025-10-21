import React from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function Step2({ nextStep, prevStep, handleChange, values }: { nextStep: () => void, prevStep: () => void, handleChange: (input: string) => (e: React.ChangeEvent<HTMLInputElement>) => void, values: any }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Tell us about yourself</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">Full Name</label>
          <Input
            type="text"
            id="fullName"
            onChange={handleChange('fullName')}
            value={values.fullName}
          />
        </div>
        <div>
          <label htmlFor="mobileNo" className="block text-sm font-medium text-gray-700">Mobile Number</label>
          <Input
            type="tel"
            id="mobileNo"
            onChange={handleChange('mobileNo')}
            value={values.mobileNo}
          />
        </div>
      </div>
      <div className="flex justify-between mt-6">
        <Button onClick={prevStep} variant="secondary">Previous</Button>
        <Button onClick={nextStep}>Next</Button>
      </div>
    </div>
  );
}
