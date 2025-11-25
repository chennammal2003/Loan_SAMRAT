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
  const [approveItem, setApproveItem] = useState<PendingRequestCard | null>(null);
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralMsg, setReferralMsg] = useState<string>('');
  const [savingApprove, setSavingApprove] = useState(false);
  // No terms inputs required; only merchant details with Approve/Reject
  const [merchantMap, setMerchantMap] = useState<Record<string, {
    business_name?: string|null;
    owner_name?: string|null;
    email?: string|null;
    phone?: string|null;
    address?: string|null;
    age?: number|null;
    business_type?: string|null;
    business_category?: string|null;
    gst_number?: string|null;
    pan_number?: string|null;
    bank_name?: string|null;
    account_number?: string|null;
    ifsc_code?: string|null;
    upi_id?: string|null;
  }>>({});
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
        // Batch load merchant business details to show in card and modal
        try {
          const merchantIds = Array.from(new Set(out.map(o => o.payload.merchant_id).filter(Boolean))) as string[];
          if (merchantIds.length) {
            const { data: mrows } = await supabase
              .from('merchant_profiles')
              .select('merchant_id,business_name,owner_name,email,phone,address,age,business_type,business_category,gst_number,pan_number,bank_name,account_number,ifsc_code,upi_id')
              .in('merchant_id', merchantIds);
            const map: Record<string, any> = {};
            (mrows || []).forEach((m: any) => {
              map[m.merchant_id] = {
                business_name: m.business_name,
                owner_name: m.owner_name,
                email: m.email,
                phone: m.phone,
                address: m.address,
                age: m.age,
                business_type: m.business_type,
                business_category: m.business_category,
                gst_number: m.gst_number,
                pan_number: m.pan_number,
                bank_name: m.bank_name,
                account_number: m.account_number,
                ifsc_code: m.ifsc_code,
                upi_id: m.upi_id,
              };
            });
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

  const genCode = (name: string | undefined | null, id: string) => {
    const base = (name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'REF';
    const suffix = id.slice(0, 4).toUpperCase();
    return `${base}-${suffix}`;
  };

  const openApproveModal = (n: PendingRequestCard) => {
    const mname = n.payload.merchant_name || merchantMap[n.payload.merchant_id || '']?.owner_name || n.payload.merchant_id;
    setReferralCode(genCode(mname, n.payload.merchant_id));
    setReferralMsg('Use this referral code for all applications.');
    setApproveItem(n);
  };

  const confirmApprove = async () => {
    if (!profile || !approveItem) return;
    const n = approveItem;
    setSavingApprove(true);
    try {
      const { error: updErr } = await supabase
        .from('nbfc_tieup_requests')
        .update({ status: 'approved', responded_at: new Date().toISOString(), reason: null })
        .match({ merchant_id: n.payload.merchant_id, nbfc_id: n.payload.nbfc_id, admin_id: profile.id });
      if (updErr) throw updErr;

      const { error: insErr } = await supabase
        .from('nbfc_tieups')
        .insert({ merchant_id: n.payload.merchant_id, nbfc_id: n.payload.nbfc_id, admin_id: profile.id, created_at: new Date().toISOString() });
      if (insErr) throw insErr;

      // Save referral to merchant profile (best-effort, use upsert so row is created if missing)
      try {
        await supabase
          .from('merchant_profiles')
          .upsert({ merchant_id: n.payload.merchant_id, referral_code: referralCode, referral_message: referralMsg }, { onConflict: 'merchant_id' });
      } catch (_) {}

      try {
        await supabase.from('notifications').insert({
          user_id: n.payload.merchant_id,
          type: 'tieup_approved',
          payload: { nbfc_id: n.payload.nbfc_id, admin_id: profile.id, referral_code: referralCode, referral_message: referralMsg },
        });
      } catch (_) {}

      try { await supabase.from('admin_notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', n.id); } catch (_) {}

      setItems(prev => prev.filter(x => x.id !== n.id));
      setApproveItem(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to approve request');
    } finally {
      setSavingApprove(false);
    }
  };

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
        <div key={n.id} className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-100 p-4 shadow-sm">
          <div className="text-sm">
            Merchant <span className="font-semibold">{n.payload?.merchant_name || n.payload.merchant_id}</span> requested to connect with <span className="font-medium">{n.payload?.nbfc_name || 'your NBFC'}</span>
          </div>
          <div className="text-xs text-blue-800 dark:text-blue-300 mt-1">Received at {new Date(n.created_at).toLocaleTimeString()}</div>

          {/* Merchant business details */}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div className="rounded bg-white dark:bg-gray-800 p-2 border border-blue-200 dark:border-blue-800">
              <div className="text-gray-500 dark:text-gray-400">Business</div>
              <div className="font-medium text-gray-900 dark:text-white">{merchantMap[n.payload.merchant_id || '']?.business_name || '-'}</div>
            </div>
            <div className="rounded bg-white dark:bg-gray-800 p-2 border border-blue-200 dark:border-blue-800">
              <div className="text-gray-500 dark:text-gray-400">Owner</div>
              <div className="font-medium text-gray-900 dark:text-white">{merchantMap[n.payload.merchant_id || '']?.owner_name || '-'}</div>
            </div>
            <div className="rounded bg-white dark:bg-gray-800 p-2 border border-blue-200 dark:border-blue-800">
              <div className="text-gray-500 dark:text-gray-400">Email</div>
              <div className="font-medium text-gray-900 dark:text-white truncate">{merchantMap[n.payload.merchant_id || '']?.email || '-'}</div>
            </div>
            <div className="rounded bg-white dark:bg-gray-800 p-2 border border-blue-200 dark:border-blue-800">
              <div className="text-gray-500 dark:text-gray-400">Phone</div>
              <div className="font-medium text-gray-900 dark:text-white">{merchantMap[n.payload.merchant_id || '']?.phone || '-'}</div>
            </div>
          </div>

          {/* No rate/duration/terms inputs per requirement */}

          <div className="mt-3 flex gap-2">
            <button onClick={() => setViewId(n.payload.merchant_id)} className="px-3 py-1.5 rounded bg-white dark:bg-gray-800 text-blue-900 dark:text-blue-100 border border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-gray-700">View Merchant Details</button>
            <button onClick={() => openApproveModal(n)} disabled={acting === n.id} className={`px-3 py-1.5 rounded text-white ${acting===n.id?'bg-green-400':'bg-green-600 hover:bg-green-700'}`}>Approve</button>
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

      {approveItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setApproveItem(null)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Approve & Generate Referral Code</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300">Referral Code</label>
                <input value={referralCode} onChange={(e)=>setReferralCode(e.target.value)} className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-300">Important Message</label>
                <textarea value={referralMsg} onChange={(e)=>setReferralMsg(e.target.value)} rows={3} className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2" />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">This code and message will be saved to the merchant profile and sent in a notification.</div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={()=>setApproveItem(null)} className="px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-700">Cancel</button>
              <button onClick={confirmApprove} disabled={savingApprove} className={`px-3 py-1.5 rounded text-white ${savingApprove?'bg-blue-400':'bg-blue-600 hover:bg-blue-700'}`}>{savingApprove?'Saving...':'Approve'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
