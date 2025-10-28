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

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Orders</h1>
        {loading ? (
          <div>Loading…</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : (
          <div className="overflow-auto border rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="text-left px-3 py-2">Order ID</th>
                  <th className="text-left px-3 py-2">Total</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{r.id}</td>
                    <td className="px-3 py-2">₹{(r.total || 0).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2">{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={4}>No orders</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
