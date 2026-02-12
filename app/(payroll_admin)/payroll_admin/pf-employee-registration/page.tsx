'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Loader from '@/components/ui/Loader';
import Input from '@/components/ui/Input';
import Tabs from '@/components/Tabs';
import Modal from '@/components/Modal';
import { useExport } from '@/lib/useExport';

// ============================================================================ 
// 1. TYPES & INTERFACES
// ============================================================================ 
interface EmployeeRegistration {
    id: number;
    user_id: string;
    // Basic Info
    emp_code: string;
    full_name: string; // Changed from employee_name based on your API response
    uan_number: string | null;
    member_id: string | null;
    previous_member_id: string | null;
    status: 'ACTIVE' | 'PENDING_UAN' | 'UAN_LINKED' | 'EXITED';
    
    // Bank
    bank_account_number: string | null;
    bank_ifsc_code: string | null;
    bank_name: string | null;
    establishment_id: number | null;

    // Dates
    registration_date: string;
    exit_date: string | null;

    // Exemption & Voluntary
    is_exempted: boolean;
    exemption_type: string | null;
    exemption_reason: string | null;
    exemption_from_date: string | null;
    exemption_to_date: string | null;
    is_voluntary: boolean;
    opt_in_date: string | null;
    opt_out_date: string | null;
    opt_out_reason: string | null;

    // Wage Override
    override_wage_ceiling: boolean;
    custom_wage_ceiling: number | null;
    employer_matches_excess: boolean;
    override_effective_from: string | null;
    override_effective_to: string | null;
    override_reason: string | null;
}

// ============================================================================ 
// 2. CONFIGURATION CONSTANTS
// ============================================================================ 
const CONFIGS = {
  READ_REGISTRATIONS: '08763e09-abf3-4812-a28e-88112634a887', 
  BULK_UPSERT_REGISTRATIONS: '96e5d4bd-0cce-40dd-813d-52f40a0a4538', 
  DOWNLOAD_TEMPLATE: 'wcm-emp-pf-registration-bulk-download', 
  UPLOAD_REGISTRATIONS: 'wcm-emp-pf-registration-bulk-upload', 
};

const EXEMPTION_TYPES = [
    "INTERNATIONAL_WORKER", 
    "CONTRACTUAL", 
    "PROBATION", 
    "SALARY_ABOVE_THRESHOLD", 
    "OTHER", 
    "NOT APPLICABLE"
];

// ============================================================================ 
// 3. HELPER COMPONENTS & FUNCTIONS
// ============================================================================ 

// --- API Caller ---
async function callGateway(endpoint: string, payload: any, token: string) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...payload, accessToken: token }),
  });
  const result = await response.json();
  if (!response.ok || (result.hasOwnProperty('success') && !result.success)) {
    throw new Error(result.message || result.error || 'API Request Failed');
  }
  return result;
}

