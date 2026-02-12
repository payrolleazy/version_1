'use client';

import React from 'react';

interface Document {
  id: string;
  document_name: string;
  document_type: string;
  required: boolean;
  uploaded: boolean;
  uploaded_at: string | null;
  verified: boolean;
}

interface DocumentChecklistViewProps {
  documents: Document[];
}

export default function DocumentChecklistView({ documents }: DocumentChecklistViewProps) {
  if (!documents || documents.length === 0) {
    return <div className="p-8 text-center text-gray-500">No documents in checklist</div>;
  }

  const uploaded = documents.filter(d => d.uploaded).length;
  const total = documents.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">{uploaded} of {total} documents uploaded</p>
        <div className="w-32 bg-gray-200 rounded-full h-2">
          <div className="bg-green-500 h-2 rounded-full" style={{ width: `${total > 0 ? (uploaded / total) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="space-y-2">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className={`flex items-center justify-between p-4 rounded-lg border ${
              doc.uploaded && doc.verified ? 'bg-green-50 border-green-200' :
              doc.uploaded ? 'bg-blue-50 border-blue-200' :
              doc.required ? 'bg-red-50 border-red-200' :
              'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                doc.uploaded && doc.verified ? 'bg-green-500' :
                doc.uploaded ? 'bg-blue-500' :
                'bg-gray-300'
              }`}>
                {doc.uploaded ? (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{doc.document_name}</p>
                <p className="text-xs text-gray-500">{doc.document_type}{doc.required ? ' (Required)' : ' (Optional)'}</p>
              </div>
            </div>
            <div className="text-right">
              {doc.uploaded && doc.verified && <span className="text-xs text-green-600 font-medium">Verified</span>}
              {doc.uploaded && !doc.verified && <span className="text-xs text-blue-600 font-medium">Uploaded</span>}
              {!doc.uploaded && doc.required && <span className="text-xs text-red-600 font-medium">Missing</span>}
              {!doc.uploaded && !doc.required && <span className="text-xs text-gray-400">Not uploaded</span>}
              {doc.uploaded_at && <p className="text-xs text-gray-400 mt-0.5">{new Date(doc.uploaded_at).toLocaleDateString()}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
