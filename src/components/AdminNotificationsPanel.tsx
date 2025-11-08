import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface PendingRequestCard {
  id: string;
  created_at: string;
  payload: { merchant_id: string; merchant_name?: string | null; nbfc_id: string; nbfc_name?: string | null };
}

export default function AdminNotificationsPanel() {
  const { profile } = useAuth();
  const [items, setItems] = useState<PendingRequestCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  // No terms inputs required; only merchant details with Approve/Reject
  const [merchantMap, setMerchantMap] = useState<Record<string, { business_name?: string|null; owner_name?: string|null; email?: string|null; phone?: string|null }>>({});
  const [viewId, setViewId] = useState<string | null>(null);
  // No NBFC defaults shown in this panel

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile || !['admin','nbfc_admin'].includes(profile.role as any)) { setLoading(false); return; }
      try {
        const out: PendingRequestCard[] = [];
        // 1) Prefer notifications if available
        try {
          const { data } = await supabase
            .from('admin_notifications')
            .select('*')
            .eq('admin_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(20);
          (data || []).forEach((n: any) => {
            if (n.type === 'merchant_request') {
              out.push({ id: n.id, created_at: n.created_at, payload: { merchant_id: n.payload?.merchant_id, merchant_name: n.payload?.merchant_name, nbfc_id: n.payload?.nbfc_id, nbfc_name: n.payload?.nbfc_name } });
            }
          });
        } catch (_) {}

        // 2) Also fetch live pending requests directly (fallback / supplement)
        try {
          const { data: reqs } = await supabase
            .from('nbfc_tieup_requests')
            .select('id,requested_at,merchant_id,nbfc_id, status, merchant:user_profiles!nbfc_tieup_requests_merchant_id_fkey(username), nbfc:nbfc_profiles!nbfc_tieup_requests_nbfc_id_fkey(name)')
            .eq('admin_id', profile.id)
            .eq('status', 'pending')
            .order('requested_at', { ascending: false });
          (reqs || []).forEach((r: any) => {
            // Avoid duplicates if also present as notification
            if (!out.some(x => x.payload.merchant_id === r.merchant_id && x.payload.nbfc_id === r.nbfc_id)) {
              out.push({ id: r.id, created_at: r.requested_at, payload: { merchant_id: r.merchant_id, merchant_name: r.merchant?.username, nbfc_id: r.nbfc_id, nbfc_name: r.nbfc?.name } });
            }
          });
        } catch (_) {}

        if (!cancelled) setItems(out);
        // Batch load merchant business details to show in card
        try {
          const merchantIds = Array.from(new Set(out.map(o => o.payload.merchant_id).filter(Boolean))) as string[];
          if (merchantIds.length) {
            const { data: mrows } = await supabase
              .from('merchant_profiles')
              .select('merchant_id,business_name,owner_name,email,phone')
              .in('merchant_id', merchantIds);
            const map: Record<string, any> = {};
            (mrows || []).forEach((m: any) => { map[m.merchant_id] = { business_name: m.business_name, owner_name: m.owner_name, email: m.email, phone: m.phone }; });
            if (!cancelled) setMerchantMap(map);
          }
        } catch (_) {}
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load notifications');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.role]);

  const actOnRequest = async (n: PendingRequestCard, approve: boolean) => {
    if (!profile) return;
    if (!n.payload?.merchant_id || !n.payload?.nbfc_id) return;
    setActing(n.id);
    try {
      const status = approve ? 'approved' : 'rejected';
      // Update request
      const { error: updErr } = await supabase
        .from('nbfc_tieup_requests')
        .update({ status, responded_at: new Date().toISOString(), reason: approve ? null : 'Rejected by admin' })
        .match({ merchant_id: n.payload.merchant_id, nbfc_id: n.payload.nbfc_id, admin_id: profile.id });
      if (updErr) throw updErr;
      // Insert tie-up if approved
      if (approve) {
        const { error: insErr } = await supabase
          .from('nbfc_tieups')
          .insert({ merchant_id: n.payload.merchant_id, nbfc_id: n.payload.nbfc_id, admin_id: profile.id, created_at: new Date().toISOString() });
        if (insErr) throw insErr;
      }
      // Mark notification as read (best-effort)
      try { await supabase.from('admin_notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', n.id); } catch (_) {}
      // Update UI
      setItems(prev => prev.filter(x => x.id !== n.id));
    } catch (e: any) {
      setError(e?.message || 'Failed to update request');
    } finally {
      setActing(null);
    }
  };

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">NBFC Admin Dashboard</h2>
      {error && <div className="p-3 rounded bg-red-50 text-red-700 border border-red-200">{error}</div>}
      {items.map(n => (
        <div key={n.id} className="rounded-xl border border-blue-200 bg-blue-50 text-blue-900 p-4 shadow-sm">
          <div className="text-sm">
            Merchant <span className="font-semibold">{n.payload?.merchant_name || n.payload.merchant_id}</span> requested to connect with <span className="font-medium">{n.payload?.nbfc_name || 'your NBFC'}</span>
          </div>
          <div className="text-xs text-blue-800 mt-1">Received at {new Date(n.created_at).toLocaleTimeString()}</div>

          {/* Merchant business details */}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div className="rounded bg-white p-2 border border-blue-200">
              <div className="text-gray-500">Business</div>
              <div className="font-medium text-gray-900">{merchantMap[n.payload.merchant_id || '']?.business_name || '-'}</div>
            </div>
            <div className="rounded bg-white p-2 border border-blue-200">
              <div className="text-gray-500">Owner</div>
              <div className="font-medium text-gray-900">{merchantMap[n.payload.merchant_id || '']?.owner_name || '-'}</div>
            </div>
            <div className="rounded bg-white p-2 border border-blue-200">
              <div className="text-gray-500">Email</div>
              <div className="font-medium text-gray-900 truncate">{merchantMap[n.payload.merchant_id || '']?.email || '-'}</div>
            </div>
            <div className="rounded bg-white p-2 border border-blue-200">
              <div className="text-gray-500">Phone</div>
              <div className="font-medium text-gray-900">{merchantMap[n.payload.merchant_id || '']?.phone || '-'}</div>
            </div>
          </div>

          {/* No rate/duration/terms inputs per requirement */}

          <div className="mt-3 flex gap-2">
            <button onClick={() => setViewId(n.payload.merchant_id)} className="px-3 py-1.5 rounded bg-white text-blue-900 border border-blue-300 hover:bg-blue-100">View Merchant Details</button>
            <button onClick={() => actOnRequest(n, true)} disabled={acting === n.id} className={`px-3 py-1.5 rounded text-white ${acting===n.id?'bg-green-400':'bg-green-600 hover:bg-green-700'}`}>Approve</button>
            <button onClick={() => actOnRequest(n, false)} disabled={acting === n.id} className={`px-3 py-1.5 rounded text-white ${acting===n.id?'bg-red-400':'bg-red-600 hover:bg-red-700'}`}>Reject</button>
          </div>
        </div>
      ))}

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
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
