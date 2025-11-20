import { useState } from 'react';
import { X, Save } from 'lucide-react';
import { LoanApplication, supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface StatusChangeModalProps {
  loan: LoanApplication;
  onClose: () => void;
  onStatusChange: (loanId: string, newStatus: LoanApplication['status']) => void;
}

export default function StatusChangeModal({ loan, onClose, onStatusChange }: StatusChangeModalProps) {
  const { profile } = useAuth();
  const [selectedStatus, setSelectedStatus] = useState<LoanApplication['status']>(loan.status);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (selectedStatus === loan.status) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const updateData: any = {
        status: selectedStatus,
        updated_at: new Date().toISOString()
      };

      if (selectedStatus === 'Accepted' || selectedStatus === 'Verified') {
        updateData.verified_by = profile?.id;
        updateData.verified_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('loans')
        .update(updateData)
        .eq('id', loan.id);

      if (error) throw error;

      // If comment is provided, you might want to store it in a separate table
      // For now, we'll just update the status

      onStatusChange(loan.id, selectedStatus);
      onClose();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full animate-slide-up">
        <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Change Loan Status</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              Loan ID
            </label>
            <p className="text-sm text-slate-600 dark:text-gray-400 font-mono">
              {loan.id.substring(0, 8)}...
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              Applicant
            </label>
            <p className="text-sm text-slate-600 dark:text-gray-400">
              {loan.first_name} {loan.last_name}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              Current Status
            </label>
            <p className="text-sm text-slate-600 dark:text-gray-400">{loan.status}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              New Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as LoanApplication['status'])}
              className="w-full px-4 py-2 border border-slate-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="Pending">Pending</option>
              <option value="Verified">Verified</option>
              <option value="Accepted">Accepted</option>
              <option value="Rejected">Rejected</option>
              <option value="Loan Disbursed">Loan Disbursed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              Comment (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment about this status change..."
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-slate-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-gray-700 rounded-lg text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}






