import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Row {
  id: string;
  merchant_id: string;
  nbfc_id: string;
  admin_id: string;
  status: 'pending'|'approved'|'rejected'|'cancelled';
  requested_at: string;
  responded_at: string | null;
  reason: string | null;
  merchant?: { username: string; email: string } | null;
}

export default function AdminTieUps() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, { interest_rate: string; duration_months: string; terms_text: string }>>({});
  const [tieDetails, setTieDetails] = useState<Record<string, { interest_rate: number|null; duration_months: number|null; terms_text: string|null; created_at: string }>>({});
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
  const [nbfcDefaults, setNbfcDefaults] = useState<{ interest_rate?: number|null; default_tenure?: number|null; approval_type?: string|null } | null>(null);
  const isAdmin = profile?.role === 'admin';
  const [approveRow, setApproveRow] = useState<Row | null>(null);
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralMsg, setReferralMsg] = useState<string>('');
  const [savingApprove, setSavingApprove] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isAdmin) { setLoading(false); return; }
      try {
        // Load NBFC defaults for this admin
        try {
          const { data: nbfc } = await supabase
            .from('nbfc_profiles')
            .select('interest_rate,default_tenure,approval_type')
            .eq('nbfc_id', profile!.id)
            .maybeSingle();
          if (!cancelled) setNbfcDefaults({ interest_rate: nbfc?.interest_rate ?? null, default_tenure: nbfc?.default_tenure ?? null, approval_type: nbfc?.approval_type ?? null });
        } catch (_) {}
        const { data, error } = await supabase
          .from('nbfc_tieup_requests')
          .select('id,merchant_id,nbfc_id,admin_id,status,requested_at,responded_at,reason, merchant:user_profiles!nbfc_tieup_requests_merchant_id_fkey(username,email)')
          .eq('admin_id', profile!.id)
          .order('requested_at', { ascending: false });
        if (error) throw error;
        const reqs: Row[] = ((data || []) as any[]).map((r: any) => ({
          id: r.id,
          merchant_id: r.merchant_id,
          nbfc_id: r.nbfc_id,
          admin_id: r.admin_id,
          status: r.status,
          requested_at: r.requested_at,
          responded_at: r.responded_at,
          reason: r.reason,
          merchant: Array.isArray(r.merchant) ? (r.merchant[0] || null) : (r.merchant || null),
        }));
        if (!cancelled) setRows(reqs as any);
        // Batch fetch tie-up details for approved rows
        const approvedMerchantIds = reqs.filter(r => r.status === 'approved').map(r => r.merchant_id);
        if (approvedMerchantIds.length) {
          try {
            // Try extended fields first
            let tiesRes: any = await supabase
              .from('nbfc_tieups')
              .select('merchant_id,interest_rate,duration_months,terms_text,created_at')
              .eq('admin_id', profile!.id)
              .in('merchant_id', approvedMerchantIds);
            if (tiesRes.error) {
              // Retry minimal fields if optional columns don't exist
              tiesRes = await supabase
                .from('nbfc_tieups')
                .select('merchant_id,created_at')
                .eq('admin_id', profile!.id)
                .in('merchant_id', approvedMerchantIds);
            }
            const map: Record<string, any> = {};
            (tiesRes.data || []).forEach((t: any) => { map[t.merchant_id] = { interest_rate: t.interest_rate ?? null, duration_months: t.duration_months ?? null, terms_text: t.terms_text ?? null, created_at: t.created_at }; });
            if (!cancelled) setTieDetails(map);
          } catch (_) {}
        }
        // Batch load merchant details for modal
        try {
          const merchantIds = Array.from(new Set(reqs.map(r => r.merchant_id)));
          if (merchantIds.length) {
            const { data: mrows } = await supabase
              .from('merchant_profiles')
              .select('merchant_id,business_name,owner_name,email,phone,address,age,business_type,business_category,gst_number,pan_number,bank_name,account_number,ifsc_code,upi_id')
              .in('merchant_id', merchantIds);
            const mmap: Record<string, any> = {};
            (mrows || []).forEach((m: any) => {
              mmap[m.merchant_id] = {
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
            if (!cancelled) setMerchantMap(mmap);
          }
        } catch (_) {}
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load requests');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, isAdmin]);

  const act = async (row: Row, approve: boolean) => {
    setActingId(row.id);
    try {
      const status = approve ? 'approved' : 'rejected';
      const { error } = await supabase
        .from('nbfc_tieup_requests')
        .update({ status, responded_at: new Date().toISOString(), reason: approve ? null : 'Rejected by admin' })
        .eq('id', row.id);
      if (error) throw error;

      if (approve) {
        const f = form[row.id] || { interest_rate: '', duration_months: '', terms_text: '' };
        const payload: any = {
          merchant_id: row.merchant_id,
          nbfc_id: row.nbfc_id,
          admin_id: row.admin_id,
          created_at: new Date().toISOString(),
          interest_rate: f.interest_rate ? Number(f.interest_rate) : (nbfcDefaults?.interest_rate ?? null),
          duration_months: f.duration_months ? Number(f.duration_months) : (nbfcDefaults?.default_tenure ?? null),
          terms_text: f.terms_text || null,
        };
        // Try with extended columns; on error, retry minimal
        let insErr = (await supabase.from('nbfc_tieups').insert(payload)).error;
        if (insErr) {
          insErr = (await supabase
            .from('nbfc_tieups')
            .insert({ merchant_id: row.merchant_id, nbfc_id: row.nbfc_id, admin_id: row.admin_id, created_at: new Date().toISOString() })
          ).error;
        }
        if (insErr) throw insErr;
      }

      try {
        await supabase.from('notifications').insert({
          user_id: row.merchant_id,
          type: approve ? 'tieup_approved' : 'tieup_rejected',
          payload: { nbfc_id: row.nbfc_id, admin_id: row.admin_id, reason: approve ? undefined : 'Rejected by admin' },
        });
      } catch (_) {}

      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status, responded_at: new Date().toISOString(), reason: approve ? null : 'Rejected by admin' } : r));
    } catch (e: any) {
      setError(e?.message || 'Failed to update request');
    } finally {
      setActingId(null);
    }
  };

  const genCode = (name: string, id: string) => {
    const base = (name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const suffix = id.slice(0, 4).toUpperCase();
    return `${base}-${suffix}`;
  };

  const openApproveModal = (row: Row) => {
    const name = rows.find(r => r.id === row.id)?.merchant?.username || row.merchant_id;
    setReferralCode(genCode(name as string, row.merchant_id));
    setReferralMsg('Use this referral code for all applications.');
    setApproveRow(row);
  };

  const confirmApprove = async () => {
    if (!approveRow) return;
    setSavingApprove(true);
    try {
      const row = approveRow;
      const { error: updErr } = await supabase
        .from('nbfc_tieup_requests')
        .update({ status: 'approved', responded_at: new Date().toISOString(), reason: null })
        .eq('id', row.id);
      if (updErr) throw updErr;

      const f = form[row.id] || { interest_rate: '', duration_months: '', terms_text: '' };
      const payload: any = {
        merchant_id: row.merchant_id,
        nbfc_id: row.nbfc_id,
        admin_id: row.admin_id,
        created_at: new Date().toISOString(),
        interest_rate: f.interest_rate ? Number(f.interest_rate) : (nbfcDefaults?.interest_rate ?? null),
        duration_months: f.duration_months ? Number(f.duration_months) : (nbfcDefaults?.default_tenure ?? null),
        terms_text: f.terms_text || null,
      };
      let insErr = (await supabase.from('nbfc_tieups').insert(payload)).error;
      if (insErr) {
        insErr = (await supabase
          .from('nbfc_tieups')
          .insert({ merchant_id: row.merchant_id, nbfc_id: row.nbfc_id, admin_id: row.admin_id, created_at: new Date().toISOString() })
        ).error;
      }
      if (insErr) throw insErr;

      try {
        await supabase
          .from('merchant_profiles')
          .upsert({ merchant_id: row.merchant_id, referral_code: referralCode, referral_message: referralMsg }, { onConflict: 'merchant_id' });
      } catch (_) {}

      try {
        await supabase.from('notifications').insert({
          user_id: row.merchant_id,
          type: 'tieup_approved',
          payload: { nbfc_id: row.nbfc_id, admin_id: row.admin_id, referral_code: referralCode, referral_message: referralMsg },
        });
      } catch (_) {}

      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'approved', responded_at: new Date().toISOString(), reason: null } : r));
      setApproveRow(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to approve request');
    } finally {
      setSavingApprove(false);
    }
  };

  if (!isAdmin) return null;

  if (loading) {
    return (
      <div className="p-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">NBFC Tie-up Requests</h1>
      {error && <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200">{error}</div>}
      <div className="space-y-3">
        {rows.length === 0 && <p className="text-gray-600 dark:text-gray-400">No requests yet.</p>}
        {rows.map(r => (
          <div key={r.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex items-center justify-between">
            <div className="flex-1 pr-4">
              <div className="font-medium text-gray-900 dark:text-white">{r.merchant?.username || r.merchant_id}</div>
              <div className="text-sm text-gray-500">Requested: {new Date(r.requested_at).toLocaleString()}</div>
              <div className="text-sm">Status: <span className="font-medium capitalize">{r.status}</span></div>
              {/* Inline merchant details preview */}
              {merchantMap[r.merchant_id] && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="rounded bg-gray-50 dark:bg-gray-900 p-2 border border-gray-200 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400">Business</div>
                    <div className="font-medium">{merchantMap[r.merchant_id]?.business_name || '-'}</div>
                  </div>
                  <div className="rounded bg-gray-50 dark:bg-gray-900 p-2 border border-gray-200 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400">Owner</div>
                    <div className="font-medium">{merchantMap[r.merchant_id]?.owner_name || '-'}</div>
                  </div>
                  <div className="rounded bg-gray-50 dark:bg-gray-900 p-2 border border-gray-200 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400">Email</div>
                    <div className="font-medium">{merchantMap[r.merchant_id]?.email || '-'}</div>
                  </div>
                  <div className="rounded bg-gray-50 dark:bg-gray-900 p-2 border border-gray-200 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400">Phone</div>
                    <div className="font-medium">{merchantMap[r.merchant_id]?.phone || '-'}</div>
                  </div>
                  <div className="rounded bg-gray-50 dark:bg-gray-900 p-2 border border-gray-200 dark:border-gray-700 md:col-span-2">
                    <div className="text-gray-500 dark:text-gray-400">Address</div>
                    <div className="font-medium truncate" title={merchantMap[r.merchant_id]?.address || ''}>{merchantMap[r.merchant_id]?.address || '-'}</div>
                  </div>
                  <div className="rounded bg-gray-50 dark:bg-gray-900 p-2 border border-gray-200 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400">Age</div>
                    <div className="font-medium">{merchantMap[r.merchant_id]?.age ?? '-'}</div>
                  </div>
                  <div className="rounded bg-gray-50 dark:bg-gray-900 p-2 border border-gray-200 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400">Business Type</div>
                    <div className="font-medium">{merchantMap[r.merchant_id]?.business_type || '-'}</div>
                  </div>
                  <div className="rounded bg-gray-50 dark:bg-gray-900 p-2 border border-gray-200 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400">Business Category</div>
                    <div className="font-medium">{merchantMap[r.merchant_id]?.business_category || '-'}</div>
                  </div>
                  <div className="rounded bg-gray-50 dark:bg-gray-900 p-2 border border-gray-200 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400">GST Number</div>
                    <div className="font-medium">{merchantMap[r.merchant_id]?.gst_number || '-'}</div>
                  </div>
                  <div className="rounded bg-gray-50 dark:bg-gray-900 p-2 border border-gray-200 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400">PAN Number</div>
                    <div className="font-medium">{merchantMap[r.merchant_id]?.pan_number || '-'}</div>
                  </div>
                  <div className="rounded bg-gray-50 dark:bg-gray-900 p-2 border border-gray-200 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400">Bank Name</div>
                    <div className="font-medium">{merchantMap[r.merchant_id]?.bank_name || '-'}</div>
                  </div>
                  <div className="rounded bg-gray-50 dark:bg-gray-900 p-2 border border-gray-200 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400">Account Number</div>
                    <div className="font-medium">{merchantMap[r.merchant_id]?.account_number || '-'}</div>
                  </div>
                  <div className="rounded bg-gray-50 dark:bg-gray-900 p-2 border border-gray-200 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400">IFSC Code</div>
                    <div className="font-medium">{merchantMap[r.merchant_id]?.ifsc_code || '-'}</div>
                  </div>
                  <div className="rounded bg-gray-50 dark:bg-gray-900 p-2 border border-gray-200 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400">UPI ID</div>
                    <div className="font-medium">{merchantMap[r.merchant_id]?.upi_id || '-'}</div>
                  </div>
                </div>
              )}
              {r.status === 'approved' && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                  <div className="rounded bg-gray-50 dark:bg-gray-900 p-2 border border-gray-200 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400">Approved On</div>
                    <div className="font-medium">{(tieDetails[r.merchant_id]?.created_at ? new Date(tieDetails[r.merchant_id].created_at).toLocaleDateString() : (r.responded_at ? new Date(r.responded_at).toLocaleDateString() : '-'))}</div>
                  </div>
                  <div className="rounded bg-gray-50 dark:bg-gray-900 p-2 border border-gray-200 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400">Interest Rate</div>
                    <div className="font-medium">{tieDetails[r.merchant_id]?.interest_rate != null ? `${tieDetails[r.merchant_id].interest_rate}% p.a` : '-'}</div>
                  </div>
                  <div className="rounded bg-gray-50 dark:bg-gray-900 p-2 border border-gray-200 dark:border-gray-700">
                    <div className="text-gray-500 dark:text-gray-400">Duration</div>
                    <div className="font-medium">{tieDetails[r.merchant_id]?.duration_months != null ? `${tieDetails[r.merchant_id].duration_months} months` : '-'}</div>
                  </div>
                  <div className="rounded bg-gray-50 dark:bg-gray-900 p-2 border border-gray-200 dark:border-gray-700 md:col-span-1">
                    <div className="text-gray-500 dark:text-gray-400">Terms</div>
                    <div className="font-medium truncate" title={tieDetails[r.merchant_id]?.terms_text || ''}>{tieDetails[r.merchant_id]?.terms_text || '-'}</div>
                  </div>
                </div>
              )}
              {r.status === 'pending' && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Interest Rate (% p.a)"
                    className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
                    value={form[r.id]?.interest_rate || (nbfcDefaults?.interest_rate != null ? String(nbfcDefaults.interest_rate) : '')}
                    onChange={(e) => setForm(prev => ({ ...prev, [r.id]: { ...(prev[r.id]||{interest_rate:'',duration_months:'',terms_text:''}), interest_rate: e.target.value } }))}
                  />
                  <input
                    type="number"
                    placeholder="Duration (months)"
                    className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
                    value={form[r.id]?.duration_months || (nbfcDefaults?.default_tenure != null ? String(nbfcDefaults.default_tenure) : '')}
                    onChange={(e) => setForm(prev => ({ ...prev, [r.id]: { ...(prev[r.id]||{interest_rate:'',duration_months:'',terms_text:''}), duration_months: e.target.value } }))}
                  />
                  <input
                    type="text"
                    placeholder="Loan terms (optional)"
                    className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
                    value={form[r.id]?.terms_text || ''}
                    onChange={(e) => setForm(prev => ({ ...prev, [r.id]: { ...(prev[r.id]||{interest_rate:'',duration_months:'',terms_text:''}), terms_text: e.target.value } }))}
                  />
                </div>
              )}
              {nbfcDefaults && r.status === 'pending' && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                  <span className="inline-block mr-2 px-2 py-1 rounded border border-blue-300 bg-blue-50 dark:bg-blue-900/20">Default Interest: {nbfcDefaults.interest_rate != null ? `${nbfcDefaults.interest_rate}% p.a` : '-'}</span>
                  <span className="inline-block mr-2 px-2 py-1 rounded border border-blue-300 bg-blue-50 dark:bg-blue-900/20">Default Duration: {nbfcDefaults.default_tenure != null ? `${nbfcDefaults.default_tenure} months` : '-'}</span>
                  <span className="inline-block px-2 py-1 rounded border border-blue-300 bg-blue-50 dark:bg-blue-900/20">Approval Type: {nbfcDefaults.approval_type || '-'}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setViewId(r.merchant_id)} className="px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">View Merchant Details</button>
              <button onClick={() => openApproveModal(r)} disabled={actingId === r.id || r.status !== 'pending'} className={`px-3 py-1.5 rounded text-white ${actingId===r.id?'bg-green-400':'bg-green-600 hover:bg-green-700'} disabled:opacity-50`}>Approve</button>
              <button onClick={() => act(r, false)} disabled={actingId === r.id || r.status !== 'pending'} className={`px-3 py-1.5 rounded text-white ${actingId===r.id?'bg-red-400':'bg-red-600 hover:bg-red-700'} disabled:opacity-50`}>Reject</button>
            </div>
          </div>
        ))}
      </div>
      {approveRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setApproveRow(null)} />
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
              <button onClick={()=>setApproveRow(null)} className="px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-700">Cancel</button>
              <button onClick={confirmApprove} disabled={savingApprove} className={`px-3 py-1.5 rounded text-white ${savingApprove?'bg-blue-400':'bg-blue-600 hover:bg-blue-700'}`}>{savingApprove?'Saving...':'Approve'}</button>
            </div>
          </div>
        </div>
      )}
      {viewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setViewId(null)} />
          <div className="relative w-full max-w-3xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6">
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
