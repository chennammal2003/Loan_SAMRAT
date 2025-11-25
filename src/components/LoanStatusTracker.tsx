import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, Circle, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
  status: string;
}

const STATUS_STEPS: StatusStep[] = [
  { key: 'accepted', label: 'Accepted', status: 'Accepted' },
  { key: 'verified', label: 'Verified', status: 'Verified' },
  { key: 'disbursed', label: 'Loan Disbursed', status: 'Loan Disbursed' },
  { key: 'delivered', label: 'Product Delivered', status: 'Product Delivered' },
];

export default function LoanStatusTracker({ loan, onClose }: { loan: ProductLoan; onClose?: () => void }) {
  const [currentLoan, setCurrentLoan] = useState<ProductLoan>(loan);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch latest loan data
  const fetchLoanData = async () => {
    try {
      if (refreshing) return;
      setRefreshing(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('product_loans')
        .select('*')
        .eq('id', loan.id)
        .single();

      if (fetchError) {
        console.error('Error fetching loan:', fetchError);
        setError('Failed to load loan data');
        return;
      }

      setCurrentLoan(data);
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchLoanData().finally(() => setLoading(false));

    // Subscribe to real-time updates on product_loans table
    const channel = supabase
      .channel(`product-loan-${loan.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'product_loans',
          filter: `id=eq.${loan.id}`,
        },
        () => fetchLoanData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loan.id]);

  const getStepStatus = (stepStatus: string): 'completed' | 'current' | 'pending' => {
    if (currentLoan.status === 'Rejected') return 'pending';

    const statusOrder = ['Pending', 'Accepted', 'Verified', 'Loan Disbursed', 'Product Delivered'];
    const currentIndex = statusOrder.indexOf(currentLoan.status);
    const stepIndex = statusOrder.indexOf(stepStatus);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const getStepDate = (stepStatus: string): string | null => {
    // For the current status, show when it was last updated
    if (currentLoan.status === stepStatus) {
      return currentLoan.updated_at;
    }
    // For completed steps, we don't have exact date without status_history table
    // So we just return that it's completed
    if (getStepStatus(stepStatus) === 'completed') {
      return currentLoan.updated_at;
    }
    return null;
  };

  return (
    <div className="w-full bg-white rounded-lg p-6 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {currentLoan.first_name} {currentLoan.last_name}
            </h2>
            <p className="text-gray-600 mt-1">{currentLoan.product_name}</p>
            <p className="text-lg font-semibold text-gray-900 mt-2">
              ₹{currentLoan.loan_amount.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchLoanData}
              disabled={refreshing}
              className="p-2 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-blue-600"></div>
        </div>
      )}

      {!loading && (
        <>
          {/* Rejected Status */}
          {currentLoan.status === 'Rejected' ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
              <p className="text-red-800 font-semibold text-lg">❌ Application Rejected</p>
              <p className="text-red-700 text-sm mt-2">
                This loan application has been rejected and cannot proceed further.
              </p>
            </div>
          ) : (
            <>
              {/* Status Timeline */}
              <div className="space-y-6">
                {STATUS_STEPS.map((step, index) => {
                  const status = getStepStatus(step.status);
                  const stepDate = getStepDate(step.status);

                  return (
                    <div key={step.key} className="flex gap-4">
                      {/* Timeline Connector */}
                      <div className="flex flex-col items-center">
                        {/* Circle Icon */}
                        <div
                          className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-white transition-all flex-shrink-0 ${
                            status === 'completed'
                              ? 'bg-green-500'
                              : status === 'current'
                              ? 'bg-blue-500 ring-4 ring-blue-200 animate-pulse'
                              : 'bg-gray-300'
                          }`}
                        >
                          {status === 'completed' ? (
                            <CheckCircle2 className="w-8 h-8" />
                          ) : status === 'current' ? (
                            <Clock className="w-8 h-8" />
                          ) : (
                            <Circle className="w-8 h-8" />
                          )}
                        </div>

                        {/* Vertical Line */}
                        {index < STATUS_STEPS.length - 1 && (
                          <div
                            className={`w-1 h-16 mt-2 ${
                              status === 'completed' ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                          />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-grow pt-2">
                        <h3
                          className={`text-lg font-bold ${
                            status === 'completed'
                              ? 'text-green-600'
                              : status === 'current'
                              ? 'text-blue-600'
                              : 'text-gray-500'
                          }`}
                        >
                          {step.label}
                        </h3>
                        <p
                          className={`text-sm ${
                            status === 'completed'
                              ? 'text-gray-600'
                              : status === 'current'
                              ? 'text-blue-600'
                              : 'text-gray-500'
                          }`}
                        >
                          {status === 'completed' && 'Completed'}
                          {status === 'current' && 'In Progress'}
                          {status === 'pending' && 'Pending'}
                        </p>
                        {stepDate && status !== 'pending' && (
                          <p className="text-sm text-gray-500 mt-1">
                            {formatDate(stepDate)}
                          </p>
                        )}
                      </div>

                      {/* Date on Right */}
                      {stepDate && status !== 'pending' && (
                        <div className="text-right pt-2">
                          <p className="text-sm text-gray-500 font-medium">
                            {formatDate(stepDate)}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Current Status Summary */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Current Status</p>
                  <p className="text-lg font-bold text-blue-600 mt-1">
                    {currentLoan.status}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Last Updated: {new Date(currentLoan.updated_at).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
