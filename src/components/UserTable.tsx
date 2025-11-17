import { UserProfile } from '../types';
import { Mail, Phone, Calendar, ToggleLeft, ToggleRight, Eye, Edit2 } from 'lucide-react';

interface UserTableProps {
  users: UserProfile[];
  onViewDetails: (user: UserProfile) => void;
  onToggleStatus: (userId: string, currentStatus: boolean) => void;
}

export function UserTable({ users, onViewDetails, onToggleStatus }: UserTableProps) {
  const getRoleBadge = (role: string) => {
    const styles = {
      nbfc_admin: 'bg-purple-100 text-purple-700 border-purple-200',
      merchant: 'bg-blue-100 text-blue-700 border-blue-200',
      customer: 'bg-green-100 text-green-700 border-green-200',
      user: 'bg-green-100 text-green-700 border-green-200',
      admin: 'bg-orange-100 text-orange-700 border-orange-200',
      super_admin: 'bg-red-100 text-red-700 border-red-200',
    };

    return (
      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${styles[role as keyof typeof styles] || 'bg-gray-100 text-gray-700'}`}>
        {role.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                User Details
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                Contact Info
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                Role
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                Joined Date
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((user) => (
              <tr key={user.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="h-12 w-12 flex-shrink-0">
                      {user.avatar_url ? (
                        <img
                          className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-200"
                          src={user.avatar_url}
                          alt={user.full_name || user.email}
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-lg font-bold text-white ring-2 ring-gray-200">
                          {(user.full_name || user.email)[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {user.full_name || user.username || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-300">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    {user.phone && (
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                        <Phone className="mr-2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                        {user.phone}
                      </div>
                    )}
                    {user.mobile && (
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                        <Phone className="mr-2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                        {user.mobile}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {getRoleBadge(user.role)}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => onToggleStatus(user.id, user.is_active)}
                    className="group flex items-center"
                  >
                    {user.is_active ? (
                      <>
                        <ToggleRight className="mr-2 h-6 w-6 text-green-500 transition-transform group-hover:scale-110" />
                        <span className="font-medium text-green-700">Active</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="mr-2 h-6 w-6 text-gray-400 transition-transform group-hover:scale-110" />
                        <span className="font-medium text-gray-500">Inactive</span>
                      </>
                    )}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                    <Calendar className="mr-2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                    {new Date(user.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => onViewDetails(user)}
                    className="inline-flex items-center rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:from-blue-600 hover:to-blue-700 hover:shadow-md"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
