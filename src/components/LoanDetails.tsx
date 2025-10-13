import React, { useEffect, useMemo, useState } from 'react';
import { Eye, FileText } from 'lucide-react';
import { supabase, LoanApplication } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import LoanDetailsModal from './LoanDetailsModal';

interface LoanDetailsProps {
  initialStatusFilter?: 'All' | 'Pending' | 'Accepted' | 'Rejected';
}

export default function LoanDetails({ initialStatusFilter = 'All' }: LoanDetailsProps) {
  const { profile } = useAuth();
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Accepted' | 'Rejected'>(initialStatusFilter);
  const [page, setPage] = useState(1);
  const pageSize = 7;

  useEffect(() => {
    if (profile) {
      fetchLoans();
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const ch = supabase
      .channel(`loans-merchant-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'loans', filter: `user_id=eq.${profile.id}` }, (payload) => {
        const l = payload.new as any;
        setLoans((prev) => (prev.some((x) => x.id === l.id) ? prev : [l as any, ...prev]));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'loans', filter: `user_id=eq.${profile.id}` }, (payload) => {
        const l = payload.new as any;
        setLoans((prev) => prev.map((x) => (x.id === l.id ? (l as any) : x)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'loans', filter: `user_id=eq.${profile.id}` }, (payload) => {
        const id = (payload.old as any).id;
        setLoans((prev) => prev.filter((x) => x.id !== id));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [profile]);

  const fetchLoans = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('loans')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLoans(data || []);
    } catch (error) {
      console.error('Error fetching loans:', error);
    } finally {
      setLoading(false);
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

  // Reset to first page when filters/search change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const total = filteredLoans.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = filteredLoans.slice(start, end);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Accepted':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'Rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (loans.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Loan Applications</h3>
        <p className="text-gray-600 dark:text-gray-400">You haven't submitted any loan applications yet.</p>
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
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, email, address, ID"
          className="w-full md:w-80 px-3 py-2 rounded border bg-white dark:bg-gray-800 dark:border-gray-700 text-sm"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          name="loan-search"
        />
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
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
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
                    {loan.address.substring(0, 30)}...
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    ₹{loan.loan_amount.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {loan.tenure} months
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(loan.status)}`}>
                      {loan.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedLoan(loan)}
                      className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="text-sm">View Details</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredLoans.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-6 text-center text-sm text-gray-500 dark:text-gray-400">No results</td>
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
        />
      )}
    </div>
  );
}
