import React, { useEffect, useRef, useState } from 'react';

import {
  TrendingUp,
  DollarSign,
  Calendar,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  Download,
  Search,
  Filter
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import PaymentDetailsModal from './PaymentDetailsModal';

interface LoanApplication {
  id: string;
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
  status: 'ontrack' | 'overdue' | 'paid' | 'default';
  paymentsCompleted: number;
  totalPayments: number;
  mobileNumber: string;
  introducedBy: string;
}

const PaymentTracker: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(null);

  const applyFilterAndScroll = (status: 'ontrack' | 'overdue' | 'paid') => {
    setFilterStatus(status);
    // Wait for React state to apply filter and render, then scroll
    setTimeout(() => {
      tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  useEffect(() => {
    const fetchLoans = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('loans')
          .select('*')
          .eq('status', 'Loan Disbursed')
          .order('disbursed_at', { ascending: false });
        if (error) throw error;
        const loanRows = data || [];
        // try to fetch latest disbursement_date for these loans to drive schedule
        let byId: Record<string, string> = {};
        if (loanRows.length > 0) {
          const ids = loanRows.map((l: any) => l.id);
          const { data: disb, error: dErr } = await supabase
            .from('loan_disbursements')
            .select('loan_id, disbursement_date')
            .in('loan_id', ids);
          if (!dErr && disb) {
            // keep latest per loan
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
        // Fetch EMI statuses for status calculation
        let emiStatuses: Record<string, string[]> = {};
        if (loanRows.length > 0) {
          const ids = loanRows.map((l: any) => l.id);
          const { data: emi, error: eErr } = await supabase
            .from('emi_statuses')
            .select('loan_id, installment_index, status')
            .in('loan_id', ids);
          if (!eErr && emi) {
            const map: Record<string, string[]> = {};
            for (const row of emi as any[]) {
              if (!map[row.loan_id]) map[row.loan_id] = [];
              map[row.loan_id][row.installment_index] = row.status;
            }
            emiStatuses = map;
          }
        }
        const rows = loanRows.map((l: any) => {
          const fullName = `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim();
          const loanAmount = Number(l.amount_disbursed ?? l.loan_amount ?? 0);
          const tenure = Number(l.tenure ?? 0);
          const emiAmount = tenure > 0 ? Math.round((loanAmount) / tenure) : 0;
          const totalPayable = Number(l.total_payable ?? loanAmount); 
          const paidAmount = Number(l.paid_amount ?? 0);
          const remainingAmount = Math.max(totalPayable - paidAmount, 0);

          // Determine loan status based on EMI statuses
          const statuses = emiStatuses[l.id] || [];
          const paidEmiCount = statuses.filter(s => s === 'Paid' || s === 'ECS Success').length;
          const hasBounce = statuses.some(s => s === 'ECS Bounce');
          const hasMissed = statuses.some(s => s === 'Due Missed');
          let status: LoanApplication['status'] = 'ontrack';
          if (paidEmiCount === tenure) {
            status = 'paid';
          } else if (hasBounce || hasMissed) {
            status = 'overdue';
          } else if (paidEmiCount > 0) {
            status = 'ontrack';
          }

          return {
            id: l.id,
            fullName,
            loanAmount,
            tenure,
            interestScheme: String(l.interest_scheme ?? ''),
            disbursedDate: byId[l.id] ?? l.disbursement_date ?? l.disbursed_at ?? l.created_at,
            emiAmount,
            totalPayable,
            paidAmount,
            remainingAmount,
            nextDueDate: '-',
            status,
            paymentsCompleted: paidEmiCount,
            totalPayments: tenure,
            mobileNumber: l.mobile_primary ?? '-',
            introducedBy: l.introduced_by ?? '-',
          } as LoanApplication;
        });
        setLoans(rows);
      } catch (e: any) {
        setError(e.message || 'Failed to load loans');
      } finally {
        setLoading(false);
      }
    };
    fetchLoans();
    const ch = supabase
      .channel('payments-tracker')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => fetchLoans())
      .subscribe();
    const ch2 = supabase
      .channel('payments-tracker-payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchLoans())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(ch2);
    };
  }, []);

  const totalDisbursed = loans.reduce((sum, loan) => sum + loan.loanAmount, 0);
  const totalCollected = loans.reduce((sum, loan) => sum + loan.paidAmount, 0);
  const totalOutstanding = loans.reduce((sum, loan) => sum + loan.remainingAmount, 0);
  const activeLoans = loans.filter(loan => loan.status !== 'paid').length;
  const overdueLoans = loans.filter(loan => loan.status === 'overdue').length;
  const collectionRate = ((totalCollected / (totalDisbursed + (totalDisbursed * 0.05))) * 100).toFixed(1);

  const filteredLoans = loans.filter(loan => {
    const matchesSearch = loan.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         loan.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || loan.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'current': return 'bg-green-100 text-green-800 border-green-200';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
      case 'paid': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'default': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'current': return <CheckCircle className="w-4 h-4" />;
      case 'overdue': return <AlertCircle className="w-4 h-4" />;
      case 'paid': return <CheckCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const content = (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Payment Tracker</h1>
          <p className="text-slate-600 dark:text-gray-300">Monitor loan repayments and collection status</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-600 dark:text-gray-300 font-medium">Total Disbursed</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">₹{totalDisbursed.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded-full">
                {collectionRate}%
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-600 dark:text-gray-300 font-medium">Total Collected</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">₹{totalCollected.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-orange-100 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                {overdueLoans}
              </span>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-600 dark:text-gray-300 font-medium">Outstanding Amount</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">₹{totalOutstanding.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-600 dark:text-gray-300 font-medium">Active Loans</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{activeLoans}</p>
              <p className="text-xs text-slate-500 dark:text-gray-400">out of {loans.length} total</p>
            </div>
          </div>
        </div>

        {/* Visualization - Collection Progress Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Collection Overview</h2>
          <div className="space-y-6">
            {/* Overall Progress */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-600 dark:text-gray-300">Overall Collection Rate</span>
                <span className="text-sm font-bold text-green-600">{collectionRate}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${collectionRate}%` }}
                />
              </div>
            </div>

            {/* Status Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div
                className="border border-slate-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700/40 transition-colors"
                onClick={() => applyFilterAndScroll('ontrack')}
                role="button"
                aria-label="Filter On Track and scroll to table"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="font-semibold text-slate-700 dark:text-gray-200">On Track</span>
                </div>
                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                  {loans.filter(l => l.status === 'ontrack').length}
                </p>
                <p className="text-sm text-slate-600 dark:text-gray-300 mt-1">Loans on track</p>
              </div>

              <div
                className="border border-slate-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700/40 transition-colors"
                onClick={() => applyFilterAndScroll('ontrack')}
                role="button"
                aria-label="Filter On Track and scroll to table"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-red-100 p-2 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <span className="font-semibold text-slate-700 dark:text-gray-200">Overdue</span>
                </div>
                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                  {overdueLoans}
                </p>
                <p className="text-sm text-slate-600 dark:text-gray-300 mt-1">Needs attention</p>
              </div>

              <div
                className="border border-slate-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700/40 transition-colors"
                onClick={() => applyFilterAndScroll('paid')}
                role="button"
                aria-label="Filter Completed and scroll to table"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="font-semibold text-slate-700 dark:text-gray-200">Completed</span>
                </div>
                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                  {loans.filter(l => l.status === 'paid').length}
                </p>
                <p className="text-sm text-slate-600 dark:text-gray-300 mt-1">Fully repaid</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or loan ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex gap-3">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="pl-10 pr-8 py-3 border border-slate-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="ontrack">On Track</option>
                  <option value="overdue">Overdue</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium">
                <Download className="w-5 h-5" />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Loans Table */}
        <div ref={tableRef} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-gray-700 border-b border-slate-200 dark:border-gray-700">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Name</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Loan ID</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Loan Amount</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Tenure</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Paid EMI</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Remaining</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Progress</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
                {filteredLoans.map((loan) => {
                  const paidEmi = loan.paymentsCompleted;
                  const remainingEmi = Math.max(loan.totalPayments - paidEmi, 0);
                  const progress = loan.totalPayments > 0 ? (paidEmi / loan.totalPayments) * 100 : 0;
                  return (
                    <tr key={loan.id} className="hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-medium text-slate-800 dark:text-white">{loan.fullName}</p>
                          <p className="text-sm text-slate-500 dark:text-gray-300">{loan.mobileNumber}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-semibold text-slate-800 dark:text-white">{loan.id}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-semibold text-slate-800 dark:text-white">₹{loan.loanAmount.toLocaleString('en-IN')}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-slate-700 dark:text-gray-200">{loan.tenure} months</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-medium text-slate-800 dark:text-white">{paidEmi}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-medium text-slate-800 dark:text-white">{remainingEmi}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${getStatusColor(loan.status)}`}>
                          {getStatusIcon(loan.status)}
                          {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="w-32">
                          <div className="w-full bg-slate-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                loan.status === 'paid' ? 'bg-green-500' :
                                loan.status === 'overdue' ? 'bg-yellow-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <button
                          className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
                          onClick={() => setSelectedLoan(loan)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredLoans.length === 0 && (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-gray-300 font-medium">No loans found</p>
              <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          )}
        </div>

        {/* Summary Footer */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600 dark:text-gray-300">
              Showing <span className="font-semibold text-slate-800 dark:text-white">{filteredLoans.length}</span> of <span className="font-semibold text-slate-800 dark:text-white">{loans.length}</span> loans
            </div>
            <div className="text-sm text-slate-500 dark:text-gray-400">
              Last updated: {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {content}
      {selectedLoan && (
        <PaymentDetailsModal
          loan={{
            id: selectedLoan.id,
            fullName: selectedLoan.fullName,
            loanAmount: selectedLoan.loanAmount,
            tenure: selectedLoan.tenure,
            emiAmount: selectedLoan.emiAmount,
            disbursedDate: selectedLoan.disbursedDate
          }}
          onClose={() => setSelectedLoan(null)}
        />
      )}
    </>
  );
};

export default PaymentTracker;