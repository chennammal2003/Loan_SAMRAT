import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface OrderRow {
  id: string;
  user_id: string;
  merchant_id: string | null;
  total: number;
  status: string;
  created_at?: string | null;
}

export default function MerchantOrders() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<'all' | 'backorders' | 'failed' | 'archived'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [query, setQuery] = useState('');
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<'created_at' | 'total' | 'status'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!profile) return;
        // Expect orders table with merchant_id column; fallback to empty
        const { data, error } = await supabase
          .from('orders')
          .select('id,user_id,merchant_id,total,status,created_at')
          .eq('merchant_id', profile.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setRows((data as any[]) as OrderRow[]);
      } catch (e: any) {
        setError(e?.message || 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    })();
  }, [profile?.id]);

  const allStatuses = [
    'All',
    'Order Placed',
    'Order Shipped',
    'Order Delivered',
    'On Hold',
    'Preparing For Despatch',
    'Awaiting Pickup',
    'Order Canceled',
    'Delivered',
    'Shipped',
    'Returns Initiated',
    'Returned',
    'Refund Initiated',
    'Completed',
    'Failed',
    'Back Ordered',
    'Archived',
  ];

  const sectionFilterFn = (r: OrderRow) => {
    if (section === 'backorders') return /back\s*order/i.test(r.status) || /back\s*ordered/i.test(r.status);
    if (section === 'failed') return /fail/i.test(r.status);
    if (section === 'archived') return /archive/i.test(r.status);
    return true; // all
  };

  const statusFilterFn = (r: OrderRow) => {
    if (statusFilter === 'All') return true;
    return r.status?.toLowerCase() === statusFilter.toLowerCase();
  };

  const queryFilterFn = (r: OrderRow) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      r.id.toLowerCase().includes(q) ||
      r.status?.toLowerCase().includes(q)
    );
  };

  const filtered = rows
    .filter(sectionFilterFn)
    .filter(statusFilterFn)
    .filter(queryFilterFn)
    .sort((a, b) => {
      let aVal: any = a[sortKey];
      let bVal: any = b[sortKey];
      if (sortKey === 'created_at') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const setSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setSection('all'); setStatusFilter('All'); }} className={`px-3 py-1 rounded-md border ${section==='all'?'bg-blue-600 text-white border-blue-600':'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>Orders</button>
            <button onClick={() => { setSection('backorders'); setStatusFilter('All'); }} className={`px-3 py-1 rounded-md border ${section==='backorders'?'bg-blue-600 text-white border-blue-600':'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>Back Orders</button>
            <button onClick={() => { setSection('failed'); setStatusFilter('All'); }} className={`px-3 py-1 rounded-md border ${section==='failed'?'bg-blue-600 text-white border-blue-600':'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>Failed Orders</button>
            <button onClick={() => { setSection('archived'); setStatusFilter('All'); }} className={`px-3 py-1 rounded-md border ${section==='archived'?'bg-blue-600 text-white border-blue-600':'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>Archived</button>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 dark:text-gray-400">Per Page</label>
            <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} className="px-2 py-1 rounded-md border bg-white dark:bg-gray-800">
              {[10,20,50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <input placeholder="Search (ID, Status)" value={query} onChange={(e)=> { setQuery(e.target.value); setPage(1); }} className="px-3 py-1 rounded-md border bg-white dark:bg-gray-800" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {allStatuses.map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1 rounded-full text-sm border ${statusFilter===s?'bg-blue-600 text-white border-blue-600':'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div>Loading…</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : (
          <>
            <div className="overflow-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="text-left px-3 py-2 cursor-pointer" onClick={() => setSort('created_at')}>Order ID</th>
                    <th className="text-left px-3 py-2 cursor-pointer" onClick={() => setSort('total')}>Total</th>
                    <th className="text-left px-3 py-2 cursor-pointer" onClick={() => setSort('status')}>Status</th>
                    <th className="text-left px-3 py-2 cursor-pointer" onClick={() => setSort('created_at')}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2">{r.id}</td>
                      <td className="px-3 py-2">₹{(r.total || 0).toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2">{r.status}</td>
                      <td className="px-3 py-2">{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && (
                    <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={4}>No orders</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Page {currentPage} of {totalPages} • {filtered.length} result(s)</div>
              <div className="flex gap-2">
                <button className="px-3 py-1 border rounded disabled:opacity-50" onClick={()=> setPage(1)} disabled={currentPage===1}>First</button>
                <button className="px-3 py-1 border rounded disabled:opacity-50" onClick={()=> setPage(p => Math.max(1, p-1))} disabled={currentPage===1}>Prev</button>
                <button className="px-3 py-1 border rounded disabled:opacity-50" onClick={()=> setPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages}>Next</button>
                <button className="px-3 py-1 border rounded disabled:opacity-50" onClick={()=> setPage(totalPages)} disabled={currentPage===totalPages}>Last</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

