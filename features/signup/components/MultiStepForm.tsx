'use client'

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Step1 from './steps/Step1';
import Step2 from './steps/Step2';
import Step3 from './steps/Step3';

export default function MultiStepForm() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    mobileNo: '',
  });

  const nextStep = () => setStep(prev => prev + 1);
  const prevStep = () => setStep(prev => prev - 1);

  const handleChange = (input: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [input]: e.target.value });
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <div className="flex items-center">
          <div className={`flex-1 text-center pb-2 border-b-2 transition-all duration-300 ${step >= 1 ? 'text-primary font-semibold border-primary' : 'text-gray-400 border-gray-300'}`}>
            Step 1
          </div>
          <div className={`flex-1 text-center pb-2 border-b-2 transition-all duration-300 ${step >= 2 ? 'text-primary font-semibold border-primary' : 'text-gray-400 border-gray-300'}`}>
            Step 2
          </div>
          <div className={`flex-1 text-center pb-2 border-b-2 transition-all duration-300 ${step >= 3 ? 'text-primary font-semibold border-primary' : 'text-gray-400 border-gray-300'}`}>
            Step 3
          </div>
        </div>
      </div>

      <motion.div
        whileHover={{ scale: 1.01, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" }}
        transition={{ duration: 0.2 }}
        className="p-8 bg-white rounded-lg border border-gray-300 shadow-md"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            {step === 1 && <Step1 nextStep={nextStep} handleChange={handleChange} values={formData} />}
            {step === 2 && <Step2 nextStep={nextStep} prevStep={prevStep} handleChange={handleChange} values={formData} />}
            {step === 3 && <Step3 prevStep={prevStep} values={formData} />}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}