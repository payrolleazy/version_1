'use client';

import React, { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useSessionContext } from '@supabase/auth-helpers-react';
import * as XLSX from 'xlsx';

interface ImportUserRolesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export default function ImportUserRolesModal({ isOpen, onClose, onImportSuccess }: ImportUserRolesModalProps) {
  const { session } = useSessionContext();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

// Helper function to transform human-readable Excel headers into programmatic field names
const transformHeader = (header: string | number | boolean) => {
  if (typeof header !== 'string' || !header) {
    return '';
  }
  return header
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
};

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setSuccessMessage(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select an Excel file to upload.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (!session?.access_token) {
        throw new Error('Authentication required to upload data.');
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });

          // Prioritize 'Data' sheet, otherwise use the first sheet
          const sheetName = workbook.SheetNames.includes('Data') ? 'Data' : workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // Read data as an array of arrays, with the first row as headers
          const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (jsonData.length < 2) {
            throw new Error('No data found in the selected sheet. Ensure there are headers and at least one row of data.');
          }

          // Extract and transform headers
          const rawHeaders: (string | number | boolean)[] = jsonData[0];
          console.log('Raw Headers:', rawHeaders);
          const programmaticHeaders = rawHeaders.map(h => transformHeader(h));
          console.log('Programmatic Headers:', programmaticHeaders);

          // Map data rows to objects using the programmatic headers
          // Ensure that the keys match the expected backend payload
          const userRolesData = jsonData.slice(1).map((row: any[]) => {
            const rowData: Record<string, any> = {};
            programmaticHeaders.forEach((header, index) => {
              if (header) { // Only add if header is not empty after transformation
                rowData[header] = row[index] !== undefined && row[index] !== null ? String(row[index]).trim() : null;
              }
            });

            // Explicitly map transformed keys to expected backend keys
            return {
              name: rowData.name || '',
              email_users_roles: rowData.email_users_roles || '', // Assuming transformed 'EMAIL USERS ROLES *' becomes 'email_users_roles'
              mobile: rowData.mobile || '',
              role: 'candidate', // Default value as per original code
              enable_disable: '1', // Default value as per original code
              position_id: rowData.position_id || null,
              date_of_joining: rowData.date_of_joining ? new Date(rowData.date_of_joining).toISOString().split('T')[0] : null,
              existing_emp_code: rowData.existing_employee_code || null, // Assuming transformed 'Existing Employee Code'
            };
          });

          const validUserRolesData = userRolesData.filter(row => row.name && row.email_users_roles && row.mobile);

          if (validUserRolesData.length === 0) {
            throw new Error('No valid data found in the Excel file after parsing. Ensure Name, Email, and Mobile columns are present.');
          }

          const response = await fetch('/api/a_crud_universal_pg_function_gateway', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              config_id: 'ums_insert_employee_invites',
              params: { user_roles_data: validUserRolesData },
              accessToken: session.access_token,
            }),
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to import data');
          }

          setSuccessMessage(result.message || 'Data imported successfully!');
          onImportSuccess();
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      if (!session?.access_token) {
        throw new Error('Authentication required to download template.');
      }

      const response = await fetch('/api/a_crud_universal_pg_function_gateway', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config_id: 'user-roles-template-download',
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to download template');
      }

      // Assuming the backend returns a signed URL for the Excel file
      const downloadUrl = result.downloadUrl;
      if (downloadUrl) {
        window.open(downloadUrl, '_blank');
        setSuccessMessage('Template download initiated.');
      } else {
        throw new Error('Download URL not provided by backend.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6">Import User Roles (Candidates)</h2>
        
        {error && <p className="text-red-500 text-sm mb-4">Error: {error}</p>}
        {successMessage && <p className="text-green-500 text-sm mb-4">Success: {successMessage}</p>}

        <div className="space-y-4">
          <Button onClick={handleDownloadTemplate} disabled={loading}>
            {loading ? 'Preparing Template...' : 'Download Template'}
          </Button>
          
          <div className="text-gray-500 text-sm">
            File upload functionality is now available.
          </div>

          <Input type="file" onChange={handleFileChange} accept=".xlsx, .xls" />

          <div className="flex justify-end space-x-4 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="button" onClick={handleUpload} disabled={loading || !file}>
              {loading ? 'Importing...' : 'Import Data'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}