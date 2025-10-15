import React, { useEffect, useRef, useState } from 'react';

import {
  CheckCircle,
  AlertCircle,
  Clock,
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
  status: 'ontrack' | 'overdue' | 'paid' | 'bounce' | 'ecs_success';
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
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const tableRef = useRef<HTMLDivElement | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(null);

  // Removed applyFilterAndScroll (no longer needed after UI simplification)

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
          // EMI at 36% p.a. => monthly 3%
          const r = 0.36 / 12;
          const pow = tenure > 0 ? Math.pow(1 + r, tenure) : 0;
          const emiAmount = tenure > 0 ? Math.round((loanAmount * r * pow) / (pow - 1)) : 0;

          // Remaining/collected computed after statuses & DB paid_amount are known

          // Determine loan status based on EMI statuses
          const statuses = emiStatuses[l.id] || [];
          const paidCount = statuses.filter(s => s === 'Paid').length;
          const ecsSuccessCount = statuses.filter(s => s === 'ECS Success').length;
          const bounceCount = statuses.filter(s => s === 'ECS Bounce').length;
          const overdueCount = statuses.filter(s => s === 'Due Missed').length;

          let status: LoanApplication['status'] = 'ontrack';

          // Check for bounce status first (highest priority)
          if (bounceCount > 0) {
            status = 'bounce';
          }
          // Check for overdue status (second highest priority)
          else if (overdueCount > 0) {
            status = 'overdue';
          }
          // Check if all installments are ECS Success
          else if (ecsSuccessCount === tenure) {
            status = 'ecs_success';
          }
          // Check if all installments are Paid
          else if (paidCount === tenure) {
            status = 'paid';
          }
          // Check if we have a mix of Paid and ECS Success
          else if (paidCount + ecsSuccessCount === tenure) {
            status = 'paid';
          }
          // Default to ontrack if we have some payments but not all
          else if (paidCount + ecsSuccessCount > 0) {
            status = 'ontrack';
          }

          // Compute collected and remaining
          const paidAmountDb = Number(l.paid_amount ?? 0);
          const paidAmountByStatus = (paidCount + ecsSuccessCount) * emiAmount;
          const paidAmount = Math.max(paidAmountDb, paidAmountByStatus);
          const totalPayable = tenure * emiAmount;
          const remainingAmount = Math.max(totalPayable - paidAmount, 0);

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
            remainingAmount, // calculated from statuses/DB
            nextDueDate: '-',
            status,
            paymentsCompleted: paidCount + ecsSuccessCount,
            totalPayments: tenure,
            mobileNumber: l.mobile_primary ?? '-',
            introducedBy: l.introduced_by ?? '-',
          } as LoanApplication;
        });
        setLoans(rows);
        setLastUpdated(new Date()); // Update timestamp when data is refreshed
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
    const ch3 = supabase
      .channel('payments-tracker-emi-statuses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emi_statuses' }, () => fetchLoans())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(ch2);
      supabase.removeChannel(ch3);
    };
  }, []);

  // (Removed) Portfolio header cards; keeping page minimal per request


  const filteredLoans = loans.filter(loan => {
    const matchesSearch = loan.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         loan.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || loan.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ontrack': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      case 'paid': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      case 'bounce': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800';
      case 'ecs_success': return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700/30 dark:text-gray-200 dark:border-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ontrack': return <CheckCircle className="w-4 h-4" />;
      case 'overdue': return <AlertCircle className="w-4 h-4" />;
      case 'paid': return <CheckCircle className="w-4 h-4" />;
      case 'bounce': return <AlertCircle className="w-4 h-4" />;
      case 'ecs_success': return <CheckCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const content = (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Payment Tracker</h1>
              
            </div>
            
          </div>
        </div>

        {/* Removed statistics cards and collection overview per request */}

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
                  <option value="bounce">Bounce</option>
                  <option value="paid">Paid</option>
                  <option value="ecs_success">ECS Success</option>
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
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Collected</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Remaining Amount</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Progress</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
                {filteredLoans.map((loan) => {
                  const paidEmi = loan.paymentsCompleted;
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
                        <span className="font-medium text-slate-800 dark:text-white">₹{loan.paidAmount.toLocaleString('en-IN')}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-medium text-slate-800 dark:text-white">₹{loan.remainingAmount.toLocaleString('en-IN')}</span>
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
                                loan.status === 'paid' || loan.status === 'ecs_success' ? 'bg-green-500' :
                                loan.status === 'bounce' || loan.status === 'overdue' ? 'bg-red-500' : 'bg-blue-500'
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
              Last updated: {lastUpdated.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
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
          onUpdated={({ loanId, paidAmount, paymentsCompleted, status }) => {
            setLoans(prev => prev.map(l => l.id === loanId
              ? { ...l, paidAmount, remainingAmount: Math.max(l.totalPayable - paidAmount, 0), paymentsCompleted, status }
              : l
            ));
            setSelectedLoan(prev => prev && prev.id === loanId
              ? ({ ...prev, paidAmount, remainingAmount: Math.max(prev.totalPayable - paidAmount, 0), paymentsCompleted, status } as any)
              : prev
            );
          }}
        />
      )}
    </>
  );
};

export default PaymentTracker;