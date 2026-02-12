'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/Modal';
import { v4 as uuidv4 } from 'uuid';

const TENANT_READ_CONFIG_ID = '80e992fe-9d7c-4ab4-b89d-4999ceae2e79';
const TENANT_UPSERT_CONFIG_ID = '1cf17375-6c2a-45a9-a5f4-d9d5510740f7';
const COMPANY_TYPE_READ_CONFIG_ID = 'd59c5da7-a204-473e-9134-ab1ddbc69e7e'; // Provided by user
const INDUSTRY_TYPE_READ_CONFIG_ID = '374b0e27-cce2-44fa-ba9a-a5a1fb8b7043';

interface Tenant {
  tenant_id: string;
  company_legal_name: string | null;
  company_display_name: string | null;
  status: string | null;
  company_type: string | null;
  industry_type: string | null; // text
  incorporation_date: string | null; // date
  cin_llpin: string | null;
  company_pan: string | null;
  company_tan: string | null;
  gstin: string | null;
  udyam_aadhar_no: string | null;
  is_msme: boolean | null;
  registered_address_line1: string | null;
  registered_address_line2: string | null;
  registered_city: string | null;
  registered_state_code: string | null;
  registered_pincode: string | null;
  corporate_address_line1: string | null;
  corporate_city: string | null;
  corporate_state_code: string | null;
  corporate_pincode: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  logo_url: string | null;
  website_url: string | null;
  financial_year_start_month: number | null;
  default_timezone: string | null;
  default_currency_code: string | null;
  onboarding_step_completed: number | null;
  onboarding_completed_at: string | null; // timestamp
  subscription_plan_id: string | null; // uuid
  subscription_status: string | null;
  trial_ends_at: string | null; // timestamp
  created_by: string | null; // uuid
  created_at: string | null; // timestamp - system generated
  updated_at: string | null; // timestamp - system generated

  // data_encryption_key: any | null; // bytea - not directly editable
  data_retention_policy_accepted_at: string | null; // timestamp
  dpo_contact_email: string | null;
  deleted_at: string | null; // timestamp
  use_legacy_codes: boolean | null;
  emp_code_prefix: string | null;

}

interface CompanyType {
  id: number;
  company_type: string;
}

interface IndustryType {
  id: string;
  industry_type: string;
}

