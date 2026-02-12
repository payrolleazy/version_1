'use client'

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Loader from '@/components/ui/Loader'; // Assuming you have a Loader component

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: any;
  documentType: string | null; // Can be null for initial selection
  availableDocumentTypes?: string[]; // New prop for selection
}

interface UploadedFile {
  originalName: string;
  dataUrl: string;
  mimeType: string; // Add mimeType to the interface
}

export default function DocumentViewerModal({ isOpen, onClose, session, documentType: propDocumentType, availableDocumentTypes }: DocumentViewerModalProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<string | null>(propDocumentType);

  // Update selectedDocumentType when propDocumentType changes
  useEffect(() => {
    setSelectedDocumentType(propDocumentType);
  }, [propDocumentType]);

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalVariants = {
    hidden: { y: "-100vh", opacity: 0 },
    visible: { y: "0", opacity: 1, transition: { type: "spring", stiffness: 100, damping: 20 } },
    exit: { y: "100vh", opacity: 0 }
  };

  useEffect(() => {
    const fetchAndDecryptFiles = async () => {
      if (!isOpen || !selectedDocumentType || !session?.access_token) {
        setUploadedFiles([]);
        return;
      }

      setIsLoadingFiles(true);
      setFileError(null);

      try {
        const response = await fetch(`/api/secure-file-handler/list-decrypted-files?documentType=${selectedDocumentType}&accessToken=${session.access_token}`, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to list and decrypt files');
        }
        
        if (data.successful && Array.isArray(data.successful)) {
          const filesWithMimeType = data.successful.map((file: any) => ({
            ...file,
            mimeType: file.dataUrl.substring(file.dataUrl.indexOf(':') + 1, file.dataUrl.indexOf(';')),
          }));
          setUploadedFiles(filesWithMimeType);
        } else {
          setUploadedFiles([]);
        }

      } catch (err: any) {
        console.error('Error fetching and decrypting files:', err);
        setFileError(err.message || 'An unknown error occurred while fetching files.');
      } finally {
        setIsLoadingFiles(false);
      }
    };

    fetchAndDecryptFiles();
  }, [isOpen, selectedDocumentType, session]);

  const handleDocumentTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDocumentType(e.target.value);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }} // Darker backdrop
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={onClose}
        >
          <motion.div
            className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
            variants={modalVariants}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
          >
            <header className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 capitalize">
                {selectedDocumentType ? `${selectedDocumentType.replace(/_/g, ' ')} Documents` : 'View Uploaded Documents'}
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
                aria-label="Close modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </header>
            <main className="p-8 flex-1 overflow-y-auto">
              {!selectedDocumentType && availableDocumentTypes && availableDocumentTypes.length > 0 && (
                <div className="mb-6">
                  <label htmlFor="docTypeSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Document Type:</label>
                  <select
                    id="docTypeSelect"
                    value={selectedDocumentType || ''}
                    onChange={handleDocumentTypeChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2"
                  >
                    <option value="">-- Select a type --</option>
                    {availableDocumentTypes.map(type => (
                      <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              )}

              {isLoadingFiles ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <Loader />
                  <p className="mt-4 text-gray-600 dark:text-gray-300">Loading documents...</p>
                </div>
              ) : fileError ? (
                <div className="text-red-500 dark:text-red-400 text-center">{fileError}</div>
              ) : uploadedFiles.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400 text-center">No documents found for this type.</div>
              ) : (
                <div className="space-y-6">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
                      <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">{file.originalName}</p>
                      {file.mimeType.startsWith('image/') ? (
                        <img src={file.dataUrl} alt={file.originalName} className="max-w-full h-auto rounded-md" />
                      ) : file.mimeType === 'application/pdf' ? (
                        <iframe src={file.dataUrl} className="w-full h-96 border-none rounded-md"></iframe>
                      ) : (
                        <a href={file.dataUrl} download={file.originalName} className="text-blue-500 hover:underline">Download {file.originalName}</a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </main>
            <footer className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              {selectedDocumentType && ( // Only show reset if a document type is selected
                <Button onClick={() => setSelectedDocumentType(null)} variant="secondary">
                  Select Another Document
                </Button>
              )}
              <Button onClick={onClose}>Close</Button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
