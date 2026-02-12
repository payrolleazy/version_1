'use client';

import React from 'react';
import Modal from '@/components/Modal';

interface PayrollArea {
  id: number;
  tenant_id: string;
  area_code: string;
  description: string | null;
  periodicity: string;
  currency_code: string;
  country_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface PayrollAreaViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  payrollArea: PayrollArea | null;
}

export default function PayrollAreaViewModal({ isOpen, onClose, payrollArea }: PayrollAreaViewModalProps) {
  if (!payrollArea) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="View Payroll Area">
      <div className="p-8 bg-gradient-to-r from-[#faf7ff] to-[#f5f8ff] rounded-lg shadow-inner">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Payroll Area Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-gray-700">
          
          <div><strong>Area Code:</strong> {payrollArea.area_code}</div>
          <div><strong>Periodicity:</strong> {payrollArea.periodicity}</div>
          <div><strong>Currency:</strong> {payrollArea.currency_code}</div>
          <div><strong>Country:</strong> {payrollArea.country_code}</div>
          <div><strong>Status:</strong> <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${payrollArea.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{payrollArea.is_active ? 'Active' : 'Inactive'}</span></div>
          
          <div className="md:col-span-2 mt-4">
              <h3 className="text-lg font-semibold mb-2 text-gray-800">Description</h3>
              <p className="text-gray-600">{payrollArea.description || 'No description provided.'}</p>
          </div>

          <div className="md:col-span-2 mt-4 border-t pt-4">
              <h3 className="text-lg font-semibold mb-2 text-gray-800">Metadata</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-500">
                  <div><strong>ID:</strong> {payrollArea.id}</div>
                  <div><strong>Created At:</strong> {new Date(payrollArea.created_at).toLocaleString()}</div>
                  <div><strong>Updated At:</strong> {new Date(payrollArea.updated_at).toLocaleString()}</div>
              </div>
          </div>

        </div>
      </div>
    </Modal>
  );
}
