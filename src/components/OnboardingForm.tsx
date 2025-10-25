'use client'

import { useState } from 'react';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import type { Session } from '@supabase/supabase-js';

interface OnboardingFormProps {
  session: Session;
}

export default function OnboardingForm({ session }: OnboardingFormProps) {
  const [formData, setFormData] = useState({
    first_name_epm: '',
    last_name_epm: '',
    personal_mail_id_epm: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!formData.first_name_epm || !formData.last_name_epm || !formData.personal_mail_id_epm) {
      setMessage({ type: 'error', text: 'All fields are required.' });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        config_id: 'ebcda741-8118-4ec0-8180-d6cbc73153d0',
        input_rows: [
          {
            ...formData,
          },
        ],
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/a_crud_universal_bulk_upsert`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit data');
      }

      setMessage({ type: 'success', text: 'Basic info submitted successfully!' });
      setFormData({ first_name_epm: '', last_name_epm: '', personal_mail_id_epm: '' });
    } catch (error) {
      console.error('Submission error:', error);
      setMessage({ type: 'error', text: error.message || 'An unexpected error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      className="max-w-xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="first_name_epm" className="block text-sm font-medium text-gray-700 dark:text-gray-300">First Name</label>
          <input
            type="text"
            name="first_name_epm"
            id="first_name_epm"
            value={formData.first_name_epm}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors"
            required
          />
        </div>
        <div>
          <label htmlFor="last_name_epm" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</label>
          <input
            type="text"
            name="last_name_epm"
            id="last_name_epm"
            value={formData.last_name_epm}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors"
            required
          />
        </div>
        <div>
          <label htmlFor="personal_mail_id_epm" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Personal Email</label>
          <input
            type="email"
            name="personal_mail_id_epm"
            id="personal_mail_id_epm"
            value={formData.personal_mail_id_epm}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-colors"
            required
          />
        </div>

        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'}`}
          >
            {message.text}
          </motion.div>
        )}

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Basic Info'}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
