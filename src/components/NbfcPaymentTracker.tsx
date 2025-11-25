import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  Download,
  Search,
  Filter,
  Building2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import PaymentDetailsModal, { TrackerLoan } from './PaymentDetailsModal';

interface LoanApplication {
  id: string;
  applicationNumber: string;
  createdAt: string;
  fullName: string;
  loanAmount: number;
  tenure: number;
  interestScheme: string;
  disbursedDate: string;
  emiAmount: number;
  totalPayable: number;
  paidAmount: number;
  remainingAmount: number;
  nextDueDate: string;
  status: 'ontrack' | 'overdue' | 'paid' | 'bounce' | 'ecs_success';
  paymentsCompleted: number;
  totalPayments: number;
  mobileNumber: string;
  introducedBy: string;
  productImageUrl?: string | null;
  productName?: string | null;
  productDeliveredDate?: string | null;
  productDeliveryStatus?: string | null;
  merchantName?: string;
  merchantId?: string;
}

const formatLoanId = (id: string) => `LOAN-${String(id).slice(0, 8)}`;

const NbfcPaymentTracker: React.FC = () => {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const tableRef = useRef<HTMLDivElement | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState<null | 'pdf' | 'excel'>(null);
  const [tiedMerchantIds, setTiedMerchantIds] = useState<string[]>([]);

  // Fetch tied merchants first, then fetch their loans
  useEffect(() => {
    if (profile?.role === 'nbfc_admin' && profile?.id) {
      fetchTiedMerchants();
    }
  }, [profile?.id, profile?.role]);

  const fetchTiedMerchants = async () => {
    if (!profile?.id) return;

    try {
      const { data: tieups, error: tieupErr } = await supabase
        .from('nbfc_tieup_requests')
        .select('merchant_id')
        .eq('nbfc_id', profile.id)
        .eq('status', 'approved');

      if (tieupErr) throw tieupErr;

      const merchantIds = (tieups || []).map((t: any) => t.merchant_id);
      setTiedMerchantIds(merchantIds);

      if (merchantIds.length > 0) {
        fetchLoans(merchantIds);
      } else {
        setLoans([]);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching tied merchants:', err);
      setError('Failed to load tied merchants');
      setLoading(false);
    }
  };

  const fetchLoans = async (merchantIds: string[]) => {
    setLoading(true);
    setError(null);
    try {
      if (merchantIds.length === 0) {
        setLoans([]);
        return;
      }

      // Fetch product_loans for tied merchants
      const { data, error } = await supabase
        .from('product_loans')
        .select('*')
        .in('merchant_id', merchantIds)
        .in('status', ['Verified', 'Accepted', 'Loan Disbursed', 'Delivered'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const loanRows = data || [];

      // Fetch disbursement dates
      let byId: Record<string, string> = {};
      if (loanRows.length > 0) {
        const ids = loanRows.map((l: any) => l.id);
        const { data: disb, error: dErr } = await supabase
          .from('loan_disbursements')
          .select('loan_id, disbursement_date')
          .in('loan_id', ids);

        if (!dErr && disb) {
          const map: Record<string, string> = {};
          for (const row of disb as any[]) {
            const prev = map[row.loan_id];
            const cur = row.disbursement_date;
            if (!prev || new Date(cur).getTime() > new Date(prev).getTime()) {
              map[row.loan_id] = cur;
            }
          }
          byId = map;
        }
      }

      // Fetch EMI statuses - prioritize product_emi_statuses
      let emiStatuses: Record<string, string[]> = {};
      if (loanRows.length > 0) {
        const ids = loanRows.map((l: any) => l.id);
        
        // Try product_emi_statuses first
        const { data: emi, error: eErr } = await supabase
          .from('product_emi_statuses')
          .select('product_loan_id, installment_index, status')
          .in('product_loan_id', ids);

        if (!eErr && emi && emi.length > 0) {
          const map: Record<string, string[]> = {};
          for (const row of emi as any[]) {
            if (!map[row.product_loan_id]) map[row.product_loan_id] = [];
            map[row.product_loan_id][row.installment_index] = row.status;
          }
          emiStatuses = map;
        } else {
          // Fallback to legacy emi_statuses
          const { data: emiOld, error: eErrOld } = await supabase
            .from('emi_statuses')
            .select('loan_id, installment_index, status')
            .in('loan_id', ids);

          if (!eErrOld && emiOld && emiOld.length > 0) {
            const map: Record<string, string[]> = {};
            for (const row of emiOld as any[]) {
              if (!map[row.loan_id]) map[row.loan_id] = [];
              map[row.loan_id][row.installment_index] = row.status;
            }
            emiStatuses = map;
          }
        }
      }

      // Fetch merchant details for each loan
      const merchantMap = new Map<string, any>();
      for (const mid of merchantIds) {
        const { data: profile } = await supabase
          .from('merchant_profiles')
          .select('merchant_id, owner_name')
          .eq('merchant_id', mid)
          .maybeSingle();
        
        const { data: user } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('id', mid)
          .maybeSingle();

        if (profile || user) {
          merchantMap.set(mid, {
            name: profile?.owner_name || user?.username || 'Unknown',
            id: mid
          });
        }
      }

      // Transform data
      const applications: LoanApplication[] = loanRows.map((loan: any) => {
        const statuses = emiStatuses[loan.id] || [];
        const paidCount = statuses.filter(
          (s: string) => s === 'Paid' || s === 'ECS Success'
        ).length;

        const merchant = merchantMap.get(loan.merchant_id);

        return {
          id: loan.id,
          applicationNumber: loan.application_number || formatLoanId(loan.id),
          createdAt: loan.created_at,
          fullName: loan.customer_name || '',
          loanAmount: loan.loan_amount || 0,
          tenure: loan.tenure || 0,
          interestScheme: loan.interest_rate_percent || 0,
          disbursedDate: byId[loan.id] || loan.disbursement_date || '',
          emiAmount: loan.emi_amount || 0,
          totalPayable: loan.total_payable || loan.loan_amount || 0,
          paidAmount: loan.paid_amount || 0,
          remainingAmount: (loan.total_payable || loan.loan_amount) - (loan.paid_amount || 0),
          nextDueDate: loan.next_emi_due_date || '',
          status: (loan.status || 'ontrack').toLowerCase() as any,
          paymentsCompleted: paidCount,
          totalPayments: loan.tenure || 0,
          mobileNumber: loan.customer_phone || '',
          introducedBy: loan.referred_by || '',
          productImageUrl: loan.product_image_url,
          productName: loan.product_name,
          productDeliveredDate: loan.delivered_date,
          productDeliveryStatus: loan.delivery_status,
          merchantName: merchant?.name || 'Unknown',
          merchantId: loan.merchant_id,
        };
      });

      setLoans(applications);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching loans:', err);
      setError('Failed to load loans');
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to real-time updates
  useEffect(() => {
    if (tiedMerchantIds.length === 0) return;

    const channel = supabase.channel('nbfc-payment-tracker');

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_loans' }, () => {
        fetchLoans(tiedMerchantIds);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        fetchLoans(tiedMerchantIds);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emi_statuses' }, () => {
        fetchLoans(tiedMerchantIds);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_emi_statuses' }, () => {
        fetchLoans(tiedMerchantIds);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tiedMerchantIds]);

  const filtered = loans.filter((loan) => {
    const statusMatch = filterStatus === 'all' || loan.status === filterStatus;
    const searchMatch =
      searchTerm === '' ||
      loan.applicationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.mobileNumber.includes(searchTerm) ||
      (loan.merchantName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    return statusMatch && searchMatch;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'overdue':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'ontrack':
        return <Clock className="w-5 h-5 text-blue-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading loans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Payment Tracker
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Track EMI payments for loans from your tied-up merchants
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400 text-sm">Total Loans</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{loans.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400 text-sm">On Track</p>
            <p className="text-2xl font-bold text-blue-600">
              {loans.filter((l) => l.status === 'ontrack').length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400 text-sm">Overdue</p>
            <p className="text-2xl font-bold text-red-600">
              {loans.filter((l) => l.status === 'overdue').length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400 text-sm">Paid</p>
            <p className="text-2xl font-bold text-green-600">
              {loans.filter((l) => l.status === 'paid').length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by loan ID, customer name, or merchant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="ontrack">On Track</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
            <option value="bounce">Bounce</option>
            <option value="ecs_success">ECS Success</option>
          </select>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Loans Table */}
        <div ref={tableRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <AlertCircle className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {loans.length === 0 ? 'No loans found' : 'No loans match your search'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Loan ID
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Merchant
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Loan Amount
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      EMI Paid/Total
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Remaining
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Status
                    </th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filtered.map((loan) => (
                    <tr key={loan.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {loan.applicationNumber}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(loan.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {loan.fullName}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {loan.mobileNumber}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-900 dark:text-white font-medium">
                          {loan.merchantName}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-900 dark:text-white font-semibold">
                          ₹{loan.loanAmount.toLocaleString('en-IN')}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-gray-900 dark:text-white font-medium">
                            {loan.paymentsCompleted}/{loan.totalPayments}
                          </p>
                          <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-green-600"
                              style={{
                                width: `${(loan.paymentsCompleted / loan.totalPayments) * 100}%`
                              }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-900 dark:text-white font-semibold">
                          ₹{loan.remainingAmount.toLocaleString('en-IN')}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(loan.status)}
                          <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                            {loan.status.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setSelectedLoan(loan as TrackerLoan)}
                          className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Payment Details Modal */}
      {selectedLoan && (
        <PaymentDetailsModal
          loan={selectedLoan}
          onClose={() => {
            setSelectedLoan(null);
            setTimeout(() => {
              fetchLoans(tiedMerchantIds);
            }, 500);
          }}
          onUpdated={() => {
            setSelectedLoan(null);
            setTimeout(() => {
              fetchLoans(tiedMerchantIds);
            }, 500);
          }}
          readOnly={false}
        />
      )}
    </div>
  );
};

export default NbfcPaymentTracker;
