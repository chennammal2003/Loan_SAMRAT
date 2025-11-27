 import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Row {
  merchant_id: string;
  created_at: string;
  merchant?: { username?: string|null } | null;
}

export default function AdminActiveTieUps() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [merchantMap, setMerchantMap] = useState<Record<string, { business_name?: string|null; owner_name?: string|null; email?: string|null; phone?: string|null; address?: string|null; age?: number|null; business_type?: string|null; business_category?: string|null; gst_number?: string|null; pan_number?: string|null; bank_name?: string|null; account_number?: string|null; ifsc_code?: string|null; upi_id?: string|null }>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile || profile.role !== 'admin') { setLoading(false); return; }
      try {
        const { data, error } = await supabase
          .from('nbfc_tieups')
          .select('merchant_id,created_at, merchant:user_profiles!nbfc_tieups_merchant_id_fkey(username)')
          .eq('admin_id', profile.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        const list = (data || []) as any[];
        if (!cancelled) setRows(list as any);
        // batch merchant profiles
        try {
          const ids = Array.from(new Set(list.map(r => r.merchant_id)));
          if (ids.length) {
            const { data: mrows } = await supabase
              .from('merchant_profiles')
              .select('merchant_id,business_name,owner_name,email,phone,address,age,business_type,business_category,gst_number,pan_number,bank_name,account_number,ifsc_code,upi_id')
              .in('merchant_id', ids);
            const map: Record<string, any> = {};
            (mrows || []).forEach((m: any) => { map[m.merchant_id] = { business_name: m.business_name, owner_name: m.owner_name, email: m.email, phone: m.phone, address: m.address, age: m.age, business_type: m.business_type, business_category: m.business_category, gst_number: m.gst_number, pan_number: m.pan_number, bank_name: m.bank_name, account_number: m.account_number, ifsc_code: m.ifsc_code, upi_id: m.upi_id }; });
            if (!cancelled) setMerchantMap(map);
          }
        } catch (_) {}
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load active tie-ups');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.role]);

  if (loading) return null;
  if (error) return <div className="p-3 rounded bg-red-50 text-red-700 border border-red-200">{error}</div>;
  if (!rows.length) return null;

  return (
    <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-200">Active Tie-Ups</h3>
      </div>
      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.merchant_id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 flex items-center justify-between">
            <div className="flex-1 pr-4">
              <div className="font-medium text-gray-900 dark:text-white">{r.merchant?.username || r.merchant_id}</div>
              <div className="text-xs text-gray-500">Approved on {new Date(r.created_at).toLocaleDateString()}</div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="rounded bg-gray-50 dark:bg-gray-900 p-2 border border-gray-200 dark:border-gray-700">
                  <div className="text-gray-500 dark:text-gray-400">Business</div>
                  <div className="font-medium" title={merchantMap[r.merchant_id]?.business_name || ''}>{merchantMap[r.merchant_id]?.business_name || '-'}</div>
                </div>
                <div className="rounded bg-gray-50 dark:bg-gray-900 p-2 border border-gray-200 dark:border-gray-700">
                  <div className="text-gray-500 dark:text-gray-400">Owner</div>
                  <div className="font-medium">{merchantMap[r.merchant_id]?.owner_name || '-'}</div>
                </div>
                <div className="rounded bg-gray-50 dark:bg-gray-900 p-2 border border-gray-200 dark:border-gray-700">
                  <div className="text-gray-500 dark:text-gray-400">Email</div>
                  <div className="font-medium truncate" title={merchantMap[r.merchant_id]?.email || ''}>{merchantMap[r.merchant_id]?.email || '-'}</div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setViewId(r.merchant_id)} className="px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">View Merchant Details</button>
            </div>
          </div>
        ))}
      </div>

      {viewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setViewId(null)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Merchant Details</h4>
              <button onClick={() => setViewId(null)} className="px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-700">Close</button>
            </div>
            <table className="w-full text-sm">
              <tbody>
                <tr><td className="py-1 pr-3 text-gray-500">Business</td><td className="py-1 font-medium text-gray-900 dark:text-white">{merchantMap[viewId]?.business_name || '-'}</td></tr>
                <tr><td className="py-1 pr-3 text-gray-500">Owner</td><td className="py-1 font-medium text-gray-900 dark:text-white">{merchantMap[viewId]?.owner_name || '-'}</td></tr>
                <tr><td className="py-1 pr-3 text-gray-500">Email</td><td className="py-1 font-medium text-gray-900 dark:text-white">{merchantMap[viewId]?.email || '-'}</td></tr>
                <tr><td className="py-1 pr-3 text-gray-500">Phone</td><td className="py-1 font-medium text-gray-900 dark:text-white">{merchantMap[viewId]?.phone || '-'}</td></tr>
                <tr><td className="py-1 pr-3 text-gray-500">Address</td><td className="py-1 font-medium text-gray-900 dark:text-white">{merchantMap[viewId]?.address || '-'}</td></tr>
                <tr><td className="py-1 pr-3 text-gray-500">Age</td><td className="py-1 font-medium text-gray-900 dark:text-white">{merchantMap[viewId]?.age ?? '-'}</td></tr>
                <tr><td className="py-1 pr-3 text-gray-500">Business Type</td><td className="py-1 font-medium text-gray-900 dark:text-white">{merchantMap[viewId]?.business_type || '-'}</td></tr>
                <tr><td className="py-1 pr-3 text-gray-500">Business Category</td><td className="py-1 font-medium text-gray-900 dark:text-white">{merchantMap[viewId]?.business_category || '-'}</td></tr>
                <tr><td className="py-1 pr-3 text-gray-500">GST Number</td><td className="py-1 font-medium text-gray-900 dark:text-white">{merchantMap[viewId]?.gst_number || '-'}</td></tr>
                <tr><td className="py-1 pr-3 text-gray-500">PAN Number</td><td className="py-1 font-medium text-gray-900 dark:text-white">{merchantMap[viewId]?.pan_number || '-'}</td></tr>
                <tr><td className="py-1 pr-3 text-gray-500">Bank Name</td><td className="py-1 font-medium text-gray-900 dark:text-white">{merchantMap[viewId]?.bank_name || '-'}</td></tr>
                <tr><td className="py-1 pr-3 text-gray-500">Account Number</td><td className="py-1 font-medium text-gray-900 dark:text-white">{merchantMap[viewId]?.account_number || '-'}</td></tr>
                <tr><td className="py-1 pr-3 text-gray-500">IFSC Code</td><td className="py-1 font-medium text-gray-900 dark:text-white">{merchantMap[viewId]?.ifsc_code || '-'}</td></tr>
                <tr><td className="py-1 pr-3 text-gray-500">UPI ID</td><td className="py-1 font-medium text-gray-900 dark:text-white">{merchantMap[viewId]?.upi_id || '-'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
