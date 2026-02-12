'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/Modal';
import Tabs from '@/components/Tabs';
import Loader from '@/components/ui/Loader';
import Input from '@/components/ui/Input'; // Assuming Input component exists

// Config IDs
const READ_PAYROLL_INPUTS_CONFIG_ID = '19e3bd8f-cd5c-4ad9-ab00-987d255c1025';
const BULK_UPSERT_INPUTS_CONFIG_ID = 'f8a2dfe4-e88c-4f0a-8745-6f4d8860dbbd'; // For editing/deleting
const UPLOAD_VARIABLE_INPUTS_CONFIG_ID = 'bulk-upload-variable-inputs'; // For Excel upload

// Interfaces
interface PayrollInput {
  id?: number; // Optional for new records
  tenant_id?: string;
  user_id: string;
  employee_name: string;
  emp_code: string;
  component_code: string;
  payroll_period: string;
  numeric_value: number;
  data_source: string;
  processing_status: string;
  is_new?: boolean; // Client-side flag for new rows
  is_deleted?: boolean; // Client-side flag for deletion
}

interface PayrollPeriod {
  value: string; // YYYY-MM-DD format
  label: string; // "Month YYYY"
}

export default function VariableInputsPage() {
  const { session } = useSessionContext();
  const [activeTab, setActiveTab] = useState('Manage Inputs');
  
  const [availablePeriods, setAvailablePeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(''); // YYYY-MM-DD for current period

  const [variableInputs, setVariableInputs] = useState<PayrollInput[]>([]);
  const [originalInputs, setOriginalInputs] = useState<PayrollInput[]>([]); // To track changes
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Upload Tab State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPeriod, setUploadPeriod] = useState<string>('');
  const [uploadComponentCode, setUploadComponentCode] = useState<string>('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);

  const fetchPayrollPeriods = useCallback(async () => {
    if (!session) return;
    try {
        const { data, error: rpcError } = await supabase.rpc('z_crud_universal_read', {
            config_id: 'tps-read-batches', // Assuming a config for reading TPS batches exists
            p_params: {
                filters: { status: 'FINALIZED' }, // Only show finalized periods
                orderBy: [['payroll_period', 'DESC']]
            }
        });
        if (rpcError) throw rpcError;
        if (!data.success) throw new Error(data.message);

        const periods = data.data.map((batch: any) => ({
            value: batch.payroll_period,
            label: new Date(batch.payroll_period).toLocaleString('default', { month: 'long', year: 'numeric' })
        }));
        setAvailablePeriods(periods);
        if (periods.length > 0) {
            setSelectedPeriod(periods[0].value);
            setUploadPeriod(periods[0].value);
        }
    } catch (err: any) {
        setError(`Failed to fetch payroll periods: ${err.message}`);
    }
  }, [session]);

  const fetchVariableInputs = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!session || !selectedPeriod) {
        setLoading(false);
        return;
    }

    try {
      const response = await fetch('/api/wcm-read-arrears', { // Reusing wcm-read-arrears API route for universal read
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          config_id: READ_PAYROLL_INPUTS_CONFIG_ID,
          params: {
            filters: { payroll_period: selectedPeriod },
            orderBy: [['employee_name', 'ASC'], ['component_code', 'ASC']]
          }
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch variable inputs.');
      
      const inputs: PayrollInput[] = data.data || [];
      setVariableInputs(inputs);
      setOriginalInputs(inputs); // Store original for comparison
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, selectedPeriod]);

  useEffect(() => {
    fetchPayrollPeriods();
  }, [fetchPayrollPeriods]);

  useEffect(() => {
    if (selectedPeriod) {
        fetchVariableInputs();
    }
  }, [selectedPeriod, fetchVariableInputs]);

  // Handle cell changes in the editable grid
  const handleCellChange = (index: number, field: keyof PayrollInput, value: any) => {
    const updatedInputs = [...variableInputs];
    updatedInputs[index] = { ...updatedInputs[index], [field]: value };
    setVariableInputs(updatedInputs);
  };

  // Add a new empty row
  const handleAddRow = () => {
    if (!selectedPeriod) {
        setError('Please select a payroll period first.');
        return;
    }
    setVariableInputs([
      ...variableInputs,
      {
        user_id: '', // Will be filled by user input or lookup
        employee_name: '',
        emp_code: '',
        component_code: '',
        payroll_period: selectedPeriod,
        numeric_value: 0,
        data_source: 'Manual',
        processing_status: 'PENDING',
        is_new: true,
      },
    ]);
  };

  // Mark a row for deletion (soft delete on frontend)
  const handleDeleteRow = (index: number) => {
    const updatedInputs = [...variableInputs];
    updatedInputs[index] = { ...updatedInputs[index], is_deleted: true, numeric_value: 0 }; // Set value to 0 for upsert
    setVariableInputs(updatedInputs);
  };

  // Save all changes (Add/Edit/Delete)
  const handleSaveChanges = async () => {
    setActionLoading(true);
    setError(null);
    if (!session || !selectedPeriod) return;

    // Filter out unchanged rows and prepare data for upsert
    const changedInputs = variableInputs.filter(input => {
        const original = originalInputs.find(orig => orig.id === input.id);
        // Compare only relevant fields for changes or if it's new/deleted
        return input.is_new || input.is_deleted || (original && (
            original.component_code !== input.component_code ||
            original.numeric_value !== input.numeric_value ||
            original.user_id !== input.user_id // Assuming user_id can be changed (e.g. via emp_code lookup)
        ));
    });

    if (changedInputs.length === 0) {
        setError('No changes to save.');
        setActionLoading(false);
        return;
    }

    try {
        const payload = changedInputs.map(input => ({
            id: input.id, // Include ID for updates
            tenant_id: session.user.app_metadata.tenant_id, // Assuming tenant_id from session
            user_id: input.user_id, // Ensure user_id is valid UUID
            component_code: input.component_code,
            payroll_period: input.payroll_period,
            numeric_value: input.numeric_value,
            data_source: input.data_source,
            processing_status: input.processing_status,
        }));

        const response = await fetch('/api/universal-bulk-upsert', { // Assuming this generic API route exists
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
                config_id: BULK_UPSERT_INPUTS_CONFIG_ID,
                payload: payload,
            }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to save changes.');

        await fetchVariableInputs(); // Refresh grid after save

    } catch (err: any) {
        setError(err.message);
    } finally {
        setActionLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadLoading(true);
    setUploadResult(null);
    setError(null);
    if (!session || !uploadFile || !uploadPeriod || !uploadComponentCode) {
        setError('All upload fields are required.');
        setUploadLoading(false);
        return;
    }

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('payroll_period', uploadPeriod);
    formData.append('component_code', uploadComponentCode);
    formData.append('tenant_id', session.user.app_metadata.tenant_id); // Assuming tenant_id in session
    formData.append('config_id', UPLOAD_VARIABLE_INPUTS_CONFIG_ID);

    try {
        const response = await fetch('/api/universal-excel-upload', { // Assuming this generic API route exists
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: formData,
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Upload failed.');

        setUploadResult({ success: true, message: 'File uploaded successfully!', data: data });
        setUploadFile(null); // Clear file input
        await fetchVariableInputs(); // Refresh inputs after upload

    } catch (err: any) {
        setUploadResult({ success: false, message: err.message || 'An unexpected error occurred during upload.' });
    } finally {
        setUploadLoading(false);
    }
  };

  return (
    <div className="p-8 bg-white rounded-lg shadow-md min-h-screen">
        <h1 className="text-3xl font-bold mb-4">Variable Inputs Management</h1>
        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}
        
        <div className="mb-6 flex items-center space-x-4">
            <label htmlFor="payrollPeriod" className="text-lg font-medium">Payroll Period:</label>
            <select
                id="payrollPeriod"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500"
                disabled={loading || actionLoading}
            >
                {availablePeriods.length === 0 && <option value="">No periods available</option>}
                {availablePeriods.map(period => (
                    <option key={period.value} value={period.value}>{period.label}</option>
                ))}
            </select>
        </div>

        <Tabs>
            <Tabs.Tab label="Manage Inputs" isActive={activeTab === 'Manage Inputs'} onClick={() => setActiveTab('Manage Inputs')}>
                {loading ? <Loader /> : (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">Variable Inputs for {new Date(selectedPeriod).toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                            <div>
                                <Button onClick={handleAddRow} disabled={actionLoading}>Add Row</Button>
                                <Button onClick={handleSaveChanges} disabled={actionLoading || variableInputs.length === 0} className="ml-2">Save Changes</Button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full bg-white border border-gray-200">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="py-2 px-4 border-b text-left">Employee</th>
                                        <th className="py-2 px-4 border-b text-left">Component Code</th>
                                        <th className="py-2 px-4 border-b text-right">Amount</th>
                                        <th className="py-2 px-4 border-b text-left">Data Source</th>
                                        <th className="py-2 px-4 border-b text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {variableInputs.length > 0 ? variableInputs.filter(input => !input.is_deleted).map((input, index) => (
                                        <tr key={input.id || `new-${index}`} className="hover:bg-gray-50">
                                            <td className="py-2 px-4 border-b">
                                                <div className="font-medium">{input.employee_name}</div>
                                                <div className="text-xs text-gray-500">{input.emp_code}</div>
                                            </td>
                                            <td className="py-2 px-4 border-b">
                                                <Input
                                                    type="text"
                                                    value={input.component_code}
                                                    onChange={(e) => handleCellChange(index, 'component_code', e.target.value)}
                                                    className="w-full"
                                                />
                                            </td>
                                            <td className="py-2 px-4 border-b">
                                                <Input
                                                    type="number"
                                                    value={input.numeric_value}
                                                    onChange={(e) => handleCellChange(index, 'numeric_value', parseFloat(e.target.value))}
                                                    className="w-full text-right"
                                                />
                                            </td>
                                            <td className="py-2 px-4 border-b">{input.data_source}</td>
                                            <td className="py-2 px-4 border-b text-center">
                                                <Button variant="destructive" size="sm" onClick={() => handleDeleteRow(index)}>Delete</Button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="text-center py-8 text-gray-500">No variable inputs for this period. Add new rows or upload.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </Tabs.Tab>
            <Tabs.Tab label="Upload Inputs" isActive={activeTab === 'Upload Inputs'} onClick={() => setActiveTab('Upload Inputs')}>
                <div className="p-4 space-y-4">
                    <h2 className="text-xl font-semibold mb-4">Upload Variable Inputs via Excel</h2>
                    <form onSubmit={handleFileUpload} className="space-y-4">
                        <div>
                            <label htmlFor="uploadPeriod" className="block text-sm font-medium text-gray-700">Payroll Period</label>
                            <select
                                id="uploadPeriod"
                                value={uploadPeriod}
                                onChange={(e) => setUploadPeriod(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                                disabled={uploadLoading}
                            >
                                {availablePeriods.length === 0 && <option value="">No periods available</option>}
                                {availablePeriods.map(period => (
                                    <option key={period.value} value={period.value}>{period.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="uploadComponentCode" className="block text-sm font-medium text-gray-700">Component Code (e.g., PERFORMANCE_BONUS)</label>
                            <Input
                                type="text"
                                id="uploadComponentCode"
                                value={uploadComponentCode}
                                onChange={(e) => setUploadComponentCode(e.target.value)}
                                className="mt-1 block w-full"
                                required
                                disabled={uploadLoading}
                            />
                        </div>
                        <div>
                            <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700">Upload Excel File</label>
                            <Input
                                type="file"
                                id="file-upload"
                                accept=".xlsx, .xls"
                                onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                                className="mt-1 block w-full"
                                required
                                disabled={uploadLoading}
                            />
                        </div>
                        <Button type="submit" disabled={uploadLoading}>
                            {uploadLoading ? 'Uploading...' : 'Upload File'}
                        </Button>
                    </form>
                    {uploadResult && (
                        <div className={`mt-4 p-3 rounded ${uploadResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {uploadResult.message}
                            {uploadResult.data && uploadResult.data.summary && (
                                <p className="text-sm mt-2">Processed: {uploadResult.data.summary.processed}, Success: {uploadResult.data.summary.success}, Failed: {uploadResult.data.summary.failed}</p>
                            )}
                        </div>
                    )}
                </div>
            </Tabs.Tab>
        </Tabs>
    </div>
  );
}
