import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { TrendingUp, CheckCircle, AlertCircle, Download, Search, Filter } from 'lucide-react';
import PaymentDetailsModal from './PaymentDetailsModal';

interface LoanRow {
  id: string;
  applicationNumber?: string;
  fullName: string;
  loanAmount: number;
  tenure: number;
  interestScheme: string;
  disbursedDate: string;
  productDeliveredDate?: string;
  productDeliveryStatus?: string;
  emiAmount: number;
  totalPayable: number;
  paidAmount: number;
  remainingAmount: number;
  nextDueDate: string;
  status: 'ontrack' | 'overdue' | 'paid' | 'bounce' | 'ecs_success';
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
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState<null | 'pdf' | 'excel'>(null);

  const applyFilterAndScroll = (status: 'ontrack' | 'overdue' | 'paid') => {
    setFilterStatus(status);
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  // If merchant profile is inactive, block access to this page and show pending message
  if (profile && profile.role === 'merchant' && profile.is_active === false) {
    return (
      <div className="min-h-[300px] flex items-center justify-center bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700">
        <div className="max-w-lg text-center px-4 py-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Account pending verification</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Your merchant account is pending approval by the Super Admin. Once your account is activated, you will be able to view payment tracking details for your customers.
          </p>
        </div>
      </div>
    );
  }

  const toCsv = (rows: (string | number)[][]) =>
    rows
      .map((r) =>
        r
          .map((c) => {
            const v = c === null || c === undefined ? '' : String(c);
            if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
            return v;
          })
          .join(',')
      )
      .join('\n');

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const computeEmi = (loanAmount: number, tenure: number) => {
    const r = 0.36 / 12;
    if (!loanAmount || !tenure) return 0;
    const pow = Math.pow(1 + r, tenure);
    return Math.round((loanAmount * r * pow) / (pow - 1));
  };

  const buildSchedule = (disbursedDate: string, tenure: number) => {
    const result: { monthLabel: string; dueDate: Date }[] = [];
    const start = disbursedDate ? new Date(disbursedDate) : new Date();
    const dueDay = start.getDate();
    const base = new Date(start.getFullYear(), start.getMonth(), dueDay);
    for (let i = 0; i < tenure; i++) {
      const y = base.getFullYear();
      const m = base.getMonth() + i + 1;
      const lastDay = new Date(y, m + 1, 0).getDate();
      const day = Math.min(dueDay, lastDay);
      const d = new Date(y, m, day);
      result.push({ monthLabel: d.toLocaleString('en-US', { month: 'short' }), dueDate: d });
    }
    return result;
  };

  const fetchPopupRowsForLoan = async (loan: LoanRow) => {
    const emi = computeEmi(loan.loanAmount, loan.tenure);
    const schedule = buildSchedule(loan.disbursedDate, loan.tenure);
    const { data, error } = await supabase
      .from('payments')
      .select('payment_date,total_paid')
      .eq('loan_id', loan.id)
      .order('payment_date', { ascending: true });
    if (error) return schedule.map(() => ({ monthLabel: '-', amount: emi, status: 'Pending' }));
    const payments = (data || []).map((p: any) => ({ date: new Date(p.payment_date), amount: Number(p.total_paid ?? 0) }));
    const computed = schedule.map((slot) => {
      const endOfMonth = new Date(slot.dueDate.getFullYear(), slot.dueDate.getMonth() + 1, 0, 23, 59, 59);
      const paidThisCutoff = payments
        .filter((p) => p.date.getTime() <= endOfMonth.getTime())
        .reduce((s, p) => s + p.amount, 0);
      const emisCovered = Math.floor(paidThisCutoff / Math.max(emi, 1));
      const index = schedule.indexOf(slot);
      const covered = emisCovered > index;
      const status = covered ? 'Paid' : 'Pending';
      return { monthLabel: slot.monthLabel, amount: emi, status };
    });
    try {
      const { data: saved, error: sErr } = await supabase
        .from('emi_statuses')
        .select('installment_index,status')
        .eq('loan_id', loan.id)
        .order('installment_index');
      if (!sErr && saved && saved.length > 0) {
        return computed.map((r, i) => {
          const row = (saved as any[]).find((s) => Number(s.installment_index) === i);
          return row ? { ...r, status: row.status as any } : r;
        });
      }
      return computed;
    } catch {
      return computed;
    }
  };

  const handleExport = async (type: 'pdf' | 'excel') => {
    setExporting(type);
    setShowExportMenu(false);
    try {
      const now = new Date();
      const ts = now.toISOString().replace(/[:T]/g, '-').split('.')[0];
      const summaryHeader = ['Name', 'Application Number', 'Loan ID', 'Loan Amount', 'Tenure (months)', 'Paid/Total EMI', 'Remaining Amount', 'Status'];
      const summaryRows = filteredLoans.map((l) => [
        l.fullName,
        l.applicationNumber || '-',
        l.id,
        `₹${l.loanAmount.toLocaleString('en-IN')}`,
        String(l.tenure),
        `${l.paymentsCompleted} / ${l.totalPayments}`,
        `₹${l.remainingAmount.toLocaleString('en-IN')}`,
        l.status,
      ]);

      const allDetailRows: { loan: LoanRow; rows: { monthLabel: string; amount: number; status: string }[] }[] = [];
      for (const l of filteredLoans) {
        const rows = await fetchPopupRowsForLoan(l);
        allDetailRows.push({ loan: l, rows });
      }

      if (type === 'excel') {
        const rows: (string | number)[][] = [];
        for (const block of allDetailRows) {
          const l = block.loan;
          rows.push(['Name', 'Loan Amount', 'Tenure', 'Month', 'Amount', 'Status', 'Collected', 'Remaining']);
          for (const r of block.rows) {
            rows.push([
              l.fullName,
              Number(l.loanAmount || 0),
              Number(l.tenure || 0),
              r.monthLabel,
              Number(r.amount || 0),
              r.status,
              Number(l.paidAmount || 0),
              Number(l.remainingAmount || 0),
            ]);
          }
          rows.push([]);
        }
        const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, `merchant-payment-tracker-${ts}.csv`);
      } else {
        const w = window.open('', '_blank');
        if (!w) return;
        const style = `
          <style>
            body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 24px; color: #111; }
            h1 { margin: 0 0 8px 0; }
            .muted { color: #555; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin: 12px 0; }
            th, td { border: 1px solid #ccc; padding: 8px; font-size: 12px; text-align: left; }
            th { background:#f5f5f5; }
            .section { margin-top: 20px; }
          </style>`;
        const header = `<h1>Merchant Payment Tracker Export</h1><div class="muted">Generated at ${now.toLocaleString('en-IN')}</div>`;
        const summaryTable = `
          <table>
            <thead><tr>${summaryHeader.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>
              ${summaryRows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>`;
        const detailsHtml = allDetailRows
          .map(
            (block) => `
          <div class="section">
            <div><strong>Application Number:</strong> ${block.loan.applicationNumber || '-'} &nbsp; <strong>Name:</strong> ${block.loan.fullName}</div>
            <table>
              <thead><tr><th>Month</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
              ${block.rows
                .map((r) => `<tr><td>${r.monthLabel}</td><td>₹${r.amount.toLocaleString('en-IN')}</td><td>${r.status}</td></tr>`)
                .join('')}
              </tbody>
            </table>
          </div>
        `
          )
          .join('');
        w.document.write(`<html><head><title>Merchant Payment Tracker</title>${style}</head><body>${header}${summaryTable}${detailsHtml}</body></html>`);
        w.document.close();
        w.focus();
        w.print();
      }
    } finally {
      setExporting(null);
    }
  };

