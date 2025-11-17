import { useEffect, useMemo, useState } from 'react';
import { Eye, Download, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import DocsModal from './DocsModal';
import { useAuth } from '../contexts/AuthContext';

interface ProductLoan {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email_id: string;
  address?: string;
  mobile_primary: string;
  mobile_alternative?: string;
  loan_amount: number;
  tenure: number;
  processing_fee: number;
  status: string;
  product_id?: string;
  product_name: string;
  product_image_url: string;
  product_price: number;
  product_category?: string;
  merchant_id?: string;
  created_at: string;
  updated_at: string;
}

export default function MerchantProductLoans() {
  const { profile } = useAuth();
  const [loans, setLoans] = useState<ProductLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<ProductLoan | null>(null);
  const [showDocsFor, setShowDocsFor] = useState<ProductLoan | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [refFilter, setRefFilter] = useState<'All'|'Referred'|'Direct'>('All');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [docsSet, setDocsSet] = useState<Set<string>>(new Set());
  const [productInfoLoan, setProductInfoLoan] = useState<ProductLoan | null>(null);

  useEffect(() => {
    if (profile) {
      fetchLoans();
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const ch = supabase
      .channel('product-loans-merchant')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'product_loans' }, () => fetchLoans())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'product_loans' }, () => fetchLoans())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'product_loans' }, () => fetchLoans())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [profile]);

  const fetchLoans = async () => {
    if (!profile) return;
    try {
      setLoading(true);
      
      // Fetch product loans for this merchant (merchant_id is stored as text)
      const { data: productLoansData, error: productLoansError } = await supabase
        .from('product_loans')
        .select('*')
        .eq('merchant_id', profile.id)
        .order('created_at', { ascending: false });

      if (productLoansError) throw productLoansError;

      const loanIds = (productLoansData || []).map(pl => pl.id);
      let newDocsSet = new Set<string>();
      if (loanIds.length > 0) {
        const { data: docsData, error: docsError } = await supabase
          .from('loan_documents')
          .select('loan_id')
          .in('loan_id', loanIds)
          .eq('loan_type', 'product');
        if (docsError) throw docsError;
        newDocsSet = new Set((docsData || []).map(d => d.loan_id));
      }

      setDocsSet(newDocsSet);
      setLoans(productLoansData || []);
    } catch (error) {
      console.error('Error fetching product loans:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLoans = useMemo(() => {
    let filtered = loans;
    
    if (statusFilter !== 'All') {
      filtered = filtered.filter(l => l.status === statusFilter);
    }
    if (refFilter !== 'All') {
      filtered = filtered.filter(l => (refFilter === 'Referred') ? !!(l as any).referral_code : !(l as any).referral_code);
    }
    
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(l => 
        `${l.first_name} ${l.last_name}`.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        l.product_name.toLowerCase().includes(q)
      );
    }
    
    return filtered;
  }, [loans, search, statusFilter, refFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLoans.length / pageSize));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = filteredLoans.slice(start, end);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      case 'Verified':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Accepted':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'Rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'Loan Disbursed':
      case 'Disbursed':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const formatLoanId = (id: string) => {
    return `LOAN-${id.substring(0, 8)}`;
  };

  const maskEmail = (email: string) => {
    const [local, domain] = email.split('@');
    if (local.length <= 3) return `${local[0]}***@${domain}`;
    return `${local.substring(0, 1)}***@${domain}`;
  };

  const maskMobile = (mobile: string) => {
    if (mobile.length <= 4) return '****';
    return `*******${mobile.slice(-2)}`;
  };

  const handleExportCSV = () => {
    const rows = selectedRows.size > 0 
      ? filteredLoans.filter(l => selectedRows.has(l.id))
      : filteredLoans;
    
    const headers = [
      'Loan ID', 'Applied At', 'Status', 'Applicant Name',
      'Applicant Email (masked)', 'Applicant Mobile (masked)',
      'Product ID', 'Product Name', 'Product Price', 'Loan Amount',
      'Tenure', 'Processing Fee'
    ];
    
    const escape = (v: any) => {
      const s = v === null || v === undefined ? '' : String(v);
      const needsQuotes = /[",\n]/.test(s);
      const t = s.replace(/\"/g, '""');
      return needsQuotes ? `"${t}"` : t;
    };
    
    const lines = [headers.join(',')];
    rows.forEach(l => {
      const line = [
        escape(formatLoanId(l.id)),
        escape(new Date(l.created_at).toLocaleString()),
        escape(l.status),
        escape(`${l.first_name} ${l.last_name}`),
        escape(maskEmail(l.email_id)),
        escape(maskMobile(l.mobile_primary)),
        escape(l.product_id || ''),
        escape(l.product_name || ''),
        escape(l.product_price || ''),
        escape(l.loan_amount),
        escape(l.tenure),
        escape(l.processing_fee)
      ].join(',');
      lines.push(line);
    });
    
    const blob = new Blob(["\uFEFF" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.download = `Product_Loans_${now}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleRowSelection = (loanId: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(loanId)) {
        next.delete(loanId);
      } else {
        next.add(loanId);
      }
      return next;
    });
  };

  const toggleAllSelection = () => {
    if (selectedRows.size === pageItems.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(pageItems.map(l => l.id)));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1 flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, loan ID, product..."
            className="flex-1 px-4 py-2 border border-slate-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Verified">Verified</option>
            <option value="Accepted">Accepted</option>
            <option value="Rejected">Rejected</option>
            <option value="Loan Disbursed">Disbursed</option>
          </select>
          <select
            value={refFilter}
            onChange={(e) => setRefFilter(e.target.value as any)}
            className="px-4 py-2 border border-slate-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="All">All Sources</option>
            <option value="Referred">Referred</option>
            <option value="Direct">Direct</option>
          </select>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Download size={18} />
          Export CSV
        </button>
      </div>

      {filteredLoans.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
          <p className="text-slate-600 dark:text-gray-400">No product loans found. Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === pageItems.length && pageItems.length > 0}
                      onChange={toggleAllSelection}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Loan ID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Product</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Source</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Applicant</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Loan Amount</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Tenure</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Processing Fee</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Documents</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Applied At</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {pageItems.map((loan) => (
                  <tr
                    key={loan.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(loan.id)}
                        onChange={() => toggleRowSelection(loan.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedLoan(loan)}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-mono text-sm"
                      >
                        {formatLoanId(loan.id)}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={loan.product_image_url || '/placeholder-product.png'}
                          alt={loan.product_name}
                          className="w-10 h-10 rounded object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder-product.png';
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => setProductInfoLoan(loan)}
                            className="font-medium text-blue-600 dark:text-blue-400 hover:underline truncate text-left"
                            title="View product information"
                          >
                            {loan.product_name}
                          </button>
                          {loan.product_price && (
                            <p className="text-xs text-slate-500 dark:text-gray-400">
                              Price: ₹{loan.product_price.toLocaleString('en-IN')}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {(loan as any).referral_code ? (
                        <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200 text-xs font-medium" title={(loan as any).referral_code}>
                          Referred
                          <span className="font-mono">{String((loan as any).referral_code).slice(0,8)}…</span>
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs">Direct</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <button
                          onClick={() => setSelectedLoan(loan)}
                          className="text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 font-medium"
                        >
                          {loan.first_name} {loan.last_name}
                        </button>
                        <div className="mt-1 text-xs text-slate-500 dark:text-gray-400 space-y-1">
                          <div className="flex items-center gap-1">
                            <span>{maskEmail(loan.email_id)}</span>
                            <Lock size={10} className="text-amber-500" />
                          </div>
                          <div className="flex items-center gap-1">
                            <span>{maskMobile(loan.mobile_primary)}</span>
                            <Lock size={10} className="text-amber-500" />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        ₹{loan.loan_amount.toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-700 dark:text-gray-300">{loan.tenure} months</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-700 dark:text-gray-300">
                        ₹{loan.processing_fee.toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(loan.status)}`}
                        title={`Status updated: ${new Date(loan.updated_at).toLocaleString()}`}
                      >
                        {loan.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {docsSet.has(loan.id) ? (
                        <button
                          onClick={() => setShowDocsFor(loan)}
                          className="inline-flex items-center space-x-2 px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 text-xs"
                        >
                          <span>View Docs</span>
                        </button>
                      ) : loan.status === 'Accepted' ? (
                        <span className="inline-flex px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 text-xs">Pending</span>
                      ) : loan.status === 'Rejected' ? (
                        <span className="inline-flex px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs">N/A</span>
                      ) : (
                        <span className="inline-flex px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-700 dark:text-gray-300">
                        {new Date(loan.created_at).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedLoan(loan)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div className="text-sm text-slate-600 dark:text-gray-400">
                Showing {start + 1} to {Math.min(end, filteredLoans.length)} of {filteredLoans.length} loans
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-slate-300 dark:border-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-slate-700 dark:text-gray-300">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-slate-300 dark:border-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedLoan && (
        <ProductLoanDetailsModal
          loan={selectedLoan}
          onClose={() => setSelectedLoan(null)}
        />
      )}

      {productInfoLoan && (
        <ProductInfoModal
          loan={productInfoLoan}
          onClose={() => setProductInfoLoan(null)}
        />
      )}

      {showDocsFor && (
        <DocsModal
          loanId={showDocsFor.id}
          fullName={`${showDocsFor.first_name} ${showDocsFor.last_name}`}
          onClose={() => setShowDocsFor(null)}
          loanType="product"
        />
      )}
    </div>
  );
}

function ProductInfoModal({ loan, onClose }: { loan: ProductLoan; onClose: () => void }) {
  const imgSrc = loan.product_image_url || '/placeholder-product.png';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Product Information</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="p-6 space-y-4 text-sm text-slate-800 dark:text-gray-100">
          <div className="flex items-center gap-4">
            <img
              src={imgSrc}
              alt={loan.product_name}
              className="w-20 h-20 rounded object-cover border border-gray-200 dark:border-gray-700"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder-product.png';
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate" title={loan.product_name}>{loan.product_name}</p>
              {loan.product_price && (
                <p className="mt-1">Price: <span className="font-medium">₹{loan.product_price.toLocaleString('en-IN')}</span></p>
              )}
              {loan.product_category && (
                <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">Category: {loan.product_category}</p>
              )}
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-gray-400">
            <p>Application ID: {loan.id}</p>
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Product Loan Details Modal for Merchant
function ProductLoanDetailsModal({ loan, onClose }: { loan: ProductLoan; onClose: () => void }) {
  const maskEmail = (email: string) => {
    const [local, domain] = email.split('@');
    if (local.length <= 3) return `${local[0]}***@${domain}`;
    return `${local.substring(0, 1)}***@${domain}`;
  };

  const maskMobile = (mobile: string) => {
    if (mobile.length <= 4) return '****';
    return `*******${mobile.slice(-2)}`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Product Loan Details</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <Eye size={24} className="rotate-180" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Applicant Information</h3>
              <div className="space-y-2 text-sm">
                <p><span className="text-slate-600 dark:text-gray-400">Name:</span> <span className="font-medium">{loan.first_name} {loan.last_name}</span></p>
                <p><span className="text-slate-600 dark:text-gray-400">Email:</span> <span className="font-medium flex items-center gap-1">
                  {maskEmail(loan.email_id)}
                  <Lock size={12} className="text-amber-500" />
                </span></p>
                <p><span className="text-slate-600 dark:text-gray-400">Mobile:</span> <span className="font-medium flex items-center gap-1">
                  {maskMobile(loan.mobile_primary)}
                  <Lock size={12} className="text-amber-500" />
                </span></p>
                <p><span className="text-slate-600 dark:text-gray-400">Address:</span> <span className="font-medium">{loan.address}</span></p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Loan Information</h3>
              <div className="space-y-2 text-sm">
                <p><span className="text-slate-600 dark:text-gray-400">Loan Amount:</span> <span className="font-medium">₹{loan.loan_amount.toLocaleString('en-IN')}</span></p>
                <p><span className="text-slate-600 dark:text-gray-400">Tenure:</span> <span className="font-medium">{loan.tenure} months</span></p>
                <p><span className="text-slate-600 dark:text-gray-400">Processing Fee:</span> <span className="font-medium">₹{loan.processing_fee.toLocaleString('en-IN')}</span></p>
                <p><span className="text-slate-600 dark:text-gray-400">Status:</span> <span className="font-medium">{loan.status}</span></p>
                {(loan as any).referral_code && (
                  <p><span className="text-slate-600 dark:text-gray-400">Referral Code:</span> <span className="font-medium">{(loan as any).referral_code}</span></p>
                )}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Product Information</h3>
              <div className="space-y-2 text-sm">
                <p><span className="text-slate-600 dark:text-gray-400">Product:</span> <span className="font-medium">{loan.product_name}</span></p>
                <p><span className="text-slate-600 dark:text-gray-400">Price:</span> <span className="font-medium">₹{loan.product_price.toLocaleString('en-IN')}</span></p>
                {loan.product_category && (
                  <p><span className="text-slate-600 dark:text-gray-400">Category:</span> <span className="font-medium">{loan.product_category}</span></p>
                )}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Timeline</h3>
              <div className="space-y-2 text-sm">
                <p><span className="text-slate-600 dark:text-gray-400">Applied At:</span> <span className="font-medium">{new Date(loan.created_at).toLocaleString('en-IN')}</span></p>
                <p><span className="text-slate-600 dark:text-gray-400">Last Updated:</span> <span className="font-medium">{new Date(loan.updated_at).toLocaleString('en-IN')}</span></p>
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-slate-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
