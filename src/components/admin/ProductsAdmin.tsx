import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface ProductRow {
  id: string;
  name: string;
  price: number | null;
  category: string | null;
  image_url: string | null;
  created_at?: string | null;
  is_active?: boolean | null;
}

export default function ProductsAdmin() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id,name,price,category,image_url,created_at,is_active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRows((data as any[]) as ProductRow[]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const toggleActive = async (p: ProductRow) => {
    try {
      const next = !p.is_active;
      const { error } = await supabase.from('products').update({ is_active: next }).eq('id', p.id);
      if (error) throw error;
      setRows((prev) => prev.map((r) => (r.id === p.id ? { ...r, is_active: next } : r)));
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Products</h1>
          <button onClick={fetchRows} className="px-3 py-2 rounded border">Refresh</button>
        </div>
        {loading ? (
          <div>Loading…</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : (
          <div className="overflow-auto border rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="text-left px-3 py-2">Product</th>
                  <th className="text-left px-3 py-2">Category</th>
                  <th className="text-left px-3 py-2">Price</th>
                  <th className="text-left px-3 py-2">Active</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <img src={r.image_url || ''} alt={r.name} className="w-10 h-10 rounded object-cover" />
                        <div>
                          <div className="font-semibold">{r.name}</div>
                          <div className="text-xs text-gray-500">{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">{r.category || '-'}</td>
                    <td className="px-3 py-2">{r.price != null ? `₹${r.price.toLocaleString('en-IN')}` : '-'}</td>
                    <td className="px-3 py-2">
                      <button className="px-2 py-1 rounded border" onClick={() => toggleActive(r)}>{r.is_active ? 'Active' : 'Inactive'}</button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={4}>No products</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
