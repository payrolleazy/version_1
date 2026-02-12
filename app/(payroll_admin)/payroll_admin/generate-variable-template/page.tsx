'use client';

import { useState, useEffect } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from 'react-select';
import * as XLSX from 'xlsx';

interface ComponentOption {
  value: string;
  label: string;
}

interface ParsedRow {
  row_num: number;
  emp_code: string;
  emp_name?: string;
  [key: string]: any;
}

interface UploadResult {
  success: boolean;
  message: string;
  data?: {
    success_count: number;
    failed_count: number;
    errors: Array<{
      row_num: number;
      emp_code: string;
      component_code: string;
      error_message: string;
    }>;
  };
  metadata?: {
    file_name: string;
    rows_processed: number;
    headers: string[];
  };
}

export default function GenerateVariableTemplatePage() {
  const { session } = useSessionContext();
  const [activeTab, setActiveTab] = useState<'download' | 'upload'>('download');

  // Download state
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [payrollPeriod, setPayrollPeriod] = useState('');
  const [selectedComponents, setSelectedComponents] = useState<ComponentOption[]>([]);
  const [employeeCodes, setEmployeeCodes] = useState('');
  const [includeWithInputs, setIncludeWithInputs] = useState(false);

  // Upload state
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadPeriod, setUploadPeriod] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ParsedRow[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  // Component options
  const [componentOptions, setComponentOptions] = useState<ComponentOption[]>([]);
  const [componentsLoading, setComponentsLoading] = useState(true);

  useEffect(() => {
    const fetchComponents = async () => {
      if (!session) return;
      setComponentsLoading(true);
      try {
        const response = await fetch('/api/a_crud_universal_read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            config_id: 'f0a1b2c3-d4e5-4f67-8901-23456789abcd',
            accessToken: session.access_token,
          }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Failed to fetch components');
        }
        const options = result.data.map((comp: any) => ({
          value: comp.component_code,
          label: `${comp.name} (${comp.component_code})`,
        }));
        setComponentOptions(options);
      } catch (err: any) {
        console.error('Failed to fetch components:', err);
        setDownloadError('Failed to load component list. Please try again.');
      } finally {
        setComponentsLoading(false);
      }
    };

    fetchComponents();
  }, [session]);

  // Download handlers
  const handleGenerate = async () => {
    if (!session) return;
    if (selectedComponents.length > 3) {
      setDownloadError('You can select a maximum of 3 variable components at a time.');
      return;
    }
    setDownloadLoading(true);
    setDownloadError(null);

    try {
      const params = {
        payroll_period: payrollPeriod,
        p_component_codes: selectedComponents.map(c => c.value),
        p_employee_codes: employeeCodes.split(',').map(code => code.trim()).filter(code => code),
        p_include_employees_with_inputs: includeWithInputs,
      };

      const response = await fetch('/api/excel-template-generator-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config_id: 'generate-variable-input-template',
          params: params,
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        let errorMessage = result.message || result.error || 'Failed to generate template';
        if (result.details) {
          errorMessage += ` - ${JSON.stringify(result.details)}`;
        }
        throw new Error(errorMessage);
      }

      window.location.href = result.downloadUrl;

    } catch (err: any) {
      setDownloadError(err.message);
    } finally {
      setDownloadLoading(false);
    }
  };

  // Upload handlers
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setUploadError('Please select a valid Excel file (.xlsx or .xls)');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setUploadError(null);
    setUploadResult(null);

    // Parse and preview the file
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Get the "Data" sheet
      const sheetName = 'Data';
      if (!workbook.Sheets[sheetName]) {
        throw new Error('Excel file must contain a sheet named "Data"');
      }

      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: '',
        blankrows: false
      });

      if (jsonData.length === 0) {
        throw new Error('No data found in the Data sheet');
      }

      // Extract headers
      const headers = Object.keys(jsonData[0] as object);
      
      // Take first 10 rows for preview
      const preview = jsonData.slice(0, 10).map((row, index) => ({
        row_num: index + 1,
        ...row
      })) as ParsedRow[];

      setPreviewHeaders(headers);
      setPreviewData(preview);
      setShowPreview(true);

    } catch (err: any) {
      console.error('File parsing error:', err);
      setUploadError(`Failed to parse file: ${err.message}`);
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!session || !selectedFile || !uploadPeriod) {
      setUploadError('Please select a file and payroll period');
      return;
    }

    setUploadLoading(true);
    setUploadError(null);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('config_id', 'bulk-upload-variable-inputs');
      formData.append('params', JSON.stringify({
        payroll_period: uploadPeriod,
        data_source: 'Excel Upload'
      }));
      formData.append('accessToken', session.access_token);

      const response = await fetch('/api/universal-excel-upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || 'Upload failed');
      }

      setUploadResult(result);
      setShowPreview(false);

      // Clear file input if successful
      if (result.data?.failed_count === 0) {
        setSelectedFile(null);
        setPreviewData([]);
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }

    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDownloadErrorReport = () => {
    if (!uploadResult?.data?.errors) return;

    const errors = uploadResult.data.errors;
    const worksheet = XLSX.utils.json_to_sheet(errors);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Errors');
    XLSX.writeFile(workbook, `upload_errors_${new Date().getTime()}.xlsx`);
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading session...</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">
          Variable Payroll Input Management
        </h1>

        {/* Tab Navigation */}
        <div className="bg-white rounded-t-lg shadow-sm border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab('download')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'download'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📥 Download Template
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'upload'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              📤 Upload Data
            </button>
          </div>
        </div>

        {/* Download Tab */}
        {activeTab === 'download' && (
          <div className="bg-white rounded-b-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">
              Generate Variable Input Template
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Generate an Excel template with employee data pre-filled. Select components and filters below.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="payroll-period" className="block text-sm font-medium text-gray-700 mb-1">
                  Payroll Period *
                </label>
                <Input
                  type="date"
                  id="payroll-period"
                  value={payrollPeriod}
                  onChange={(e) => setPayrollPeriod(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label htmlFor="component-codes" className="block text-sm font-medium text-gray-700 mb-1">
                  Variable Components (Max 3)
                </label>
                <Select
                  id="component-codes"
                  isMulti
                  options={componentOptions}
                  value={selectedComponents}
                  onChange={(selected) => setSelectedComponents(selected as ComponentOption[])}
                  isLoading={componentsLoading}
                  placeholder="Select up to 3 components..."
                  className="w-full"
                  styles={{
                    control: (provided) => ({
                      ...provided,
                      border: '1px solid #D1D5DB',
                      borderRadius: '0.5rem',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    })
                  }}
                />
                {selectedComponents.length > 3 && (
                  <p className="text-red-500 text-sm mt-1">
                    You can select a maximum of 3 variable components.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="employee-codes" className="block text-sm font-medium text-gray-700 mb-1">
                  Employee Codes (comma-separated, optional)
                </label>
                <textarea
                  id="employee-codes"
                  value={employeeCodes}
                  onChange={(e) => setEmployeeCodes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="e.g., EMP001, EMP002, EMP003"
                />
              </div>

              <div className="flex items-center">
                <input
                  id="include-with-inputs"
                  type="checkbox"
                  checked={includeWithInputs}
                  onChange={(e) => setIncludeWithInputs(e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="include-with-inputs" className="ml-2 block text-sm text-gray-900">
                  Include only employees with existing inputs for this period
                </label>
              </div>

              <Button 
                onClick={handleGenerate} 
                isLoading={downloadLoading} 
                disabled={selectedComponents.length > 3 || !payrollPeriod}
                className="w-full"
              >
                📥 Generate & Download Template
              </Button>

              {downloadError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  <p className="font-medium">Error:</p>
                  <p className="text-sm">{downloadError}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="bg-white rounded-b-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">
              Upload Variable Input Data
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Upload a filled Excel template to update payroll input data for multiple employees.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="upload-period" className="block text-sm font-medium text-gray-700 mb-1">
                  Payroll Period *
                </label>
                <Input
                  type="date"
                  id="upload-period"
                  value={uploadPeriod}
                  onChange={(e) => setUploadPeriod(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-1">
                  Excel File *
                </label>
                <input
                  type="file"
                  id="file-upload"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Accepted formats: .xlsx, .xls (Max size: 10MB)
                </p>
              </div>

              {selectedFile && !showPreview && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded">
                  <p className="text-sm">
                    ✅ File selected: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(2)} KB)
                  </p>
                </div>
              )}

              {/* Preview Section */}
              {showPreview && previewData.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h3 className="text-lg font-semibold mb-3 text-gray-700">
                    📋 Data Preview (First 10 rows)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">
                            Row
                          </th>
                          {previewHeaders.map((header, idx) => (
                            <th key={idx} className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {previewData.map((row, rowIdx) => (
                          <tr key={rowIdx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 whitespace-nowrap text-gray-900 font-medium">
                              {row.row_num}
                            </td>
                            {previewHeaders.map((header, colIdx) => (
                              <td key={colIdx} className="px-3 py-2 whitespace-nowrap text-gray-700">
                                {row[header] || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Showing {previewData.length} of {previewData.length} rows from the file
                  </p>
                </div>
              )}

              <Button 
                onClick={handleUpload} 
                isLoading={uploadLoading} 
                disabled={!selectedFile || !uploadPeriod}
                className="w-full"
              >
                📤 Upload & Process Data
              </Button>

              {uploadError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  <p className="font-medium">Upload Error:</p>
                  <p className="text-sm">{uploadError}</p>
                </div>
              )}

              {/* Upload Results */}
              {uploadResult && (
                <div className={`border rounded-lg p-4 ${
                  uploadResult.data?.failed_count === 0 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800">
                    {uploadResult.data?.failed_count === 0 ? '✅' : '⚠️'} Upload Results
                  </h3>
                  
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-white rounded p-3 shadow-sm">
                      <p className="text-xs text-gray-600 mb-1">Total Rows</p>
                      <p className="text-2xl font-bold text-gray-800">
                        {uploadResult.metadata?.rows_processed || 0}
                      </p>
                    </div>
                    <div className="bg-white rounded p-3 shadow-sm">
                      <p className="text-xs text-gray-600 mb-1">Success</p>
                      <p className="text-2xl font-bold text-green-600">
                        {uploadResult.data?.success_count || 0}
                      </p>
                    </div>
                    <div className="bg-white rounded p-3 shadow-sm">
                      <p className="text-xs text-gray-600 mb-1">Failed</p>
                      <p className="text-2xl font-bold text-red-600">
                        {uploadResult.data?.failed_count || 0}
                      </p>
                    </div>
                  </div>

                  {uploadResult.data && uploadResult.data.failed_count > 0 && (
                    <>
                      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
                        <h4 className="font-semibold text-gray-800 mb-2">❌ Failed Rows:</h4>
                        <div className="overflow-x-auto max-h-60">
                          <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Row</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Emp Code</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Component</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Error</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {uploadResult.data.errors.map((error, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 whitespace-nowrap">{error.row_num}</td>
                                  <td className="px-3 py-2 whitespace-nowrap">{error.emp_code}</td>
                                  <td className="px-3 py-2 whitespace-nowrap">{error.component_code}</td>
                                  <td className="px-3 py-2 text-red-600">{error.error_message}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <Button 
                        onClick={handleDownloadErrorReport}
                        className="w-full bg-yellow-600 hover:bg-yellow-700"
                      >
                        📥 Download Error Report
                      </Button>
                    </>
                  )}

                  {uploadResult.data?.failed_count === 0 && (
                    <p className="text-green-700 text-sm">
                      🎉 All records processed successfully!
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}