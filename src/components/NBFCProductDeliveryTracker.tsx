import { useEffect, useMemo, useState } from 'react';
import { Eye, AlertCircle, CheckCircle, Clock, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ProductDeliveryTracker {
  id: string;
  merchant_id: string;
  merchant_name: string;
  merchant_email?: string;
  merchant_phone?: string;
  merchant_business_type?: string;
  merchant_owner_name?: string;
  merchant_address?: string;
  customer_name: string;
  product_name: string;
  loan_amount: number;
  tenure: number;
  product_price: number;
  disbursed_date: string;
  product_delivered_date?: string;
  product_delivery_status: string;
  loan_status: string;
  created_at: string;
  updated_at: string;
}

export default function NBFCProductDeliveryTracker() {
  const { profile } = useAuth();
  const [loans, setLoans] = useState<ProductDeliveryTracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    if (profile) {
      fetchProductDeliveries();
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const ch = supabase
      .channel('nbfc-delivery-tracker')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_loans' }, () => fetchProductDeliveries())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [profile]);

  const fetchProductDeliveries = async () => {
    if (!profile) return;
    try {
      setLoading(true);

      // STEP 1: Get approved tie-ups for this NBFC only
      const { data: tieups, error: tieupsError } = await supabase
        .from('nbfc_tieup_requests')
        .select('merchant_id')
        .eq('nbfc_id', profile.id)
        .eq('status', 'approved');

      if (tieupsError) throw tieupsError;

      const tiedMerchantIds = tieups?.map(t => t.merchant_id) || [];

      // If no tied-up merchants, show empty state
      if (tiedMerchantIds.length === 0) {
        setLoans([]);
        setLoading(false);
        return;
      }

      // STEP 2: Get product loans ONLY from tied-up merchants
      const { data: productLoansData, error: productLoansError } = await supabase
        .from('product_loans')
        .select('*')
        .in('user_id', tiedMerchantIds) // ← NEW: Only tied-up merchants
        .eq('status', 'Loan Disbursed')
        .order('updated_at', { ascending: false });

      if (productLoansError) throw productLoansError;

      // STEP 3: Get merchant details for tied-up merchants
      const { data: merchantProfiles, error: merchantError } = await supabase
        .from('merchant_profiles')
        .select('merchant_id, business_name, owner_name, email, phone, business_type, business_category, address')
        .in('merchant_id', tiedMerchantIds); // ← NEW: Filter by tied-up merchants

      if (merchantError) throw merchantError;

      let merchantMap: Record<string, any> = {};
      if (merchantProfiles) {
        merchantProfiles.forEach(mp => {
          merchantMap[mp.merchant_id] = {
            business_name: mp.business_name,
            owner_name: mp.owner_name,
            email: mp.email,
            phone: mp.phone,
            business_type: mp.business_type,
            business_category: mp.business_category,
            address: mp.address
          };
        });
      }

      const rows = (productLoansData || []).map(loan => ({
        id: loan.id,
        merchant_id: loan.merchant_id || loan.user_id,
        merchant_name: merchantMap[loan.user_id]?.business_name || 'Unknown Merchant',
        merchant_email: merchantMap[loan.user_id]?.email || '',
        merchant_phone: merchantMap[loan.user_id]?.phone || '',
        merchant_business_type: merchantMap[loan.user_id]?.business_type || '',
        merchant_owner_name: merchantMap[loan.user_id]?.owner_name || '',
        merchant_address: merchantMap[loan.user_id]?.address || '',
        customer_name: `${loan.first_name} ${loan.last_name}`,
        product_name: loan.product_name,
        loan_amount: loan.loan_amount,
        tenure: loan.tenure,
        product_price: loan.product_price,
        disbursed_date: loan.created_at,
        product_delivered_date: loan.product_delivered_date || null,
        product_delivery_status: loan.product_delivery_status || 'Pending',
        loan_status: loan.status,
        created_at: loan.created_at,
        updated_at: loan.updated_at,
      }));

      setLoans(rows);
    } catch (error) {
      console.error('Error fetching product deliveries:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLoans = useMemo(() => {
    let filtered = loans;

    if (deliveryFilter !== 'all') {
      filtered = filtered.filter(l =>
        deliveryFilter === 'delivered'
          ? l.product_delivered_date !== null
          : l.product_delivered_date === null
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(l =>
        l.customer_name.toLowerCase().includes(q) ||
        l.merchant_name.toLowerCase().includes(q) ||
        l.product_name.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [loans, search, deliveryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLoans.length / pageSize));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = filteredLoans.slice(start, end);

  const deliveredCount = loans.filter(l => l.product_delivered_date !== null).length;
  const pendingCount = loans.filter(l => l.product_delivered_date === null).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-slate-600 dark:text-gray-400">Total Disbursed</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{loans.length}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <span className="text-sm text-slate-600 dark:text-gray-400">Pending Delivery</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{pendingCount}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-sm text-slate-600 dark:text-gray-400">Delivered</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{deliveredCount}</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer, merchant, product, or loan ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex gap-3">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <select
              value={deliveryFilter}
              onChange={(e) => {
                setDeliveryFilter(e.target.value);
                setPage(1);
              }}
              className="pl-10 pr-4 py-3 border border-slate-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer"
            >
              <option value="all">All Deliveries</option>
              <option value="pending">Pending Delivery</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-gray-700 border-b border-slate-200 dark:border-gray-700">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Merchant</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Customer</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Product</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Amount</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Tenure</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Disbursed Date</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Product Delivery Status</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-700 dark:text-white">Delivered Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
              {pageItems.map((loan) => (
                <tr key={loan.id} className="hover:bg-slate-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="py-4 px-6">
                    <span className="font-medium text-slate-900 dark:text-white">{loan.merchant_name}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-slate-900 dark:text-white">{loan.customer_name}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-slate-700 dark:text-gray-300">{loan.product_name}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-medium text-slate-900 dark:text-white">₹{loan.loan_amount.toLocaleString('en-IN')}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-slate-700 dark:text-gray-300">{loan.tenure} months</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-slate-700 dark:text-gray-300">
                      {new Date(loan.disbursed_date).toLocaleDateString('en-IN')}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    {loan.product_delivered_date ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle size={14} />
                        Delivered
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                        <AlertCircle size={14} />
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    {loan.product_delivered_date ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        <Eye size={12} />
                        {new Date(loan.product_delivered_date).toLocaleDateString('en-IN')}
                      </span>
                    ) : (
                      <span className="text-slate-500 dark:text-gray-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-600 dark:text-gray-300">
                    No disbursed loans found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredLoans.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-600 dark:text-gray-400">
            Showing {Math.min(start + 1, filteredLoans.length)}–{Math.min(end, filteredLoans.length)} of {filteredLoans.length}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-2 rounded border bg-white dark:bg-gray-800 dark:border-gray-700 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-2 text-slate-700 dark:text-gray-300 text-sm">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-2 rounded border bg-white dark:bg-gray-800 dark:border-gray-700 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
