import { UserProfile } from '../types';
import { Phone, Calendar, ToggleLeft, ToggleRight, Eye, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';

interface UserTableProps {
  users: UserProfile[];
  onViewDetails: (user: UserProfile) => void;
  onToggleStatus: (userId: string, currentStatus: boolean) => void;
}

export function UserTable({ users, onViewDetails, onToggleStatus }: UserTableProps) {
  const [statusModalUser, setStatusModalUser] = useState<UserProfile | null>(null);
  const [isApproving, setIsApproving] = useState(false);
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

  const handleApprove = async () => {
    if (!statusModalUser) return;
    setIsApproving(true);
    try {
      await onToggleStatus(statusModalUser.id, !!statusModalUser.is_active);
      setStatusModalUser(null);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = () => {
    setStatusModalUser(null);
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
                  {user.role === 'customer' ? (
                    // Customers always active - no toggle allowed
                    <div className="flex items-center">
                      <ToggleRight className="mr-2 h-6 w-6 text-green-500" />
                      <span className="font-medium text-green-700">Active</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        // Only show modal for merchants and admins that need approval
                        if ((user.role === 'merchant' || user.role === 'admin' || user.role === 'nbfc_admin')) {
                          setStatusModalUser(user);
                        }
                      }}
                      className="group flex items-center cursor-pointer hover:opacity-80 transition-opacity"
                    >      
                      {user.is_active ? (
                        <>
                          <ToggleRight className="mr-2 h-6 w-6 text-green-500 transition-transform group-hover:scale-110" />
                          <span className="font-medium text-green-700">
                            {user.role === 'merchant' || user.role === 'admin' || user.role === 'nbfc_admin'
                              ? 'Approved'
                              : 'Active'}
                          </span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="mr-2 h-6 w-6 text-gray-400 transition-transform group-hover:scale-110" />
                          <span className="font-medium text-gray-500">
                            {user.role === 'merchant' || user.role === 'admin' || user.role === 'nbfc_admin'
                              ? 'Pending Approval'
                              : 'Inactive'}
                          </span>
                        </>
                      )}
                    </button>
                  )}
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
                    className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 p-2 text-sm font-medium text-white shadow-sm transition-all hover:from-blue-600 hover:to-blue-700 hover:shadow-md"
                    aria-label="View details"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Approve/Reject Modal */}
      {statusModalUser && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => !isApproving && setStatusModalUser(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <h3 className="text-lg font-semibold text-center text-gray-900 dark:text-white mb-2">
              Approve {statusModalUser.full_name || statusModalUser.username}?
            </h3>
            
            <p className="text-sm text-gray-600 dark:text-gray-300 text-center mb-6">
              {statusModalUser.role === 'merchant' ? 'Merchant' : statusModalUser.role === 'nbfc_admin' || statusModalUser.role === 'admin' ? 'NBFC Admin' : 'User'} will be {statusModalUser.is_active ? 'deactivated' : 'approved'} and can access all features.
            </p>

            <div className="space-y-3">
              <button
                onClick={handleApprove}
                disabled={isApproving}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                {isApproving ? 'Processing...' : 'Approve'}
              </button>
              
              <button
                onClick={handleReject}
                disabled={isApproving}
                className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-400 text-gray-800 dark:text-gray-100 font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <XCircle className="w-5 h-5" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