// --- Toggle Switch (Reusable) ---
const ToggleSwitch = ({ id, checked, onChange, label, disabled = false }: { id: string, checked: boolean, onChange: (val: boolean) => void, label?: string, disabled?: boolean }) => (
    <div className="flex items-center justify-between py-2">
        {label && <label htmlFor={id} className={`text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>{label}</label>}
        <button
            type="button"
            id={id}
            disabled={disabled}
            onClick={() => !disabled && onChange(!checked)}
            className={`${checked ? 'bg-gradient-to-r from-[#d0b9df] to-[#a9b9df]' : 'bg-gray-200'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none`}
        >
            <span aria-hidden="true" className={`${checked ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out`} />
        </button>
    </div>
);

// ============================================================================ 
// 4. MAIN PAGE COMPONENT
// ============================================================================ 
export default function EmployeeRegistrationManagerPage() {
  const { session, isLoading: sessionLoading } = useSessionContext();
  
  // Data State
  const [registrations, setRegistrations] = useState<EmployeeRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EmployeeRegistration | null>(null);
  const [modalTab, setModalTab] = useState<number>(1); // 1, 2, 3
  const [saveLoading, setSaveLoading] = useState(false);

  // Filters
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | EmployeeRegistration['status']>('ALL');

  // Bulk Upload State
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Fix: Use accessToken string for dependency array to prevent re-fetch on focus
  const accessToken = session?.access_token;
  
  // --- Template Downloader ---
  function TemplateDownloader({ config_id }: { config_id: string }) {
    const { initiateExport, status, progress, downloadUrl, error, loading, reset } = useExport(config_id);
    const { isLoading: sessionLoading } = useSessionContext();

    useEffect(() => {
      if (downloadUrl) {
        window.open(downloadUrl, '_blank');
        reset();
      }
    }, [downloadUrl, reset]);

    return (
      <div className="p-6 bg-white rounded-lg shadow-md mb-8 border border-gray-200">
          <h2 className="text-xl font-bold mb-2 text-gray-800">Download Excel Template</h2>
          <p className="text-sm text-gray-500 mb-6">Download the required template to add or update employee PF registrations in bulk.</p>
          
          {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-4 text-sm">{error}</div>}
          
          {status === 'IDLE' && (
              <Button onClick={initiateExport} disabled={loading || sessionLoading} isLoading={loading} variant="primary">
                  {sessionLoading ? 'Initializing...' : 'Download Template'}
              </Button>
          )}
          
          {(status === 'INITIATING' || status === 'PENDING' || status === 'PROCESSING') && (
               <div className="w-full">
                  <p className="mb-2 text-sm text-gray-600">{status === 'PROCESSING' ? `Processing: ${progress}%` : 'Initiating job...'}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                  </div>
              </div>
          )}
          {status === 'COMPLETED' && <p className="text-sm text-green-600">Preparing download...</p>}
          {status === 'DOWNLOAD_READY' && <p className="text-sm text-green-600">Your download will begin shortly...</p>}
          {status === 'FAILED' && <Button onClick={initiateExport} variant="secondary">Try Again</Button>}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Data Fetching
  // --------------------------------------------------------------------------
  const fetchRegistrations = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);

    try {
        const params: any = { 
            limit: 1000, 
            orderBy: [{ column: 'full_name', ascending: true }] 
        };
        // Note: Filter status logic kept client-side for smoother UX unless huge dataset
        // if (filterStatus !== 'ALL') params.filters = { status: filterStatus };

      const response = await callGateway('/api/a_crud_universal_read', {
        config_id: CONFIGS.READ_REGISTRATIONS,
        params: params,
      }, accessToken);
      
      const rawData = response.data || [];

      // Fix: Sanitize data to prevent null crashes
      const sanitizedData = rawData.map((row: any) => ({
          ...row,
          full_name: row.full_name || '',
          emp_code: row.emp_code || '',
          uan_number: row.uan_number || '',
          member_id: row.member_id || '',
          // Ensure booleans are booleans
          is_exempted: !!row.is_exempted,
          is_voluntary: !!row.is_voluntary,
          override_wage_ceiling: !!row.override_wage_ceiling,
          employer_matches_excess: !!row.employer_matches_excess
      }));
      
      setRegistrations(sanitizedData);
    } catch (e: any) {
       setError(`Failed to fetch data: ${e.message}`);
       setRegistrations([]); 
    } finally {
      setLoading(false);
    }
  }, [accessToken]); 

  useEffect(() => {
    if (accessToken) fetchRegistrations();
  }, [accessToken, fetchRegistrations]);

  // --------------------------------------------------------------------------
  // Modal Handlers
  // --------------------------------------------------------------------------
  const openEditModal = (record: EmployeeRegistration) => {
      // Deep copy and formatting dates for Input type="date"
      const copy = JSON.parse(JSON.stringify(record));
      const dateFields = ['registration_date', 'exit_date', 'exemption_from_date', 'exemption_to_date', 'opt_in_date', 'opt_out_date', 'override_effective_from', 'override_effective_to'];
      
      dateFields.forEach(field => {
          if (copy[field]) copy[field] = copy[field].split('T')[0];
      });

      setEditingRecord(copy);
      setModalTab(1); // Reset to first tab
      setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
      setIsEditModalOpen(false);
      setEditingRecord(null);
  };

  const handleModalChange = (field: keyof EmployeeRegistration, value: any) => {
      setEditingRecord(prev => prev ? ({ ...prev, [field]: value }) : null);
  };

  const handleSave = async () => {
      if (!accessToken || !editingRecord) return;
      setSaveLoading(true);
      
      // Wrap single record in array for bulk upsert
      // Remove any UI specific flags if they existed (is_dirty is not on editingRecord)
      const { id, ...recordWithoutId } = editingRecord;
      const payload = [recordWithoutId];

      try {
        await callGateway('/api/a_crud_universal_bulk_upsert', {
            config_id: CONFIGS.BULK_UPSERT_REGISTRATIONS,
            input_rows: payload
        }, accessToken);
        
        await fetchRegistrations(); // Refresh table
        closeEditModal();
      } catch (e: any) {
          alert(`Save failed: ${e.message}`); // Simple alert for modal error
      } finally {
          setSaveLoading(false);
      }
  };

  // --------------------------------------------------------------------------
  // Bulk Upload Handlers
  // --------------------------------------------------------------------------
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFileToUpload(selectedFile);
      setUploadError(null);
      setUploadSuccess(null);
    }
  };

  const handleUpload = async () => {
    if (!fileToUpload) {
      setUploadError('Please select a file first.');
      return;
    }
    if (sessionLoading) {
      setUploadError('Please wait, session is still loading.');
      return;
    }
    if (!session?.access_token) {
      setUploadError('You must be logged in to upload files.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('config_id', CONFIGS.UPLOAD_REGISTRATIONS);
    formData.append('accessToken', session.access_token);

    try {
      const response = await fetch('/api/universal-excel-upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'File upload failed.');
      }

      setUploadSuccess(result.message || 'File uploaded successfully!');
      setFileToUpload(null); // Reset file input state
      fetchRegistrations(); // Refresh data in the main table
    } catch (err: any) {
      setUploadError(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // --------------------------------------------------------------------------
  // Filtering
  // --------------------------------------------------------------------------
  const filteredRegistrations = useMemo(() => {
      return registrations.filter(r =>
        ((r.full_name || '').toLowerCase().includes(filterText.toLowerCase()) ||
        (r.emp_code || '').toLowerCase().includes(filterText.toLowerCase()) ||
        (r.uan_number || '').includes(filterText)) &&
        (filterStatus === 'ALL' || r.status === filterStatus)
      );
  }, [registrations, filterText, filterStatus]);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="mb-4">
        <a href="/payroll_admin/pf-dashboard" className="text-blue-600 hover:underline">&larr; Back to PF Dashboard</a>
      </div>
      
      <Tabs>
        {/* TAB 1: MANAGE REGISTRATIONS */}
        <Tabs.Tab label="Manage Registrations">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Employee Registration Manager</h1>
                <Button onClick={() => fetchRegistrations()} variant="secondary" size="sm">Refresh</Button>
            </div>

            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="flex justify-between mb-4">
                    <Input 
                        type="text"
                        placeholder="Search by Name, Code, or UAN..."
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                        className="max-w-sm"
                    />
                    <select
                        suppressHydrationWarning={true}
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value as any)}
                        className="p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="ACTIVE">Active</option>
                        <option value="PENDING_UAN">Pending UAN</option>
                        <option value="UAN_LINKED">UAN Linked</option>
                        <option value="EXITED">Exited</option>
                    </select>
                </div>

                {loading ? <Loader /> : (
                    <div className="overflow-x-auto rounded-md border border-gray-200">
                        <table className="min-w-full text-sm divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Emp Code</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">UAN</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Registration Date</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Exit Date</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredRegistrations.length > 0 ? filteredRegistrations.map(r => (
                                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 text-gray-900 font-medium">{r.emp_code}</td>
                                        <td className="px-4 py-3 text-gray-700">{r.full_name}</td>
                                        <td className="px-4 py-3 text-gray-500">{r.uan_number || '-'}</td>
                                        <td className="px-4 py-3 text-gray-500">{r.registration_date}</td>
                                        <td className="px-4 py-3 text-gray-500">{r.exit_date || '-'}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                                                r.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                                r.status === 'EXITED' ? 'bg-red-100 text-red-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {r.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-left">
                                            <Button onClick={() => openEditModal(r)} variant="secondary" size="sm">Edit</Button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={7} className="text-center py-8 text-gray-500">No registrations found matching your filters.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Tabs.Tab>

        {/* TAB 2: BULK UPLOAD */}
        <Tabs.Tab label="Bulk Upload">
            <div className="p-6 bg-white rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold">Bulk PF Registration</h1>
                </div>

                {uploading && <Loader />}
                {uploadError && <p className="text-red-500">Error: {uploadError}</p>}
                {uploadSuccess && <p className="text-green-500">{uploadSuccess}</p>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Download Section */}
                    <div className="p-6 border border-gray-200 rounded-lg">
                        <h2 className="text-xl font-semibold mb-4">Step 1: Download Template</h2>
                        <p className="mb-4 text-gray-600">
                            Download the Excel template to fill in the employee PF registration details.
                        </p>
                        <TemplateDownloader config_id={CONFIGS.DOWNLOAD_TEMPLATE} />
                    </div>

                    {/* Upload Section */}
                    <div className="p-6 border border-gray-200 rounded-lg">
                        <h2 className="text-xl font-semibold mb-4">Step 2: Upload File</h2>
                        <p className="mb-4 text-gray-600">
                            Once you have filled out the template, upload the file here to process the registrations.
                        </p>
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            disabled={uploading}
                        />
                        {fileToUpload && (
                          <div className="mt-4">
                            <p className="text-sm text-gray-600">Selected file: {fileToUpload.name}</p>
                            <Button onClick={handleUpload} disabled={uploading} isLoading={uploading} className="mt-2">
                                Upload File
                            </Button>
                          </div>
                        )}
                    </div>
                </div>
            </div>
        </Tabs.Tab>
      </Tabs>

      {/* ================= EDIT MODAL ================= */}
      {isEditModalOpen && editingRecord && (
          <Modal 
            isOpen={true} 
            title={`Edit: ${editingRecord.full_name} (${editingRecord.emp_code})`} 
            onClose={closeEditModal}
            maxWidth="max-w-4xl"
          >
              <div className="flex flex-col h-[70vh]">
                  {/* Internal Tabs Navigation */}
                  <div className="flex space-x-1 border-b border-gray-200 mb-4">
                      {['Basic Info', 'Exemption & Voluntary', 'Wage Override'].map((label, idx) => (
                          <button
                            key={idx}
                            onClick={() => setModalTab(idx + 1)}
                            className={`px-4 py-2 text-sm font-medium focus:outline-none border-b-2 transition-colors ${
                                modalTab === idx + 1 
                                ? 'border-blue-600 text-blue-600' 
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                          >
                              {label}
                          </button>
                      ))}
                  </div>

                  {/* Scrollable Content Area */}
                  <div className="flex-1 overflow-y-auto px-1 pb-4">
                      
                      {/* TAB 1: BASIC INFO */}
                      {modalTab === 1 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Establishment ID</label>
                                  <Input type="number" value={editingRecord.establishment_id || ''} onChange={e => handleModalChange('establishment_id', parseInt(e.target.value) || null)} />
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Member ID</label>
                                  <Input value={editingRecord.member_id || ''} onChange={e => handleModalChange('member_id', e.target.value)} />
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-gray-500 mb-1">Status (Read Only)</label>
                                  <Input value={editingRecord.status} disabled className="bg-gray-100" />
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-gray-500 mb-1">Previous Member ID (Read Only)</label>
                                  <Input value={editingRecord.previous_member_id || ''} disabled className="bg-gray-100" />
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-gray-500 mb-1">Bank Account (Read Only)</label>
                                  <Input value={editingRecord.bank_account_number || ''} disabled className="bg-gray-100" />
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-gray-500 mb-1">IFSC Code (Read Only)</label>
                                  <Input value={editingRecord.bank_ifsc_code || ''} disabled className="bg-gray-100" />
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-gray-500 mb-1">Bank Name (Read Only)</label>
                                  <Input value={editingRecord.bank_name || ''} disabled className="bg-gray-100" />
                              </div>
                          </div>
                      )}

                      {/* TAB 2: EXEMPTION & VOLUNTARY */}
                      {modalTab === 2 && (
                          <div className="space-y-6">
                              <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                  <h3 className="font-semibold text-gray-800 mb-3 border-b pb-2">Exemption Details</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="col-span-2">
                                          <ToggleSwitch 
                                            id="is_exempted" 
                                            label="Is Exempted" 
                                            checked={editingRecord.is_exempted} 
                                            onChange={val => handleModalChange('is_exempted', val)} 
                                          />
                                      </div>
                                      <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">Exemption Type</label>
                                          <select 
                                            className="w-full p-2 border border-gray-300 rounded-md text-sm"
                                            value={editingRecord.exemption_type || ''}
                                            onChange={e => handleModalChange('exemption_type', e.target.value)}
                                            disabled={!editingRecord.is_exempted}
                                          >
                                              <option value="">Select Type</option>
                                              {EXEMPTION_TYPES.map(type => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}
                                          </select>
                                      </div>
                                      <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">Exemption Reason</label>
                                          <Input value={editingRecord.exemption_reason || ''} onChange={e => handleModalChange('exemption_reason', e.target.value)} disabled={!editingRecord.is_exempted} />
                                      </div>
                                      <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                                          <Input type="date" value={editingRecord.exemption_from_date || ''} onChange={e => handleModalChange('exemption_from_date', e.target.value)} disabled={!editingRecord.is_exempted} />
                                      </div>
                                      <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                                          <Input type="date" value={editingRecord.exemption_to_date || ''} onChange={e => handleModalChange('exemption_to_date', e.target.value)} disabled={!editingRecord.is_exempted} />
                                      </div>
                                  </div>
                              </div>

                              <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                  <h3 className="font-semibold text-gray-800 mb-3 border-b pb-2">Voluntary PF</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="col-span-2">
                                          <ToggleSwitch 
                                            id="is_voluntary" 
                                            label="Is Voluntary" 
                                            checked={editingRecord.is_voluntary} 
                                            onChange={val => handleModalChange('is_voluntary', val)} 
                                          />
                                      </div>
                                      <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">Opt-in Date</label>
                                          <Input type="date" value={editingRecord.opt_in_date || ''} onChange={e => handleModalChange('opt_in_date', e.target.value)} disabled={!editingRecord.is_voluntary} />
                                      </div>
                                      <div>
                                          <label className="block text-sm font-medium text-gray-700 mb-1">Opt-out Date</label>
                                          <Input type="date" value={editingRecord.opt_out_date || ''} onChange={e => handleModalChange('opt_out_date', e.target.value)} disabled={!editingRecord.is_voluntary} />
                                      </div>
                                      <div className="col-span-2">
                                          <label className="block text-sm font-medium text-gray-700 mb-1">Opt-out Reason</label>
                                          <Input value={editingRecord.opt_out_reason || ''} onChange={e => handleModalChange('opt_out_reason', e.target.value)} disabled={!editingRecord.is_voluntary} />
                                      </div>
                                  </div>
                              </div>
                          </div>
                      )}

                      {/* TAB 3: WAGE OVERRIDE */}
                      {modalTab === 3 && (
                          <div className="bg-gray-50 p-4 rounded border border-gray-200 space-y-4">
                              <ToggleSwitch 
                                id="override_wage_ceiling" 
                                label="Override Wage Ceiling" 
                                checked={editingRecord.override_wage_ceiling} 
                                onChange={val => handleModalChange('override_wage_ceiling', val)} 
                              />
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Custom Wage Ceiling</label>
                                      <Input type="number" value={editingRecord.custom_wage_ceiling || ''} onChange={e => handleModalChange('custom_wage_ceiling', parseFloat(e.target.value) || null)} disabled={!editingRecord.override_wage_ceiling} />
                                  </div>
                                  <div className="flex items-end pb-2">
                                      <ToggleSwitch 
                                        id="employer_matches_excess" 
                                        label="Employer Matches Excess" 
                                        checked={editingRecord.employer_matches_excess} 
                                        onChange={val => handleModalChange('employer_matches_excess', val)} 
                                        disabled={!editingRecord.override_wage_ceiling}
                                      />
                                  </div>
                                  <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Effective From</label>
                                      <Input type="date" value={editingRecord.override_effective_from || ''} onChange={e => handleModalChange('override_effective_from', e.target.value)} disabled={!editingRecord.override_wage_ceiling} />
                                  </div>
                                  <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Effective To</label>
                                      <Input type="date" value={editingRecord.override_effective_to || ''} onChange={e => handleModalChange('override_effective_to', e.target.value)} disabled={!editingRecord.override_wage_ceiling} />
                                  </div>
                                  <div className="col-span-2">
                                      <label className="block text-sm font-medium text-gray-700 mb-1">Override Reason</label>
                                      <Input value={editingRecord.override_reason || ''} onChange={e => handleModalChange('override_reason', e.target.value)} disabled={!editingRecord.override_wage_ceiling} />
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>

                  {/* Modal Footer */}
                  <div className="border-t border-gray-200 pt-4 flex justify-end space-x-2 mt-auto">
                      <Button variant="ghost" onClick={closeEditModal}>Cancel</Button>
                      <Button onClick={handleSave} isLoading={saveLoading}>Save Changes</Button>
                  </div>
              </div>
          </Modal>
      )}
    </div>
  );
}