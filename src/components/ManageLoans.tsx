import React, { useEffect, useState } from 'react';
import { Eye, FileText } from 'lucide-react';
import { supabase, LoanApplication } from '../lib/supabase';
import LoanDetailsModal from './LoanDetailsModal';
import ConfirmActionModal from './ConfirmActionModal';

export default function ManageLoans() {
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ loan: LoanApplication; action: 'accept' | 'reject' } | null>(null);

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = async () => {
    try {
      const { data, error } = await supabase
        .from('loans')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLoans(data || []);
    } catch (error) {
      console.error('Error fetching loans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = (loan: LoanApplication) => {
    setConfirmAction({ loan, action: 'accept' });
  };

  const handleReject = (loan: LoanApplication) => {
    setConfirmAction({ loan, action: 'reject' });
  };

  const confirmAccept = async () => {
    if (!confirmAction) return;

    try {
      const { error } = await supabase
        .from('loans')
        .update({ status: 'Accepted' })
        .eq('id', confirmAction.loan.id);

      if (error) throw error;
      await fetchLoans();
      setSelectedLoan(null);
      setConfirmAction(null);
      alert('Loan accepted successfully!');
    } catch (error: any) {
      console.error('Error accepting loan:', error);
      alert(error.message || 'Failed to accept loan');
    }
  };

  const confirmReject = async () => {
    if (!confirmAction) return;

    try {
      const { error } = await supabase
        .from('loans')
        .update({ status: 'Rejected' })
        .eq('id', confirmAction.loan.id);

      if (error) throw error;
      await fetchLoans();
      setSelectedLoan(null);
      setConfirmAction(null);
      alert('Loan rejected successfully!');
    } catch (error: any) {
      console.error('Error rejecting loan:', error);
      alert(error.message || 'Failed to reject loan');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Accepted':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'Rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (loans.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Loan Applications</h3>
        <p className="text-gray-600 dark:text-gray-400">No loan applications have been submitted yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Address</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Loan Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Tenure</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Phone</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loans.map((loan) => (
                <tr key={loan.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {loan.first_name} {loan.last_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {loan.address.substring(0, 25)}...
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    ₹{loan.loan_amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {loan.tenure} months
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {loan.mobile_primary}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(loan.status)}`}>
                      {loan.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedLoan(loan)}
                      className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="text-sm">View</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLoan && (
        <LoanDetailsModal
          loan={selectedLoan}
          onClose={() => setSelectedLoan(null)}
          showActions={selectedLoan.status === 'Pending'}
          onAccept={() => handleAccept(selectedLoan)}
          onReject={() => handleReject(selectedLoan)}
        />
      )}

      {confirmAction && (
        <ConfirmActionModal
          action={confirmAction.action}
          loanId={confirmAction.loan.id}
          onConfirm={confirmAction.action === 'accept' ? confirmAccept : confirmReject}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
