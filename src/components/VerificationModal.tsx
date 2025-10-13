import { X } from 'lucide-react';
import { LoanApplication } from '../lib/supabase';

interface VerificationModalProps {
  loan: LoanApplication;
  onClose: () => void;
  onVerify: () => void;
}

export default function VerificationModal({ loan, onClose, onVerify }: VerificationModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Verify Loan Application</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-3">Loan Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600 dark:text-gray-400">Full Name</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {loan.first_name} {loan.last_name}
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">Interested Scheme</p>
                <p className="font-semibold text-gray-900 dark:text-white">{loan.interest_scheme}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">Loan Amount</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  ₹{loan.loan_amount.toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">Tenure</p>
                <p className="font-semibold text-gray-900 dark:text-white">{loan.tenure} months</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">PAN Number</p>
                <p className="font-semibold text-gray-900 dark:text-white">{loan.pan_number}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">Aadhaar Number</p>
                <p className="font-semibold text-gray-900 dark:text-white">{loan.aadhaar_number}</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              Please verify all the details carefully before confirming verification.
              This action will mark the loan as verified and enable disbursement.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onVerify}
            className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Verify
          </button>
        </div>
      </div>
    </div>
  );
}
