import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useLocation } from 'react-router-dom';
import DocsModal from '../DocsModal';

interface ProductLoan {
  id: string;
  product_name: string;
  product_image_url: string;
  product_price: number;
  loan_amount: number;
  tenure: number;
  status: string;
  created_at: string;
}

interface FullProductLoan extends ProductLoan {
  first_name?: string;
  last_name?: string;
  email_id?: string;
  mobile_primary?: string;
  address?: string;
  processing_fee?: number;
  product_category?: string;
}

export default function CustomerProductLoans() {
  const { user } = useAuth();
  const location = useLocation();
  const [loans, setLoans] = useState<ProductLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<FullProductLoan | null>(null);
  const [docsFor, setDocsFor] = useState<FullProductLoan | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const justApplied = (location.state as any)?.justApplied === true;

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('product_loans')
          .select('id, product_name, product_image_url, product_price, loan_amount, tenure, status, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setLoans((data || []) as ProductLoan[]);
      } catch (e) {
        console.error('Failed to load customer product loans', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const getStatusBadge = (status: string) => {
    if (status === 'Loan Disbursed' || status === 'Disbursed') {
      return { label: 'LOAN DISBURSED', cls: 'bg-green-100 text-green-800' };
    }
    if (status === 'Accepted' || status === 'Verified') {
      return { label: status.toUpperCase(), cls: 'bg-blue-100 text-blue-800' };
    }
    if (status === 'Rejected') {
      return { label: 'REJECTED', cls: 'bg-red-100 text-red-800' };
    }
    return { label: 'PENDING', cls: 'bg-amber-100 text-amber-800' };
  };

  const openLoanDetails = async (loanId: string) => {
    try {
      setDetailsLoading(true);
      const { data, error } = await supabase
        .from('product_loans')
        .select('id, product_name, product_image_url, product_price, loan_amount, tenure, status, created_at, first_name, last_name, email_id, mobile_primary, address, processing_fee, product_category')
        .eq('id', loanId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setSelectedLoan(data as FullProductLoan);
      }
    } catch (e) {
      console.error('Failed to load loan details', e);
      alert('Unable to load loan details. Please try again.');
    } finally {
      setDetailsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold mb-2">My Loans</h1>
      {justApplied && (
        <div className="mb-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          Your loan application has been submitted successfully. You can track its status below.
        </div>
      )}
      {loading ? (
        <div className="py-10 text-center text-gray-500">Loading your loans...</div>
      ) : loans.length === 0 ? (
        <div className="py-10 text-center text-gray-500">No loans found yet. Apply for finance from the Store.</div>
      ) : (
        <div className="space-y-4">
          {loans.map((loan) => {
            const badge = getStatusBadge(loan.status);
            return (
              <div
                key={loan.id}
                className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white shadow-sm p-4"
              >
                <img
                  src={loan.product_image_url || '/placeholder-product.png'}
                  alt={loan.product_name}
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder-product.png';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <button
                      type="button"
                      className="font-semibold text-blue-600 hover:underline truncate text-left"
                      title="View loan details"
                      onClick={() => openLoanDetails(loan.id)}
                    >
                      {loan.product_name}
                    </button>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-purple-700 mb-1">Product Purchase</p>
                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                    <div>
                      <p className="text-gray-500">Amount</p>
                      <p className="font-semibold text-gray-900">
                        ₹{loan.loan_amount.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Tenure</p>
                      <p className="font-semibold text-gray-900">{loan.tenure} months</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Applied</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(loan.created_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedLoan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-gray-900">Loan Details</h2>
              <button
                onClick={() => setSelectedLoan(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4 text-sm text-gray-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Applicant</h3>
                  <p><span className="text-gray-500">Name: </span><span className="font-medium">{selectedLoan.first_name} {selectedLoan.last_name}</span></p>
                  <p><span className="text-gray-500">Email: </span><span className="font-medium">{selectedLoan.email_id}</span></p>
                  <p><span className="text-gray-500">Mobile: </span><span className="font-medium">{selectedLoan.mobile_primary}</span></p>
                  <p><span className="text-gray-500">Address: </span><span className="font-medium">{selectedLoan.address}</span></p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Loan</h3>
                  <p><span className="text-gray-500">Loan Amount: </span><span className="font-medium">₹{selectedLoan.loan_amount.toLocaleString('en-IN')}</span></p>
                  <p><span className="text-gray-500">Tenure: </span><span className="font-medium">{selectedLoan.tenure} months</span></p>
                  {typeof selectedLoan.processing_fee === 'number' && (
                    <p><span className="text-gray-500">Processing Fee: </span><span className="font-medium">₹{selectedLoan.processing_fee.toLocaleString('en-IN')}</span></p>
                  )}
                  <p><span className="text-gray-500">Status: </span><span className="font-medium">{selectedLoan.status}</span></p>
                  <p><span className="text-gray-500">Applied On: </span><span className="font-medium">{new Date(selectedLoan.created_at).toLocaleString('en-IN')}</span></p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Product</h3>
                  <p><span className="text-gray-500">Name: </span><span className="font-medium">{selectedLoan.product_name}</span></p>
                  <p><span className="text-gray-500">Price: </span><span className="font-medium">₹{selectedLoan.product_price.toLocaleString('en-IN')}</span></p>
                  {selectedLoan.product_category && (
                    <p><span className="text-gray-500">Category: </span><span className="font-medium">{selectedLoan.product_category}</span></p>
                  )}
                </div>
              </div>
              <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                <p className="text-xs text-gray-500">These are the details you submitted with your loan application.</p>
                <button
                  className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm"
                  onClick={() => setDocsFor(selectedLoan)}
                >
                  View Documents
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {docsFor && (
        <DocsModal
          loanId={docsFor.id}
          fullName={`${docsFor.first_name || ''} ${docsFor.last_name || ''}`.trim() || 'Loan Documents'}
          onClose={() => setDocsFor(null)}
          loanType="product"
        />
      )}
    </div>
  );
}
