import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { TrendingUp, CheckCircle, AlertCircle, Download, Search, Filter } from 'lucide-react';
import PaymentDetailsModal from './PaymentDetailsModal';

interface LoanRow {
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
}

export default function MerchantPaymentTracker() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);

  const [selectedLoan, setSelectedLoan] = useState<LoanRow | null>(null);

  const applyFilterAndScroll = (status: 'ontrack' | 'overdue' | 'paid') => {
    setFilterStatus(status);
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  useEffect(() => {
    const fetchLoans = async () => {
      if (!profile) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('loans')
          .select('*')
          .eq('status', 'Loan Disbursed')
          .eq('user_id', profile.id)
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
          let status: LoanRow['status'] = 'ontrack';
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
          } as LoanRow;
        });
        setLoans(rows);
      } catch (e: any) {
        setError(e.message || 'Failed to load loans');
      } finally {
        setLoading(false);
      }
    };
    fetchLoans();
    if (!profile) return;
    const ch = supabase
      .channel(`merchant-payments-tracker-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans', filter: `user_id=eq.${profile.id}` }, () => fetchLoans())
      .subscribe();
    const ch2 = supabase
      .channel(`merchant-payments-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchLoans())
      .subscribe();
    return () => {
      supabase.removeChannel(ch); supabase.removeChannel(ch2);
    };
  }, [profile?.id]);

  // Totals not displayed in merchant view header anymore; computed directly where needed

  const filteredLoans = loans.filter(loan => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch = !q || loan.fullName.toLowerCase().includes(q) || loan.id.toLowerCase().includes(q);
    const matchesFilter = filterStatus === 'all' || loan.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ontrack': return <CheckCircle className="w-4 h-4" />;
      case 'overdue': return <AlertCircle className="w-4 h-4" />;
      case 'paid': return <CheckCircle className="w-4 h-4" />;
      default: return <CheckCircle className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ontrack': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      case 'paid': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700/30 dark:text-gray-200 dark:border-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-[300px] flex items-center justify-center bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-[300px] flex items-center justify-center bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Overview */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Payment Status</h2>
          </div>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-0">
              <div className="border border-slate-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700/40 transition-colors" onClick={() => applyFilterAndScroll('ontrack')}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-green-100 p-2 rounded-lg"><CheckCircle className="w-5 h-5 text-green-600" /></div>
                  <span className="font-semibold text-slate-700 dark:text-gray-200">On Track</span>
                </div>
                <p className="text-2xl font-bold text-slate-800 dark:text-white">{loans.filter(l => l.status === 'ontrack').length}</p>
                <p className="text-sm text-slate-600 dark:text-gray-300 mt-1">Loans on track</p>
              </div>
              <div className="border border-slate-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700/40 transition-colors" onClick={() => applyFilterAndScroll('overdue')}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-red-100 p-2 rounded-lg"><AlertCircle className="w-5 h-5 text-red-600" /></div>
                  <span className="font-semibold text-slate-700 dark:text-gray-200">Overdue</span>
                </div>
                <p className="text-2xl font-bold text-slate-800 dark:text-white">{loans.filter(l => l.status === 'overdue').length}</p>
                <p className="text-sm text-slate-600 dark:text-gray-300 mt-1">Needs attention</p>
              </div>
              <div className="border border-slate-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700/40 transition-colors" onClick={() => applyFilterAndScroll('paid')}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-blue-100 p-2 rounded-lg"><CheckCircle className="w-5 h-5 text-blue-600" /></div>
                  <span className="font-semibold text-slate-700 dark:text-gray-200">Completed</span>
                </div>
                <p className="text-2xl font-bold text-slate-800 dark:text-white">{loans.filter(l => l.status === 'paid').length}</p>
                <p className="text-sm text-slate-600 dark:text-gray-300 mt-1">Fully repaid</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
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
                {filteredLoans.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-600 dark:text-gray-300">No loans found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
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
          readOnly={true}
        />
      )}
    </>
  );
}
