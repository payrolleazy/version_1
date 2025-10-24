'use client'

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { onboardingFormSchema } from '@/lib/onboardingFormSchema';

interface Field {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  dependsOn?: string;
  dependsOnValue?: string;
}

interface OnboardingSectionFormProps {
  session: any;
  fields: Field[];
  title: string;
  labelWidth?: string;
}

export default function OnboardingSectionForm({ session, fields, title, labelWidth = 'w-48' }: OnboardingSectionFormProps) {
  const [baseRecord, setBaseRecord] = useState<{ [key: string]: any } | null>(null);
  const [sectionFormData, setSectionFormData] = useState<{ [key: string]: any }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchAndSetUserData = async () => {
      if (!session?.user?.id) return;

      const { data, error } = await supabase
        .from('emp_primary_master')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user data:', error);
        setMessage({ type: 'error', text: 'Could not load existing data.' });
        return;
      }

      setBaseRecord(data);

      const initialSectionData: { [key: string]: any } = {};
      fields.forEach(field => {
        initialSectionData[field.name] = data?.[field.name] ?? '';
      });
      setSectionFormData(initialSectionData);
    };

    fetchAndSetUserData();
  }, [session.user.id, fields]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSectionFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    try {
      const processedSectionData = { ...sectionFormData };
      fields.forEach(field => {
        if (!field.required && processedSectionData[field.name] === '') {
          processedSectionData[field.name] = null;
        }
      });

      const completePayload = { ...baseRecord, ...processedSectionData };

      const payload = {
        config_id: 'ebcda741-8118-4ec0-8180-d6cbc73153d0',
        input_rows: [
          {
            ...completePayload,
            user_id: session.user.id,
            tenant_id: 'd3b47e58-9e87-4731-9a19-be25f5a6373f',
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
      if (!response.ok) throw new Error(data.message || 'Failed to save data');

      setBaseRecord(completePayload);
      setMessage({ type: 'success', text: `${title} data saved successfully!` });

    } catch (error: any) {
      console.error(`Error saving ${title} data:`, error);
      setMessage({ type: 'error', text: error.message || 'An unexpected error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: Field) => {
    if (field.dependsOn && sectionFormData[field.dependsOn] !== field.dependsOnValue) return null;

    const labelSpan = (
      <span className={`inline-flex items-center px-4 py-2 rounded-l-lg border border-r-0 border-gray-300 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 text-sm whitespace-nowrap ${labelWidth} flex-shrink-0`}>
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </span>
    );

    const commonInputClassName = "flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-lg border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-white";

    let inputElement;
    switch (field.type) {
      case 'textarea':
        inputElement = <textarea rows={3} name={field.name} id={field.name} value={sectionFormData[field.name] || ''} onChange={handleChange} className={commonInputClassName} required={field.required} />;
        break;
      case 'select':
        inputElement = (
          <div className="relative flex-1">
            <select name={field.name} id={field.name} value={sectionFormData[field.name] || ''} onChange={handleChange} className={`${commonInputClassName} appearance-none pr-10`} required={field.required}>
              <option value="">Please select</option>
              {field.options?.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        );
        break;
      default:
        inputElement = <input type={field.type} name={field.name} id={field.name} value={sectionFormData[field.name] || ''} onChange={handleChange} className={commonInputClassName} required={field.required} />;
        break;
    }

    return (
      <div className="flex rounded-lg shadow-sm">
        {labelSpan}
        {inputElement}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {fields.map(field => (
        <div key={field.name}>
          {renderField(field)}
        </div>
      ))}
      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : `Save ${title}`}
        </Button>
      </div>
      {message && (
        <div className={`mt-4 p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
          {message.text}
        </div>
      )}
    </form>
  );
}