export default function OrgInfoPage() {
  const { session } = useSessionContext();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [companyTypes, setCompanyTypes] = useState<CompanyType[]>([]);
  const [industryTypes, setIndustryTypes] = useState<IndustryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Tenant>>({});
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!session?.access_token || !session?.user?.id) {
        throw new Error('Authentication required to fetch tenants.');
      }

      console.log('Current session user ID:', session?.user?.id);
      const response = await fetch('/api/a_crud_universal_read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config_id: TENANT_READ_CONFIG_ID,
          params: {}, // Fetch all tenants for now
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();
      console.log('API response data:', result.data);

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to fetch tenants');
      }

      // Expecting either 0 or 1 tenant for the current user
      if (result.data && result.data.length > 0) {
        setTenants(result.data); // Store the found tenant(s)
        setFormData(result.data[0]); // Pre-fill form with the first tenant found
      } else {
        setTenants([]);
        setFormData({}); // Clear form if no tenant found
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  const fetchCompanyTypes = useCallback(async () => {
    try {
      if (!session?.access_token) {
        throw new Error('Authentication required to fetch company types.');
      }

      const response = await fetch('/api/a_crud_universal_read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config_id: COMPANY_TYPE_READ_CONFIG_ID,
          params: {}, // Fetch all company types
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        console.error('API Error fetching company types:', result.error || 'Unknown error');
        throw new Error(result.error || 'Failed to fetch company types');
      }

      console.log('Fetched company types:', result.data); // Log the fetched data
      setCompanyTypes(result.data || []);
    } catch (err: any) {
      console.error('Error fetching company types:', err.message); // Log any catch errors
      // Optionally set an error state for company types specifically
    }
  }, [session]);

  const fetchIndustryTypes = useCallback(async () => {
    try {
      if (!session?.access_token) {
        throw new Error('Authentication required to fetch industry types.');
      }

      const response = await fetch('/api/a_crud_universal_read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config_id: INDUSTRY_TYPE_READ_CONFIG_ID,
          params: {}, // Fetch all industry types
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        console.error('API Error fetching industry types:', result.error || 'Unknown error');
        throw new Error(result.error || 'Failed to fetch industry types');
      }

      console.log('Fetched industry types:', result.data); // Log the fetched data
      setIndustryTypes(result.data || []);
    } catch (err: any) {
      console.error('Error fetching industry types:', err.message); // Log any catch errors
      // Optionally set an error state for industry types specifically
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchTenants();
      fetchCompanyTypes();
      fetchIndustryTypes();
    }
  }, [session, fetchTenants, fetchCompanyTypes, fetchIndustryTypes]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);

    try {
      if (!session?.access_token) {
        throw new Error('Authentication required to save tenant.');
      }

      const payload = {
        ...formData, // Spread all form data
        tenant_id: editingTenantId || uuidv4(), // Use existing ID or generate new for inserts
        updated_at: new Date().toISOString(),
        // created_at should only be set on initial creation for new records
        ...(editingTenantId ? {} : { created_at: new Date().toISOString() }),
        // Convert date strings to ISO for consistency if present
        incorporation_date: formData.incorporation_date ? new Date(formData.incorporation_date).toISOString().split('T')[0] : null,
        onboarding_completed_at: formData.onboarding_completed_at ? new Date(formData.onboarding_completed_at).toISOString() : null,
        trial_ends_at: formData.trial_ends_at ? new Date(formData.trial_ends_at).toISOString() : null,
        data_retention_policy_accepted_at: formData.data_retention_policy_accepted_at ? new Date(formData.data_retention_policy_accepted_at).toISOString() : null,
        deleted_at: formData.deleted_at ? new Date(formData.deleted_at).toISOString() : null,
        // Handle JSON fields



      };

      const response = await fetch('/api/a_crud_universal_bulk_upsert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config_id: TENANT_UPSERT_CONFIG_ID,
          input_rows: [payload],
          accessToken: session.access_token,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to save tenant');
      }

      setIsModalOpen(false);
      setEditingTenantId(null);
      setFormData({});
      fetchTenants(); // Refresh the table
    } catch (err: any) {
      setError(err.message);
      console.error("Form submission error", err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleAddNewTenant = () => {
    setEditingTenantId(null);
    setFormData({
        // Set sensible defaults for new tenants
        status: 'active',
        is_msme: false,
        financial_year_start_month: 4, // April
        default_timezone: 'Asia/Kolkata',
        default_currency_code: 'INR',
        use_legacy_codes: true,
        emp_code_prefix: 'PYZ',
        created_by: session?.user?.id || null,
        company_legal_name: '',
        company_display_name: '',
        company_type: '',
        industry_type: '',
        incorporation_date: '',
        cin_llpin: '',
        company_pan: '',
        company_tan: '',
        gstin: '',
        udyam_aadhar_no: '',
        registered_address_line1: '',
        registered_address_line2: '',
        registered_city: '',
        registered_state_code: '',
        registered_pincode: '',
        corporate_address_line1: '',
        corporate_city: '',
        corporate_state_code: '',
        corporate_pincode: '',
        primary_contact_name: '',
        primary_contact_email: '',
        primary_contact_phone: '',
        logo_url: '',
        website_url: '',



    });
    setIsModalOpen(true);
  };

  const handleEditTenant = (tenant: Tenant) => {
    setEditingTenantId(tenant.tenant_id);
    // Pre-fill form with existing tenant data, convert dates to input-compatible format
    setFormData({
      ...tenant,
      incorporation_date: tenant.incorporation_date ? new Date(tenant.incorporation_date).toISOString().split('T')[0] : '',


    });
    setIsModalOpen(true);
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading session...</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Organization Information</h1>
        {loading ? (
          <p>Loading...</p>
        ) : tenants.length === 0 ? (
          <Button onClick={handleAddNewTenant}>Add New Tenant</Button>
        ) : (
          <Button onClick={() => handleEditTenant(tenants[0])}>Edit Organization Info</Button>
        )}
      </div>

      {error && <p className="text-red-500">Error: {error}</p>}

      {!loading && tenants.length === 0 && (
        <div className="p-4 bg-yellow-100 text-yellow-800 rounded-md">
          <p>No organization information found. Please add your organization details.</p>
        </div>
      )}

      {!loading && tenants.length > 0 && (
        <div className="p-8 bg-gradient-to-r from-[#faf7ff] to-[#f5f8ff] rounded-lg shadow-inner">
          <h2 className="text-2xl font-bold mb-4">Current Organization Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
            <div><strong>Legal Name:</strong> {tenants[0].company_legal_name}</div>
            <div><strong>Display Name:</strong> {tenants[0].company_display_name}</div>
            <div><strong>Status:</strong> {tenants[0].status}</div>
            <div><strong>Company Type:</strong> {tenants[0].company_type}</div>
            <div><strong>Industry Type:</strong> {tenants[0].industry_type}</div>
            <div><strong>Incorporation Date:</strong> {tenants[0].incorporation_date}</div>
            <div><strong>Primary Contact:</strong> {tenants[0].primary_contact_name} ({tenants[0].primary_contact_email})</div>
            {/* Add more display fields as needed */}
          </div>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTenantId ? 'Edit Tenant' : 'Add New Tenant'}>
        <form onSubmit={handleFormSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <h2 className="text-xl font-bold mb-2">Company Details</h2>
          </div>
          <div>
            <label htmlFor="company_legal_name" className="block text-sm font-medium text-gray-700">Company Legal Name</label>
            <Input type="text" id="company_legal_name" name="company_legal_name" value={formData.company_legal_name || ''} onChange={handleInputChange} required />
          </div>
          <div>
            <label htmlFor="company_display_name" className="block text-sm font-medium text-gray-700">Company Display Name</label>
            <Input type="text" id="company_display_name" name="company_display_name" value={formData.company_display_name || ''} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
            <select
              id="status"
              name="status"
              value={formData.status || ''}
              onChange={handleInputChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="">Select Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label htmlFor="company_type" className="block text-sm font-medium text-gray-700">Company Type</label>
            <select
              id="company_type"
              name="company_type"
              value={formData.company_type || ''}
              onChange={handleInputChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm max-h-40 overflow-y-auto"
            >
              <option key="empty-option" value="">Select Company Type</option>
              {companyTypes.map((type) => (
                <option key={type.id} value={type.company_type}>
                  {type.company_type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="industry_type" className="block text-sm font-medium text-gray-700">Industry Type</label>
            <select
              id="industry_type"
              name="industry_type"
              value={formData.industry_type || ''}
              onChange={handleInputChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm max-h-40 overflow-y-auto"
            >
              <option key="empty-industry-option" value="">Select Industry Type</option>
              {industryTypes.map((type) => (
                <option key={type.id} value={type.industry_type}>
                  {type.industry_type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="incorporation_date" className="block text-sm font-medium text-gray-700">Incorporation Date</label>
            <Input type="date" id="incorporation_date" name="incorporation_date" value={formData.incorporation_date ? formData.incorporation_date.split('T')[0] : ''} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="cin_llpin" className="block text-sm font-medium text-gray-700">CIN/LLPIN</label>
            <Input type="text" id="cin_llpin" name="cin_llpin" value={formData.cin_llpin || ''} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="company_pan" className="block text-sm font-medium text-gray-700">Company PAN</label>
            <Input type="text" id="company_pan" name="company_pan" value={formData.company_pan || ''} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="company_tan" className="block text-sm font-medium text-gray-700">Company TAN</label>
            <Input type="text" id="company_tan" name="company_tan" value={formData.company_tan || ''} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="gstin" className="block text-sm font-medium text-gray-700">GSTIN</label>
            <Input type="text" id="gstin" name="gstin" value={formData.gstin || ''} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="udyam_aadhar_no" className="block text-sm font-medium text-gray-700">Udyam Aadhar No.</label>
            <Input type="text" id="udyam_aadhar_no" name="udyam_aadhar_no" value={formData.udyam_aadhar_no || ''} onChange={handleInputChange} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="is_msme" className="flex items-center text-sm font-medium text-gray-700">
              <input type="checkbox" id="is_msme" name="is_msme" checked={formData.is_msme || false} onChange={handleInputChange} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded" />
              <span className="ml-2">Is MSME?</span>
            </label>
          </div>

          <div className="md:col-span-2">
            <h2 className="text-xl font-bold mb-2 mt-4">Registered Address</h2>
          </div>
          <div>
            <label htmlFor="registered_address_line1" className="block text-sm font-medium text-gray-700">Address Line 1</label>
            <Input type="text" id="registered_address_line1" name="registered_address_line1" value={formData.registered_address_line1 || ''} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="registered_address_line2" className="block text-sm font-medium text-gray-700">Address Line 2</label>
            <Input type="text" id="registered_address_line2" name="registered_address_line2" value={formData.registered_address_line2 || ''} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="registered_city" className="block text-sm font-medium text-gray-700">City</label>
            <Input type="text" id="registered_city" name="registered_city" value={formData.registered_city || ''} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="registered_state_code" className="block text-sm font-medium text-gray-700">State Code</label>
            <Input type="text" id="registered_state_code" name="registered_state_code" value={formData.registered_state_code || ''} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="registered_pincode" className="block text-sm font-medium text-gray-700">Pincode</label>
            <Input type="text" id="registered_pincode" name="registered_pincode" value={formData.registered_pincode || ''} onChange={handleInputChange} />
          </div>

          <div className="md:col-span-2">
            <h2 className="text-xl font-bold mb-2 mt-4">Corporate Address</h2>
          </div>
          <div>
            <label htmlFor="corporate_address_line1" className="block text-sm font-medium text-gray-700">Address Line 1</label>
            <Input type="text" id="corporate_address_line1" name="corporate_address_line1" value={formData.corporate_address_line1 || ''} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="corporate_city" className="block text-sm font-medium text-gray-700">City</label>
            <Input type="text" id="corporate_city" name="corporate_city" value={formData.corporate_city || ''} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="corporate_state_code" className="block text-sm font-medium text-gray-700">State Code</label>
            <Input type="text" id="corporate_state_code" name="corporate_state_code" value={formData.corporate_state_code || ''} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="corporate_pincode" className="block text-sm font-medium text-gray-700">Pincode</label>
            <Input type="text" id="corporate_pincode" name="corporate_pincode" value={formData.corporate_pincode || ''} onChange={handleInputChange} />
          </div>

          <div className="md:col-span-2">
            <h2 className="text-xl font-bold mb-2 mt-4">Contact Details</h2>
          </div>
          <div>
            <label htmlFor="primary_contact_name" className="block text-sm font-medium text-gray-700">Primary Contact Name</label>
            <Input type="text" id="primary_contact_name" name="primary_contact_name" value={formData.primary_contact_name || ''} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="primary_contact_email" className="block text-sm font-medium text-gray-700">Primary Contact Email</label>
            <Input type="email" id="primary_contact_email" name="primary_contact_email" value={formData.primary_contact_email || ''} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="primary_contact_phone" className="block text-sm font-medium text-gray-700">Primary Contact Phone</label>
            <Input type="text" id="primary_contact_phone" name="primary_contact_phone" value={formData.primary_contact_phone || ''} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="logo_url" className="block text-sm font-medium text-gray-700">Logo URL</label>
            <Input type="text" id="logo_url" name="logo_url" value={formData.logo_url || ''} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="website_url" className="block text-sm font-medium text-gray-700">Website URL</label>
            <Input type="text" id="website_url" name="website_url" value={formData.website_url || ''} onChange={handleInputChange} />
          </div>

          <div className="md:col-span-2">
            <h2 className="text-xl font-bold mb-2 mt-4">Financial & Onboarding</h2>
          </div>
          <div>
            <label htmlFor="financial_year_start_month" className="block text-sm font-medium text-gray-700">Financial Year Start Month (1-12)</label>
            <Input type="number" id="financial_year_start_month" name="financial_year_start_month" value={formData.financial_year_start_month || ''} onChange={handleInputChange} min="1" max="12" />
          </div>
          <div>
            <label htmlFor="default_timezone" className="block text-sm font-medium text-gray-700">Default Timezone</label>
            <Input type="text" id="default_timezone" name="default_timezone" value={formData.default_timezone || ''} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="default_currency_code" className="block text-sm font-medium text-gray-700">Default Currency Code</label>
            <Input type="text" id="default_currency_code" name="default_currency_code" value={formData.default_currency_code || ''} onChange={handleInputChange} />
          </div>



          <div className="md:col-span-2">
            <h2 className="text-xl font-bold mb-2 mt-4">Employee Code Migration</h2>
          </div>

          <div className="md:col-span-2 flex items-center justify-between">
            <label htmlFor="use_legacy_codes" className="text-sm font-medium text-gray-700">Use Legacy Codes</label>
            <button
              type="button"
              id="use_legacy_codes"
              name="use_legacy_codes"
              onClick={() => setFormData(prev => ({ ...prev, use_legacy_codes: !prev.use_legacy_codes }))}
              className={`${
                formData.use_legacy_codes ? 'bg-gradient-to-r from-[#d0b9df] to-[#a9b9df]' : 'bg-gray-200'
              } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
              role="switch"
              aria-checked={formData.use_legacy_codes}
            >
              <span className="sr-only">Use Legacy Codes</span>
              <span
                aria-hidden="true"
                className={`${
                  formData.use_legacy_codes ? 'translate-x-5' : 'translate-x-0'
                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
              />
            </button>
          </div>
          <div>
            <label htmlFor="emp_code_prefix" className="block text-sm font-medium text-gray-700">Employee Code Prefix</label>
            <Input type="text" id="emp_code_prefix" name="emp_code_prefix" value={formData.emp_code_prefix || ''} onChange={handleInputChange} />
          </div>





          <div className="md:col-span-2 flex justify-end mt-4">
            <Button type="submit" isLoading={formLoading}>
              {formLoading ? 'Saving...' : 'Save Tenant'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}