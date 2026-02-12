'use client';

import { useSessionContext } from '@supabase/auth-helpers-react';
import { useCallback, useState } from 'react';
import Button from './ui/Button'; 

interface BulkUploadProps {
  onUploadSuccess: () => void;
  config_id: string;
}

export default function BulkUpload({ onUploadSuccess, config_id }: BulkUploadProps) {
  const { session, isLoading: sessionLoading } = useSessionContext();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setSuccess(null);
    }
  };

  const clearFile = () => {
    setFile(null);
    setError(null);
    setSuccess(null);
  };

  const handleUpload = useCallback(async () => {
    // 1. Session Loading Check: Prevent immediate clicks before auth is ready
    if (sessionLoading) {
        setError('Please wait, initializing session...');
        return;
    }
    
    if (!file || !session?.access_token) {
      setError('Please select a file and ensure you are logged in.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('config_id', config_id);
    // 2. Append Token: Critical for the Next.js API Route to forward the request
    formData.append('accessToken', session.access_token);

    try {
      const response = await fetch('/api/universal-excel-upload', {
        method: 'POST',
        body: formData, // fetch automatically sets the correct Content-Type boundary
      });

      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(result.error || result.message || 'File upload failed.');
      }

      setSuccess(result.message || 'File uploaded successfully!');
      setFile(null); // Reset file input
      onUploadSuccess(); // Trigger data refresh in parent
    } catch (err: any) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }, [file, session, config_id, onUploadSuccess, sessionLoading]);

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-100">
      <h2 className="text-xl font-bold text-gray-800 mb-2">Bulk Upload Registrations</h2>
      <p className="text-sm text-gray-500 mb-6">
        Select an Excel file (.xlsx, .xls) to upload. The data will be processed and added to the registration list.
      </p>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded mb-4 text-sm" role="alert">
            <p className="font-bold">Error</p>
            <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded mb-4 text-sm" role="alert">
            <p className="font-bold">Success</p>
            <p>{success}</p>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-start space-y-4 md:space-y-0 md:space-x-4">
        
        {/* Modern File Selector Area */}
        <div className="w-full md:w-2/3">
            {!file ? (
                <label 
                    htmlFor="file-upload" 
                    className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 
                    ${sessionLoading ? 'bg-gray-100 border-gray-300 cursor-wait' : 'bg-gray-50 border-blue-300 hover:bg-blue-50 hover:border-blue-400'}`}
                >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg className={`w-8 h-8 mb-3 ${sessionLoading ? 'text-gray-400' : 'text-blue-500'}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                        </svg>
                        <p className="mb-1 text-sm text-gray-500">
                            {sessionLoading ? 'Initializing...' : <><span className="font-semibold text-blue-600">Click to upload</span> or drag and drop</>}
                        </p>
                        <p className="text-xs text-gray-400">XLSX or XLS (MAX. 10MB)</p>
                    </div>
                    <input 
                        id="file-upload" 
                        type="file" 
                        className="hidden" 
                        onChange={handleFileChange} 
                        accept=".xlsx, .xls"
                        disabled={sessionLoading}
                    />
                </label>
            ) : (
                <div className="flex items-center justify-between w-full h-16 px-4 border border-blue-200 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-3 overflow-hidden">
                        <svg className="w-6 h-6 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                        <span className="text-sm font-medium text-gray-700 truncate">{file.name}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button 
                        onClick={clearFile}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50"
                        title="Remove file"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
            )}
        </div>

        {/* Upload Button Area */}
        <div className="w-full md:w-1/3 flex items-center h-32">
             <Button 
                onClick={handleUpload} 
                disabled={!file || uploading || sessionLoading} 
                isLoading={uploading}
                className="w-full h-12 text-lg shadow-sm"
                variant="primary" 
            >
                {uploading ? 'Uploading...' : 'Upload File'}
            </Button>
        </div>
      </div>
    </div>
  );
}