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
}

const formatLoanId = (id: string) => `LOAN-${String(id).slice(0, 8)}`;

const PaymentTracker: React.FC = () => {
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

  // Removed applyFilterAndScroll (no longer needed after UI simplification)

  useEffect(() => {
    const fetchLoans = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('product_loans')
          .select('*')
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
            applicationNumber: String(l.id),
            createdAt: String(l.created_at || ''),
            fullName,
            loanAmount,
            tenure,
            interestScheme: String(l.interest_scheme ?? ''),
            disbursedDate: byId[l.id] ?? l.gold_price_lock_date ?? l.created_at,
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
            productImageUrl: l.product_image_url ?? null,
            productName: l.product_name ?? null,
            productDeliveredDate: l.product_delivered_date ?? null,
            productDeliveryStatus: l.product_delivery_status ?? null,
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_loans' }, () => fetchLoans())
      .subscribe();
    const ch2 = supabase
      .channel('payments-tracker-payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchLoans())
      .subscribe();
    const ch3 = supabase
      .channel('payments-tracker-emi-statuses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emi_statuses' }, () => fetchLoans())
      .subscribe();
    const ch4 = supabase
      .channel('payments-tracker-product-emi-statuses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_emi_statuses' }, () => fetchLoans())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(ch2);
      supabase.removeChannel(ch3);
      supabase.removeChannel(ch4);
    };
  }, []);

  // (Removed) Portfolio header cards; keeping page minimal per request


  const filteredLoans = loans.filter(loan => {
    const matchesSearch = loan.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         loan.applicationNumber.toLowerCase().includes(searchTerm.toLowerCase());
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

  const fetchPopupRowsForLoan = async (loan: LoanApplication) => {
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
      const paidThisCutoff = payments.filter((p) => p.date.getTime() <= endOfMonth.getTime()).reduce((s, p) => s + p.amount, 0);
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

  const toCsv = (rows: (string | number)[][]) => rows
    .map(r => r.map((c) => {
      const v = c === null || c === undefined ? '' : String(c);
      if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
      return v;
    }).join(',')).join('\n');

  // (removed asText helper; not needed in current flat export)

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

  const handleExport = async (type: 'pdf' | 'excel') => {
    setExporting(type);
    setShowExportMenu(false);
    try {
      const now = new Date();
      const ts = now.toISOString().replace(/[:T]/g, '-').split('.')[0];
      // Summary section
      const summaryHeader = ['Name', 'Application Number', 'Loan ID', 'Loan Amount', 'Tenure (months)', 'Paid/Total EMI', 'Remaining Amount', 'Status'];
      const summaryRows = filteredLoans.map(l => [
        l.fullName,
        l.applicationNumber,
        l.id,
        `₹${l.loanAmount.toLocaleString('en-IN')}`,
        String(l.tenure),
        `${l.paymentsCompleted} / ${l.totalPayments}`,
        `₹${l.remainingAmount.toLocaleString('en-IN')}`,
        l.status
      ]);

      // Details (popup-like) section: exclude Due Date
      const allDetailRows: { loan: LoanApplication; rows: { monthLabel: string; amount: number; status: string }[] }[] = [];
      for (const l of filteredLoans) {
        const rows = await fetchPopupRowsForLoan(l);
        allDetailRows.push({ loan: l, rows });
      }

      if (type === 'excel') {
        const rows: (string | number)[][] = [];
        // For each person, output one table: header + their rows
        for (const block of allDetailRows) {
          const l = block.loan;
          // Header for this person
          rows.push(['Name', 'Loan Amount', 'Tenure', 'Month', 'Amount', 'Status', 'Collected', 'Remaining']);
          // Person rows
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
          // Blank line between people for readability
          rows.push([]);
        }
        const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, `payment-tracker-${ts}.csv`);
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
        const header = `<h1>Payment Tracker Export</h1><div class="muted">Generated at ${now.toLocaleString('en-IN')}</div>`;
        const summaryTable = `
          <table>
            <thead><tr>${summaryHeader.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>
              ${summaryRows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>`;
        const detailsHtml = allDetailRows.map(block => `
          <div class="section">
            <div><strong>Application Number:</strong> ${block.loan.applicationNumber} &nbsp; <strong>Name:</strong> ${block.loan.fullName}</div>
            <table>
              <thead><tr><th>Month</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
              ${block.rows.map(r => `<tr><td>${r.monthLabel}</td><td>₹${r.amount.toLocaleString('en-IN')}</td><td>${r.status}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        `).join('');
        w.document.write(`<html><head><title>Payment Tracker</title>${style}</head><body>${header}${summaryTable}${detailsHtml}</body></html>`);
        w.document.close();
        w.focus();
        w.print();
      }
    } finally {
      setExporting(null);
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
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Name</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Loan ID</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Loan Amount</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Tenure</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Paid / Total EMI</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Remaining</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Product Delivered Date</th>
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
                        <span className="font-semibold text-slate-800 dark:text-white">{formatLoanId(loan.id)}</span>
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
                        <span className="font-medium text-slate-800 dark:text-white">₹{loan.remainingAmount.toLocaleString('en-IN')}</span>
                      </td>
                      <td className="py-4 px-6">
                        {loan.productDeliveredDate ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle size={14} />
                            {new Date(loan.productDeliveredDate).toLocaleDateString('en-IN')}
                          </span>
                        ) : (
                          <span className="inline-flex px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                            Pending
                          </span>
                        )}
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
            applicationNumber: selectedLoan.applicationNumber,
            fullName: selectedLoan.fullName,
            loanAmount: selectedLoan.loanAmount,
            tenure: selectedLoan.tenure,
            emiAmount: selectedLoan.emiAmount,
            disbursedDate: selectedLoan.disbursedDate,
            productDeliveredDate: selectedLoan.productDeliveredDate || undefined,
            productDeliveryStatus: selectedLoan.productDeliveryStatus || undefined,
            createdAt: selectedLoan.createdAt
          } as TrackerLoan}
          onClose={() => {
            setSelectedLoan(null);
            // Refresh loans to get updated status from database
            setTimeout(() => {
              const fetchLoans = async () => {
                try {
                  const { data, error } = await supabase
                    .from('product_loans')
                    .select('*')
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
                  // Fetch EMI statuses
                  let emiStatuses: Record<string, string[]> = {};
                  if (loanRows.length > 0) {
                    const ids = loanRows.map((l: any) => l.id);
                    const { data: emi, error: eErr } = await supabase
                      .from('product_emi_statuses')
                      .select('product_loan_id, installment_index, status')
                      .in('product_loan_id', ids);
                    if (!eErr && emi) {
                      const map: Record<string, string[]> = {};
                      for (const row of emi as any[]) {
                        if (!map[row.product_loan_id]) map[row.product_loan_id] = [];
                        map[row.product_loan_id][row.installment_index] = row.status;
                      }
                      emiStatuses = map;
                    } else {
                      // Fallback to emi_statuses
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
                  // Transform to LoanApplication rows
                  const rows = loanRows.map((l: any) => {
                    const fullName = `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim();
                    const loanAmount = Number(l.loan_amount ?? 0);
                    const tenure = Number(l.tenure ?? 0);
                    const r = 0.36 / 12;
                    const pow = tenure > 0 ? Math.pow(1 + r, tenure) : 0;
                    const emiAmount = tenure > 0 ? Math.round((loanAmount * r * pow) / (pow - 1)) : 0;
                    const statuses = emiStatuses[l.id] || [];
                    const paidCount = statuses.filter(s => s === 'Paid').length;
                    const ecsSuccessCount = statuses.filter(s => s === 'ECS Success').length;
                    const bounceCount = statuses.filter(s => s === 'ECS Bounce').length;
                    const overdueCount = statuses.filter(s => s === 'Due Missed').length;
                    let status: 'ontrack' | 'overdue' | 'paid' | 'bounce' | 'ecs_success' = 'ontrack';
                    if (bounceCount > 0) {
                      status = 'bounce';
                    } else if (overdueCount > 0) {
                      status = 'overdue';
                    } else if (ecsSuccessCount === tenure) {
                      status = 'ecs_success';
                    } else if (paidCount === tenure) {
                      status = 'paid';
                    } else if (paidCount + ecsSuccessCount === tenure) {
                      status = 'paid';
                    } else if (paidCount + ecsSuccessCount > 0) {
                      status = 'ontrack';
                    }
                    const paidAmountDb = Number(l.paid_amount ?? 0);
                    const paidAmountByStatus = (paidCount + ecsSuccessCount) * emiAmount;
                    const paidAmount = Math.max(paidAmountDb, paidAmountByStatus);
                    const totalPayable = tenure * emiAmount;
                    const remainingAmount = Math.max(totalPayable - paidAmount, 0);
                    return {
                      id: l.id,
                      applicationNumber: String(l.id),
                      createdAt: String(l.created_at || ''),
                      fullName,
                      loanAmount,
                      tenure,
                      interestScheme: String(l.interest_scheme ?? ''),
                      disbursedDate: byId[l.id] ?? l.gold_price_lock_date ?? l.created_at,
                      emiAmount,
                      totalPayable,
                      paidAmount,
                      remainingAmount,
                      nextDueDate: '-',
                      status,
                      paymentsCompleted: paidCount + ecsSuccessCount,
                      totalPayments: tenure,
                      mobileNumber: l.mobile_primary ?? '-',
                      introducedBy: l.introduced_by ?? '-',
                      productImageUrl: l.product_image_url ?? null,
                      productName: l.product_name ?? null,
                      productDeliveredDate: l.product_delivered_date ?? null,
                      productDeliveryStatus: l.product_delivery_status ?? null,
                    } as LoanApplication;
                  });
                  setLoans(rows);
                  setLastUpdated(new Date());
                } catch (error) {
                  console.error('Error refreshing loans:', error);
                }
              };
              fetchLoans();
            }, 500);
          }}
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