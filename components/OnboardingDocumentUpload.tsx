'use client'

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingDocumentUploadProps {
  session: any;
  isOpen: boolean;
  onClose: () => void;
  documentTypes: string[];
}

export default function OnboardingDocumentUpload({ session, isOpen, onClose, documentTypes }: OnboardingDocumentUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (files.length === 0 || !documentType) {
      setMessage({ type: 'error', text: 'Please select a document type and at least one file.' });
      return;
    }

    setIsUploading(true);
    setMessage(null);

    const filesData = await Promise.all(files.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            name: file.name,
            base64: event.target?.result,
            mimeType: file.type,
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }));

    try {
      const response = await fetch('/api/secure-file-handler/encrypt-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentType, files: filesData, accessToken: session.access_token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setMessage({ type: 'success', text: 'Files uploaded successfully!' });
      setFiles([]);
      handleListFiles();

    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleListFiles = async () => {
    if (!documentType) return;
    try {
        const response = await fetch(`/api/secure-file-handler/list-decrypted-files?documentType=${documentType}&accessToken=${session.access_token}`, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to list files');
        }
        setUploadedFiles(data.successful);
    } catch (error: any) {
        setMessage({ type: 'error', text: error.message });
    }
  };

  useEffect(() => {
    if(isOpen && documentType && session?.access_token) {
        handleListFiles();
    }
  }, [isOpen, documentType, session]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
        >
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 50, opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg"
          >
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Document Uploads</h3>
            <div className="space-y-6">
              <div>
                <label htmlFor="documentType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Document Type</label>
                <select
                  id="documentType"
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 hover:bg-gradient-to-r from-[#f0d9ff] to-[#c9d9ff]"
                  size={5}
                >
                  <option value="">Select a document type</option>
                  {documentTypes.map((docType: string) => (
                    <option key={docType} value={docType}>{docType}</option>
                  ))}
                  </select>
              </div>

              <div>
                <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload Files</label>
                <motion.label
                  htmlFor="file-upload"
                  className="cursor-pointer inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-500 dark:hover:bg-gray-600"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Choose File(s)
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="sr-only" // Visually hide the input
                  />
                </motion.label>
                {files.length > 0 && (
                  <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                    {files.map(file => file.name).join(', ')}
                  </span>
                )}
              </div>

              {message && (
                <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {message.text}
                </div>
              )}



              <div className="flex justify-end mt-4 space-x-4">
                <Button
                  onClick={handleUpload}
                  disabled={isUploading}
                  variant="primary"
                >
                  {isUploading ? 'Uploading...' : 'Upload'}
                </Button>
                <Button onClick={onClose} variant="secondary">
                  Close
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}