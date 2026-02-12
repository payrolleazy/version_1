import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '@/components/Modal';
import OnboardingDocumentUpload from '@/components/OnboardingDocumentUpload';
import OnboardingStatusDashboard from './OnboardingStatusDashboard';
import OnboardingSectionForm from '@/components/OnboardingSectionForm';
import { onboardingFormSchema } from '@/lib/onboardingFormSchema'; // Import onboardingFormSchema

export default function Dashboard({ session }: { session: any }) {
  const [activeModal, setActiveModal] = React.useState<string | null>(null);
  const [documentTypes, setDocumentTypes] = React.useState<string[]>([]);

  useEffect(() => {
    const fetchDocumentTypes = async () => {
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
    };

    if (session) {
      fetchDocumentTypes();
    }
  }, [session]);

  const currentSection = onboardingFormSchema.find(section => section.id === activeModal);

  // Define which sections need wider layouts
  const wideLayoutSections = ['employment', 'contact', 'education'];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex">
      {/* Side Menu */}
      <motion.aside
        className="w-1/5 bg-white dark:bg-gray-800 shadow-lg p-4 overflow-y-auto"
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        <h2 className="text-2xl font-bold text-foreground mb-6 px-2">Onboarding Steps</h2>
        <nav className="space-y-2">
          {onboardingFormSchema.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveModal(section.id)}
              className="w-full text-left text-base font-medium p-3 rounded-md transition-all duration-300 ease-in-out text-gray-700 dark:text-gray-300 hover:text-black hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]"
            >
              {section.title}
            </button>
          ))}
        </nav>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 h-screen overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="relative p-8 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 shadow-2xl rounded-3xl space-y-8 overflow-hidden mb-6">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Welcome, {session.user.email}!
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Please complete your onboarding by selecting a section from the side menu.
            </p>
          </div>
          
            {/* Onboarding Status Dashboard will be rendered here */}
            <OnboardingStatusDashboard documentTypes={documentTypes} session={session} />

        </motion.div>
      </main>

      {/* Modal for Forms (excluding documents) */}
      <Modal
        isOpen={!!activeModal && activeModal !== 'documents'}
        onClose={() => setActiveModal(null)}
        title={currentSection?.title || ''}
        maxWidth={wideLayoutSections.includes(activeModal || '') ? 'max-w-3xl' : 'max-w-xl'} // Use 3xl for wide modals
      >
        {currentSection && activeModal !== 'documents' && (
          <OnboardingSectionForm 
            session={session} 
            fields={currentSection.fields} 
            title={currentSection.title} 
            labelWidth={wideLayoutSections.includes(currentSection.id) ? 'w-72' : 'w-48'} // Use wider labels for specific sections
          />
        )}
      </Modal>

      {/* OnboardingDocumentUpload Modal */}
      <OnboardingDocumentUpload 
        session={session} 
        isOpen={activeModal === 'documents'} 
        onClose={() => setActiveModal(null)} 
        documentTypes={documentTypes} 
      />
    </div>
  );
}