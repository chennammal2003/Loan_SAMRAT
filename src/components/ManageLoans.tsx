import { useEffect, useMemo, useState } from 'react';
import { Eye, FileText } from 'lucide-react';
import { supabase, LoanApplication } from '../lib/supabase';
import LoanDetailsModal from './LoanDetailsModal';
import DocsModal from './DocsModal';
import ConfirmActionModal from './ConfirmActionModal';

interface ManageLoansProps {
  initialStatusFilter?: 'All' | 'Pending' | 'Accepted' | 'Rejected';
}

export default function ManageLoans({ initialStatusFilter = 'All' }: ManageLoansProps) {
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ loan: LoanApplication; action: 'accept' | 'reject' } | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Accepted' | 'Rejected'>(initialStatusFilter);
  const [showDocsFor, setShowDocsFor] = useState<LoanApplication | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 7;
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  const downloadCSV = () => {
    const rows = filteredLoans;
    const headers = [
      'Full Name','Application Number','Interest Scheme','Loan Amount','Tenure','Gold Lock','Status','Phone Number','Aadhaar Number','PAN Number','Address','Down Payment','Father/Mother/Spouse Name','Reference1','Reference2'
    ];
    const escape = (v: any) => {
      const s = v === null || v === undefined ? '' : String(v);
      const needsQuotes = /[",\n]/.test(s);
      const t = s.replace(/\"/g,'\"\"');
      return needsQuotes ? `\"${t}\"` : t;
    };
    // Force Excel to treat long numeric strings as text to avoid scientific notation
    const textify = (v: any) => (v === null || v === undefined || v === '' ? '' : `="${String(v)}"`);
    const lines = [headers.join(',')];
    rows.forEach(l => {
      const ref1 = [l.reference1_name, l.reference1_contact, l.reference1_relationship].filter(Boolean).join(' | ');
      const ref2 = [l.reference2_name, l.reference2_contact, l.reference2_relationship].filter(Boolean).join(' | ');
      const line = [
        escape(`${l.first_name} ${l.last_name}`),
        textify(l.id),
        escape(l.interest_scheme),
        l.loan_amount.toString(), // convert to string to avoid scientific notation
        l.tenure.toString(),
        escape(l.gold_price_lock_date),
        escape(l.status),
        textify(l.mobile_primary),
        textify(l.aadhaar_number),
        textify(l.pan_number),
        escape(l.address),
        escape(l.down_payment_details || ''),
        escape(l.father_mother_spouse_name),
        escape(ref1),
        escape(ref2)
      ].join(',');
      lines.push(line);
    });
    const blob = new Blob(["\uFEFF" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    a.download = `Loans_${statusFilter}_${now}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  // Live updates via Supabase Realtime for admin view (all loans)
  useEffect(() => {
    const ch = supabase
      .channel('loans-admin')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'loans' }, (payload) => {
        const l = payload.new as any;
        setLoans((prev) => (prev.some((x) => x.id === l.id) ? prev : [l as any, ...prev]));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'loans' }, (payload) => {
        const l = payload.new as any;
        setLoans((prev) => prev.map((x) => (x.id === l.id ? (l as any) : x)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'loans' }, (payload) => {
        const id = (payload.old as any).id;
        setLoans((prev) => prev.filter((x) => x.id !== id));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
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
      setToast({ type: 'success', message: 'Loan accepted successfully!' });
      setTimeout(() => setToast(null), 3000);
    } catch (error: any) {
      console.error('Error accepting loan:', error);
      setToast({ type: 'error', message: error.message || 'Failed to accept loan' });
      setTimeout(() => setToast(null), 3000);
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
      setToast({ type: 'success', message: 'Loan rejected successfully!' });
      setTimeout(() => setToast(null), 3000);
    } catch (error: any) {
      console.error('Error rejecting loan:', error);
      setToast({ type: 'error', message: error.message || 'Failed to reject loan' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Accepted':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'Verified':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Loan Disbursed':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'Rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    }
  };

  const filteredLoans = useMemo(() => {
    const q = search.trim().toLowerCase();
    return loans
      .filter((l) => (statusFilter === 'All' ? true : l.status === statusFilter))
      .filter((l) => {
        if (!q) return true;
        const hay = [
          l.first_name,
          l.last_name,
          `${l.first_name} ${l.last_name}`,
          l.mobile_primary,
          l.email_id,
          l.address,
          l.id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
  }, [loans, search, statusFilter]);

  // reset page when filters/search change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const total = filteredLoans.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = filteredLoans.slice(start, end);

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
      {/* Filters */}
      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-300">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 rounded border bg-white dark:bg-gray-800 dark:border-gray-700 text-sm"
          >
            <option>All</option>
            <option>Pending</option>
            <option>Accepted</option>
            <option>Rejected</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, email, address, ID"
            className="w-full md:w-80 px-3 py-2 rounded border bg-white dark:bg-gray-800 dark:border-gray-700 text-sm"
          />
          <button onClick={downloadCSV} className="px-3 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700">Download Excel</button>
        </div>
      </div>

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
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Documents</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {pageItems.map((loan) => (
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
                  <td className="px-6 py-4 text-sm">
                    {(loan as any)?.documents_uploaded ? (
                      <button
                        onClick={() => setShowDocsFor(loan)}
                        className="inline-flex items-center space-x-2 px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 text-xs"
                      >
                        <span>View Docs</span>
                      </button>
                    ) : loan.status === 'Accepted' ? (
                      <span className="inline-flex px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 text-xs">Pending</span>
                    ) : (
                      <span className="inline-flex px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs">N/A</span>
                    )}
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
              {filteredLoans.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-6 text-center text-sm text-gray-500 dark:text-gray-400">No results</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredLoans.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">Showing {Math.min(total, start + 1)}–{Math.min(total, end)} of {total}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded border bg-white dark:bg-gray-800 dark:border-gray-700 text-sm disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded border bg-white dark:bg-gray-800 dark:border-gray-700 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selectedLoan && (
        <LoanDetailsModal
          loan={selectedLoan}
          onClose={() => setSelectedLoan(null)}
          showActions={selectedLoan.status === 'Pending'}
          onAccept={() => setConfirmAction({ loan: selectedLoan, action: 'accept' })}
          onReject={() => handleReject(selectedLoan)}
          onStatusChange={(id, newStatus) => {
            setLoans(prev => prev.map(l => l.id===id ? { ...l, status: newStatus } as any : l));
            setSelectedLoan(s => s && s.id===id ? ({ ...s, status: newStatus } as any) : s);
          }}
        />
      )}

      {showDocsFor && (
        <DocsModal
          loanId={showDocsFor.id}
          fullName={`${showDocsFor.first_name} ${showDocsFor.last_name}`}
          onClose={() => setShowDocsFor(null)}
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

      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded shadow-lg ${toast.type==='success'?'bg-green-600 text-white':'bg-red-600 text-white'}`}>
          <div className="flex items-center space-x-2">
            <span className="font-medium">{toast.type==='success'?'Success':'Error'}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
