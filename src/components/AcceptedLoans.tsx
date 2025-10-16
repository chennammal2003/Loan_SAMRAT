import { useEffect, useMemo, useState } from 'react';
import { Eye, FileText } from 'lucide-react';
import { supabase, LoanApplication } from '../lib/supabase';
import LoanDetailsModal from './LoanDetailsModal';

export default function AcceptedLoans() {
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 7;
  const downloadCSV = () => {
    const rows = filtered;
    const headers = [
      'Full Name','Application Number','Interest Scheme','Loan Amount','Tenure','Gold Lock','Status','Phone Number','Aadhaar Number','PAN Number','Address','Down Payment','Father/Mother/Spouse Name','Reference1','Reference2'
    ];
    const escape = (v: any) => {
      const s = v === null || v === undefined ? '' : String(v);
      const needsQuotes = /[",\n]/.test(s);
      const t = s.replace(/\"/g,'\"\"');
      return needsQuotes ? `\"${t}\"` : t;
    };
    const textify = (v: any) => (v === null || v === undefined || v === '' ? '' : `="${String(v)}"`);
    const lines = [headers.join(',')];
    rows.forEach(l => {
      const ref1 = [l.reference1_name, l.reference1_contact, l.reference1_relationship].filter(Boolean).join(' | ');
      const ref2 = [l.reference2_name, l.reference2_contact, l.reference2_relationship].filter(Boolean).join(' | ');
      const line = [
        escape(`${l.first_name} ${l.last_name}`),
        textify(l.application_number || ''),
        escape(l.interest_scheme),
        textify(l.loan_amount),
        textify(l.tenure),
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
    a.download = `Accepted_Loans_${now}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = async () => {
    try {
      const { data, error } = await supabase
        .from('loans')
        .select('*')
        .in('status', ['Accepted','Verified','Loan Disbursed'])
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setLoans(data || []);
    } catch (error) {
      console.error('Error fetching loans:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return loans;
    return loans.filter((l) => {
      const hay = [
        l.first_name,
        l.last_name,
        `${l.first_name} ${l.last_name}`,
        l.mobile_primary,
        l.email_id,
        l.address,
        l.id,
        l.application_number,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [loans, search]);

  // Reset pagination on search change
  useEffect(() => {
    setPage(1);
  }, [search]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = filtered.slice(start, end);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (loans.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Accepted Loans</h3>
        <p className="text-gray-600 dark:text-gray-400">No loans have been accepted yet.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Search */}
      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div />
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, email, address, application ID"
            className="w-full md:w-80 px-3 py-2 rounded border bg-white dark:bg-gray-800 dark:border-gray-700 text-sm"
          />
          <button onClick={downloadCSV} className="px-3 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700">Download Excel</button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-green-50 dark:bg-green-900/20">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Application ID</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Loan Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Tenure</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Applied On</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Phone</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {pageItems.map((loan) => (
                <tr key={loan.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    {loan.application_number || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {loan.first_name} {loan.last_name}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-green-600 dark:text-green-400">
                    ₹{loan.loan_amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{loan.tenure} months</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {new Date(loan.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {loan.mobile_primary}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${loan.status==='Accepted'?'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400': loan.status==='Verified'?'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400':'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                      {loan.status}
                    </span>
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-6 text-center text-sm text-gray-500 dark:text-gray-400">No results</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
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
          onStatusChange={(id, newStatus) => {
            setLoans(prev => prev.map(l => l.id===id ? ({ ...l, status: newStatus } as any) : l));
            setSelectedLoan(s => s && s.id===id ? ({ ...s, status: newStatus } as any) : s);
          }}
        />
      )}
    </div>
  );
}
