'use client';

import Button from '@/components/ui/Button';

interface ChangeRequest {
  id: number;
  target_table: string;
  target_record_id: string;
  change_type: string;
  status: string;
  created_at: string;
  proposed_data: any;
  review_remarks?: string;
}

interface ChangeRequestTableProps {
  requests: ChangeRequest[];
  onView: (request: ChangeRequest) => void;
  onApprove: (request: ChangeRequest) => void;
  onReject: (request: ChangeRequest) => void;
}

export default function ChangeRequestTable({ requests, onView, onApprove, onReject }: ChangeRequestTableProps) {
  if (!requests || requests.length === 0) {
    return <div className="p-4 text-center text-gray-500">No pending change requests found.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-gray-200 shadow-sm">
      <table className="min-w-full bg-white dark:bg-gray-800">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              ID
            </th>
            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Target
            </th>
            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Change Type
            </th>
            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Created At
            </th>
            <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Status
            </th>
            <th scope="col" className="py-3 px-4 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {requests.map((req) => (
            <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                #{req.id}
              </td>
              <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                {req.target_table} <span className="text-xs text-gray-400">({req.target_record_id})</span>
              </td>
              <td className="py-3 px-4 whitespace-nowrap text-sm">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                  ${req.change_type === 'UPDATE' ? 'bg-blue-100 text-blue-800' : 
                    req.change_type === 'INSERT' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {req.change_type}
                </span>
              </td>
              <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {new Date(req.created_at).toLocaleString()}
              </td>
              <td className="py-3 px-4 whitespace-nowrap text-sm">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                  {req.status}
                </span>
              </td>
              <td className="py-3 px-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex justify-end space-x-2">
                  <Button onClick={() => onView(req)} variant="outline" size="sm">
                    View
                  </Button>
                  <Button onClick={() => onApprove(req)} variant="default" size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                    Approve
                  </Button>
                  <Button onClick={() => onReject(req)} variant="destructive" size="sm">
                    Reject
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
