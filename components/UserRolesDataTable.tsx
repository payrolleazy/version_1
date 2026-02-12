'use client';

import Button from '@/components/ui/Button';

interface UserRolesDataTableProps {
  roles: any[];
  onEdit: (role: any) => void;
  onToggleEnable: (role: any) => void;
  onSortChange: (column: string) => void;
  sortColumn: string | null;
  sortDirection: 'ASC' | 'DESC' | null;
}

export default function UserRolesDataTable({ roles, onEdit, onToggleEnable, onSortChange, sortColumn, sortDirection }: UserRolesDataTableProps) {
  if (!roles || roles.length === 0) {
    return <p>No user roles found.</p>;
  }

  const getSortIndicator = (column: string) => {
    if (sortColumn === column) {
      return sortDirection === 'ASC' ? ' ▲' : ' ▼';
    }
    return '';
  };

  return (
    <div className="overflow-x-auto rounded-md overflow-hidden border border-gray-200">
      <table className="min-w-full bg-white">
        <thead>
          <tr className="bg-gray-100">
            <th scope="col" className="py-2 px-4 border-b border-gray-200 cursor-pointer text-left" onClick={() => onSortChange('name')}>
              Name{getSortIndicator('name')}
            </th>
            <th scope="col" className="py-2 px-4 border-b border-gray-200 cursor-pointer text-left" onClick={() => onSortChange('email_users_roles')}>
              Email{getSortIndicator('email_users_roles')}
            </th>
            <th scope="col" className="py-2 px-4 border-b border-gray-200 cursor-pointer text-left" onClick={() => onSortChange('role')}>
              Role{getSortIndicator('role')}
            </th>
            <th scope="col" className="py-2 px-4 border-b border-gray-200 cursor-pointer text-left" onClick={() => onSortChange('enable_disable')}>
              Status{getSortIndicator('enable_disable')}
            </th>
            <th scope="col" className="py-2 px-4 border-b border-gray-200 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={`${role.id}-${role.userId}-${role.roleId}`} className="hover:bg-gray-50">
              <td className="py-3 px-4 border-b border-gray-200">{role.name}</td>
              <td className="py-3 px-4 border-b border-gray-200">{role.email_users_roles}</td>
              <td className="py-3 px-4 border-b border-gray-200">{role.role}</td>
              <td className="py-3 px-4 border-b border-gray-200">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${role.enable_disable === '1' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {role.enable_disable === '1' ? 'Enabled' : 'Disabled'}
                </span>
              </td>
              <td className="py-3 px-4 border-b border-gray-200 whitespace-nowrap">
                <div className="flex space-x-2">
                  <Button onClick={() => onEdit(role)} variant="outline" size="sm">
                    Edit
                  </Button>
                  <Button onClick={() => onToggleEnable(role)} variant={role.enable_disable === '1' ? 'ghost' : 'default'} size="sm">
                    {role.enable_disable === '1' ? 'Disable' : 'Enable'}
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
