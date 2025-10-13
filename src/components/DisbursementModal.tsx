import { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { LoanApplication, supabase } from '../lib/supabase';

interface DisbursementModalProps {
  loan: LoanApplication;
  onClose: () => void;
  onConfirm: (data: DisbursementData) => void;
}

export interface DisbursementData {
  disbursement_date: string;
  amount_disbursed: number;
  transaction_reference: string;
  disbursement_proof_url: string;
  disbursement_remarks: string;
}

export default function DisbursementModal({ loan, onClose, onConfirm }: DisbursementModalProps) {
  const [formData, setFormData] = useState({
    disbursement_date: '',
    amount_disbursed: loan.loan_amount.toString(),
    transaction_reference: '',
    disbursement_remarks: '',
  });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.disbursement_date) {
      newErrors.disbursement_date = 'Disbursement date is required';
    }

    if (!formData.amount_disbursed || Number(formData.amount_disbursed) <= 0) {
      newErrors.amount_disbursed = 'Valid amount is required';
    }

    if (!formData.transaction_reference.trim()) {
      newErrors.transaction_reference = 'Transaction reference is required';
    }

    if (!proofFile) {
      newErrors.proof = 'Disbursement proof is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setUploading(true);
    try {
      let proofUrl = '';

      if (proofFile) {
        const folder = `${loan.first_name}_${loan.last_name}/loan_${loan.id}`;
        const filePath = `${folder}/disbursement_proof_${proofFile.name}`;

        const { error: uploadError } = await supabase.storage
          .from('loan_documents')
          .upload(filePath, proofFile, {
            upsert: true,
            contentType: proofFile.type,
            cacheControl: '3600'
          });

        if (uploadError) throw uploadError;
        proofUrl = filePath;
      }

      const disbursementData: DisbursementData = {
        disbursement_date: formData.disbursement_date,
        amount_disbursed: Number(formData.amount_disbursed),
        transaction_reference: formData.transaction_reference,
        disbursement_proof_url: proofUrl,
        disbursement_remarks: formData.disbursement_remarks,
      };

      onConfirm(disbursementData);
    } catch (error) {
      console.error('Error uploading proof:', error);
      alert('Failed to upload disbursement proof. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setProofFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setProofFile(file);
    setErrors(prev => ({ ...prev, proof: '' }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Loan Disbursement</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
            <p className="text-sm text-blue-900 dark:text-blue-300">
              <span className="font-semibold">Applicant:</span> {loan.first_name} {loan.last_name}
              <br />
              <span className="font-semibold">Approved Amount:</span> ₹{loan.loan_amount.toLocaleString('en-IN')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Disbursement Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.disbursement_date}
              onChange={(e) => setFormData({ ...formData, disbursement_date: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            {errors.disbursement_date && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.disbursement_date}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Amount Disbursed <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.amount_disbursed}
              onChange={(e) => setFormData({ ...formData, amount_disbursed: e.target.value })}
              placeholder="Enter amount"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            {errors.amount_disbursed && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.amount_disbursed}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Transaction ID / Reference Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.transaction_reference}
              onChange={(e) => setFormData({ ...formData, transaction_reference: e.target.value })}
              placeholder="Enter transaction reference"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            {errors.transaction_reference && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.transaction_reference}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Upload Proof <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                id="proof-upload"
              />
              <label
                htmlFor="proof-upload"
                className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
              >
                <Upload className="w-5 h-5 mr-2 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {proofFile ? proofFile.name : 'Choose file (PDF, JPG, PNG - Max 5MB)'}
                </span>
              </label>
            </div>
            {errors.proof && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.proof}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Remarks
            </label>
            <textarea
              value={formData.disbursement_remarks}
              onChange={(e) => setFormData({ ...formData, disbursement_remarks: e.target.value })}
              placeholder="Enter any additional remarks"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploading}
            className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {uploading ? 'Processing...' : 'Confirm Disbursement'}
          </button>
        </div>
      </div>
    </div>
  );
}
