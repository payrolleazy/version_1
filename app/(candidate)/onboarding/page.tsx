'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { onboardingFormSchema } from '@/lib/onboardingFormSchema';
import OnboardingSectionForm from '@/components/OnboardingSectionForm';
import OnboardingDocumentUpload from '@/components/OnboardingDocumentUpload';
import Button from '@/components/ui/Button';

export default function OnboardingPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [documentTypes, setDocumentTypes] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    const checkSessionAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session) {
        try {
          const response = await fetch('/api/get-document-types', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ config_id: 'a7f22a6d-88fb-484a-9d50-8b89639b4e4b', accessToken: session.access_token }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message);
          const documentNames = Array.isArray(result.data) ? result.data.map((doc: any) => doc.documents) : [];
          setDocumentTypes(documentNames);
        } catch (error) {
          console.error('Error fetching document checklist:', error);
        }
      }
      setLoading(false);
    };
    checkSessionAndFetchData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && !session) {
      router.push('/auth/login');
    }
  }, [loading, session, router]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <h1 className="text-4xl font-bold text-foreground mb-8 text-center">Employee Onboarding</h1>
      <div className="space-y-8">
        {onboardingFormSchema.map((section) => (
          <div key={section.id}>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{section.title}</h2>
            {section.id === 'documents' ? (
              <>
                <Button onClick={() => setIsModalOpen(true)}>Document Uploads</Button>
                <OnboardingDocumentUpload session={session} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} documentTypes={documentTypes} />
              </>
            ) : (
              <OnboardingSectionForm session={session} fields={section.fields} title={section.title} />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}