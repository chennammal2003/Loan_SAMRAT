import { useState, useEffect } from 'react';
import { CheckCircle, Circle, Clock, AlertCircle, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ProductLoan {
  id: string;
  first_name: string;
  last_name: string;
  product_name: string;
  loan_amount: number;
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Verified' | 'Loan Disbursed' | 'Product Delivered';
  created_at: string;
  updated_at: string;
}

interface StatusStep {
  key: string;
  label: string;
  status: 'Accepted' | 'Verified' | 'Loan Disbursed' | 'Product Delivered';
}

interface StatusHistory {
  id: string;
  loan_id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  notes: string | null;
}

const statusSteps: StatusStep[] = [
  { key: 'accepted', label: 'Accepted', status: 'Accepted' },
  { key: 'verified', label: 'Verified', status: 'Verified' },
  { key: 'disbursed', label: 'Loan Disbursed', status: 'Loan Disbursed' },
  { key: 'delivered', label: 'Product Delivered', status: 'Product Delivered' },
];

export default function ProductLoanStatusTracker({ loan }: { loan: ProductLoan }) {
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState(false);

  const getStatusDate = (status: string): string | null => {
    // Find the most recent occurrence of this status in history
    const historyEntry = statusHistory.find(h => h.new_status === status);
    return historyEntry ? historyEntry.changed_at : null;
  };

  const getStepStatus = (stepIndex: number): 'completed' | 'current' | 'pending' => {
    if (loan.status === 'Rejected') return 'pending';
    const statusOrder = ['Pending', 'Accepted', 'Verified', 'Loan Disbursed', 'Product Delivered'];
    const currentIndex = statusOrder.indexOf(loan.status);
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex - 1) return 'current';
    return 'pending';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Fetch status history from database
  useEffect(() => {
    const fetchStatusHistory = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch status history for this loan - ordered by changed_at ascending to show timeline
        const { data: history, error: historyError } = await supabase
          .from('status_history')
          .select('*')
          .eq('loan_id', loan.id)
          .order('changed_at', { ascending: true });

        if (historyError) {
          console.error('Status History Error:', historyError);
          setError('Failed to load status history');
        } else {
          setStatusHistory(history || []);
        }
      } catch (err) {
        console.error('Error fetching status history:', err);
        setError(err instanceof Error ? err.message : 'Failed to load tracking data');
      } finally {
        setLoading(false);
      }
    };

    fetchStatusHistory();

    // Subscribe to real-time updates on status_history table
    const statusChannel = supabase
      .channel(`status-${loan.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'status_history', filter: `loan_id=eq.${loan.id}` },
        () => fetchStatusHistory()
      )
      .subscribe();

    // Also listen to product_loans table for direct status changes
    const loansChannel = supabase
      .channel(`loan-status-${loan.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'product_loans', filter: `id=eq.${loan.id}` },
        () => fetchStatusHistory()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(statusChannel);
      supabase.removeChannel(loansChannel);
    };
  }, [loan.id]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {loan.first_name} {loan.last_name}
        </h3>
        <p className="text-sm text-gray-600">{loan.product_name}</p>
        <p className="text-sm font-medium text-gray-900 mt-1">
          ₹{loan.loan_amount.toLocaleString('en-IN')}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Current Status: <span className="font-semibold text-gray-900">{loan.status}</span>
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div>
              <p className="text-yellow-800 font-medium text-sm">Status tracking info</p>
              <p className="text-yellow-700 text-xs mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Rejected Status */}
      {loan.status === 'Rejected' ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Application Rejected</p>
          <p className="text-red-600 text-sm mt-1">
            This loan application has been rejected and cannot proceed further.
          </p>
        </div>
      ) : (
        <>
          {/* Status Timeline */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-900 mb-4">📊 Loan Status Timeline</h4>
            <div className="relative">
              {statusSteps.map((step, index) => {
                const status = getStepStatus(index);
                const stepDate = getStatusDate(step.status);

                return (
                  <div key={step.key} className="relative pb-8 last:pb-0">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 relative">
                        {status === 'completed' ? (
                          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-white" />
                          </div>
                        ) : status === 'current' ? (
                          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
                            <Clock className="w-6 h-6 text-white" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <Circle className="w-6 h-6 text-gray-400" />
                          </div>
                        )}

                        {index < statusSteps.length - 1 && (
                          <div
                            className={`absolute left-5 top-10 w-0.5 h-full -ml-px ${
                              status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                            }`}
                          />
                        )}
                      </div>

                      <div className="ml-4 flex-grow">
                        <div className="flex items-center justify-between">
                          <h4
                            className={`text-sm font-medium ${
                              status === 'completed'
                                ? 'text-green-700'
                                : status === 'current'
                                ? 'text-blue-700'
                                : 'text-gray-500'
                            }`}
                          >
                            {step.label}
                          </h4>
                          {stepDate && (
                            <span className="text-xs text-gray-500">
                              {formatDate(stepDate)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {status === 'completed' && 'Completed'}
                          {status === 'current' && 'In Progress'}
                          {status === 'pending' && 'Pending'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status History Timeline */}
          {!loading && statusHistory.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => setExpandedHistory(!expandedHistory)}
                className="flex items-center justify-between w-full p-3 hover:bg-gray-50 rounded-lg transition"
              >
                <h4 className="text-sm font-semibold text-gray-900">📋 Status History ({statusHistory.length})</h4>
                <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${expandedHistory ? 'rotate-180' : ''}`} />
              </button>

              {expandedHistory && (
                <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                  {statusHistory.map((history) => (
                    <div key={history.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          {history.old_status ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs font-medium">
                                {history.old_status}
                              </span>
                              <span className="text-gray-600 text-xs">→</span>
                              <span className="px-2 py-1 bg-blue-300 text-blue-700 rounded text-xs font-medium">
                                {history.new_status}
                              </span>
                            </div>
                          ) : (
                            <span className="px-2 py-1 bg-blue-300 text-blue-700 rounded text-xs font-medium">
                              Started as: {history.new_status}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-600">
                          {formatDate(history.changed_at)}
                        </p>
                      </div>
                      {history.notes && (
                        <p className="text-xs text-gray-700 bg-blue-50 p-2 rounded mt-2">
                          📝 {history.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
