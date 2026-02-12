'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import Button from '@/components/ui/Button';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { supabase } from '@/lib/supabase';
import Step3ExportFunctionality from './components/Step3ExportFunctionality'; // Import the new Step 3 component

// We will create a dedicated client component for the logic
function BulkAssignPayStructuresClient() {
  const { session } = useSessionContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleDownloadTemplate = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      if (!session) {
        throw new Error('You must be logged in to download the template.');
      }

      const { data, error } = await supabase.functions.invoke('excel-template-generator-json', {
        body: { config_id: 'employee-pay-structure-assignment-template' },
      });

      if (error) {
        throw error;
      }

      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
        setSuccessMessage('Template download link has been opened successfully!');
      } else {
        throw new Error('Download URL not provided by the function.');
      }
    } catch (err: any) {
      setError(`Failed to download template: ${err.message || 'An unknown error occurred.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (!e.target?.result) {
          throw new Error('Failed to read the file.');
        }
        if (!session?.access_token) {
          throw new Error('Authentication required to upload data.');
        }

        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[1]; // Assuming data is on the second sheet "Data"
        const worksheet = workbook.Sheets[sheetName];
        
        // Define the expected keys that the backend PG function requires.
        const expectedHeaders = ['emp_code', 'structure_code', 'area_code', 'effective_start_date', 'effective_end_date'];
        
        // Convert sheet to JSON, skipping the first row (the display headers)
        // and applying our own correct headers as keys.
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: expectedHeaders,
          range: 1, // Start reading from the second row
          raw: false, // Extract formatted text instead of raw values
        });

        if (jsonData.length === 0) {
          throw new Error('The uploaded file contains no data.');
        }

        // Clean the data before sending it to the backend
        const cleanedData = jsonData.map(row => {
          const newRow: any = { ...row };
          if (newRow.emp_code && typeof newRow.emp_code === 'string') {
            newRow.emp_code = newRow.emp_code.trim();
          }
          if (newRow.structure_code && typeof newRow.structure_code === 'string') {
            // Trim and convert to uppercase to match database lookup
            newRow.structure_code = newRow.structure_code.trim().toUpperCase();
          }
          if (newRow.area_code && typeof newRow.area_code === 'string') {
            // Trim and convert to uppercase to match database lookup
            newRow.area_code = newRow.area_code.trim().toUpperCase();
          }
          return newRow;
        });

        const response = await fetch('/api/bulk-assign-pay-structures', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            params: cleanedData,
            accessToken: session.access_token,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Failed to process the uploaded file.');
        }

        setSuccessMessage(result.message || 'File processed successfully!');

      } catch (err: any) {
        setError(`Upload failed: ${err.message || 'An unknown error occurred.'}`);
      } finally {
        setLoading(false);
        // Reset the file input so the user can upload the same file again if needed
        event.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="p-8 bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Bulk Assign Employee Pay Structures</h1>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {successMessage && <p className="text-green-500">{successMessage}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Download Section */}
        <div className="p-6 border border-gray-200 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Step 1: Download Template</h2>
          <p className="mb-4 text-gray-600">
            Download the Excel template to fill in the employee pay structure assignment details.
          </p>
          <Button onClick={handleDownloadTemplate} disabled={loading}>
            Download Template
          </Button>
        </div>

        {/* Upload Section */}
        <div className="p-6 border border-gray-200 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Step 2: Upload File</h2>
          <p className="mb-4 text-gray-600">
            Once you have filled out the template, upload the file here to process the assignments.
          </p>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            disabled={loading}
          />
        </div>
      </div>
      
      {/* New Step 3: Export Functionality */}
      <div className="mt-8">
        <Step3ExportFunctionality />
      </div>
    </div>
  );
}


// The default export for the page
export default function BulkAssignPayStructuresPage() {
  return <BulkAssignPayStructuresClient />;
}