  useEffect(() => {
    const fetchLoans = async () => {
      if (!profile) return;
      setLoading(true);
      setError(null);
      try {
        // Fetch from product_loans table instead of loans table
        // This ensures we get product loan records with all product details
        const { data, error } = await supabase
          .from('product_loans')
          .select('*')
          .eq('merchant_id', profile.id)
          .in('status', ['Verified', 'Accepted', 'Loan Disbursed', 'Delivered'])
          .order('created_at', { ascending: false });
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
          // Try product_emi_statuses first (NEW table with product loan tracking)
          const { data: emi, error: eErr } = await supabase
            .from('product_emi_statuses')
            .select('product_loan_id, installment_index, status')
            .in('product_loan_id', ids);
          
          if (!eErr && emi && emi.length > 0) {
            // Use new product_emi_statuses table
            const map: Record<string, string[]> = {};
            for (const row of emi as any[]) {
              if (!map[row.product_loan_id]) map[row.product_loan_id] = [];
              map[row.product_loan_id][row.installment_index] = row.status;
            }
            emiStatuses = map;
          } else {
            // Fallback to legacy emi_statuses table
            const { data: emiOld, error: eErrOld } = await supabase
              .from('emi_statuses')
              .select('loan_id, installment_index, status')
              .in('loan_id', ids);
            if (!eErrOld && emiOld) {
              const map: Record<string, string[]> = {};
              for (const row of emiOld as any[]) {
                if (!map[row.loan_id]) map[row.loan_id] = [];
                map[row.loan_id][row.installment_index] = row.status;
              }
              emiStatuses = map;
            }
          }
        }
        const rows = loanRows.map((l: any) => {
          const fullName = `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim();
          const loanAmount = Number(l.loan_amount ?? 0);
          const tenure = Number(l.tenure ?? 0);
          // EMI at 36% p.a. => 3% per month
          const r = 0.36 / 12;
          const pow = tenure > 0 ? Math.pow(1 + r, tenure) : 0;
          const emiAmount = tenure > 0 ? Math.round((loanAmount * r * pow) / (pow - 1)) : 0;

          // Determine loan status based on EMI statuses
          const statuses = emiStatuses[l.id] || [];
          const paidCount = statuses.filter(s => s === 'Paid').length;
          const ecsSuccessCount = statuses.filter(s => s === 'ECS Success').length;
          const bounceCount = statuses.filter(s => s === 'ECS Bounce').length;
          const overdueCount = statuses.filter(s => s === 'Due Missed').length;

          let status: LoanRow['status'] = 'ontrack';

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

          // Compute paid from DB or statuses fallback
          const paidAmountDb = Number(l.paid_amount ?? 0);
          const paidAmountByStatus = (paidCount + ecsSuccessCount) * emiAmount;
          const paidAmount = Math.max(paidAmountDb, paidAmountByStatus);
          const totalPayable = tenure * emiAmount;
          const actualRemaining = Math.max(totalPayable - paidAmount, 0);

          return {
            id: l.id,
            applicationNumber: l.application_number || String(l.id),
            fullName,
            loanAmount,
            tenure,
            interestScheme: String(l.interest_scheme ?? ''),
            disbursedDate: byId[l.id] ?? l.gold_price_lock_date ?? l.created_at,
            productDeliveredDate: l.product_delivered_date,
            productDeliveryStatus: l.product_delivery_status,
            emiAmount,
            totalPayable,
            paidAmount,
            remainingAmount: actualRemaining,
            nextDueDate: '-',
            status,
            paymentsCompleted: paidCount + ecsSuccessCount,
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
    const ch3 = supabase
      .channel(`merchant-emi-statuses-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emi_statuses' }, () => fetchLoans())
      .subscribe();
    return () => {
      supabase.removeChannel(ch); supabase.removeChannel(ch2); supabase.removeChannel(ch3);
    };
  }, [profile?.id]);

  // Totals not displayed in merchant view header anymore; computed directly where needed

  const filteredLoans = loans.filter(loan => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch = !q || loan.fullName.toLowerCase().includes(q) || loan.id.toLowerCase().includes(q) || (loan.applicationNumber && loan.applicationNumber.toLowerCase().includes(q));
    const matchesFilter = filterStatus === 'all' || loan.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ontrack': return <CheckCircle className="w-4 h-4" />;
      case 'overdue': return <AlertCircle className="w-4 h-4" />;
      case 'paid': return <CheckCircle className="w-4 h-4" />;
      case 'bounce': return <AlertCircle className="w-4 h-4" />;
      case 'ecs_success': return <CheckCircle className="w-4 h-4" />;
      default: return <CheckCircle className="w-4 h-4" />;
    }
  };

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
                placeholder="Search by name, application ID, or loan ID..."
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
              <div className="relative">
                <button
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
                  onClick={() => setShowExportMenu((v) => !v)}
                  disabled={exporting !== null}
                >
                  <Download className="w-5 h-5" />
                  {exporting ? (exporting === 'excel' ? 'Exporting CSV...' : 'Preparing PDF...') : 'Export'}
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg shadow-lg z-10">
                    <button
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-gray-600"
                      onClick={() => handleExport('excel')}
                    >
                      Excel (CSV)
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-gray-600"
                      onClick={() => handleExport('pdf')}
                    >
                      PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Loans Table */}
        <div ref={tableRef} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-gray-700 border-b border-slate-200 dark:border-gray-700">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Application ID</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Name</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Loan Amount</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Tenure</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Paid / Total EMI</th>
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
                        <span className="font-semibold text-slate-800 dark:text-white">{loan.applicationNumber || 'N/A'}</span>
                      </td>
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-medium text-slate-800 dark:text-white">{loan.fullName}</p>
                          <p className="text-sm text-slate-500 dark:text-gray-300">{loan.mobileNumber}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-semibold text-slate-800 dark:text-white">₹{loan.loanAmount.toLocaleString('en-IN')}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-slate-700 dark:text-gray-200">{loan.tenure} months</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-medium text-slate-800 dark:text-white">{paidEmi} / {loan.totalPayments}</span>
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
                {filteredLoans.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-600 dark:text-gray-300">No loans found</td>
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
            applicationNumber: selectedLoan.applicationNumber,
            fullName: selectedLoan.fullName,
            loanAmount: selectedLoan.loanAmount,
            tenure: selectedLoan.tenure,
            emiAmount: selectedLoan.emiAmount,
            disbursedDate: selectedLoan.disbursedDate,
            productDeliveredDate: selectedLoan.productDeliveredDate,
            productDeliveryStatus: selectedLoan.productDeliveryStatus
          }}
          onClose={() => setSelectedLoan(null)}
          readOnly={true}
        />
      )}
    </>
  );
}
