import React from 'react';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface ConfirmActionModalProps {
  action: 'accept' | 'reject';
  loanId: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmActionModal({ action, loanId, onConfirm, onCancel }: ConfirmActionModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center space-x-4 mb-6">
          {action === 'accept' ? (
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          ) : (
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          )}
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {action === 'accept' ? 'Accept Loan' : 'Reject Loan'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ID: {loanId.substring(0, 8)}
            </p>
          </div>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              {action === 'accept'
                ? 'Are you sure you want to accept this loan application? The applicant will be notified.'
                : 'Are you sure you want to reject this loan application? This action cannot be undone.'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-4">
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-6 py-3 text-white rounded-lg transition-colors ${
              action === 'accept'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {action === 'accept' ? 'Accept' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}
