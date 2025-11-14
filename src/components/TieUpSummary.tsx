import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface TieUpRow {
  id: string;
  merchant_id: string;
  nbfc_id: string;
  admin_id: string;
  interest_rate: number | null;
  duration_months: number | null;
  terms_text: string | null;
  created_at: string;
  nbfc?: { name: string } | null;
  admin?: { username: string; email: string } | null;
}

export default function TieUpSummary() {
  const { profile } = useAuth();
  const [row, setRow] = useState<TieUpRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralMsg, setReferralMsg] = useState<string>('');
  const genCode = (name: string | undefined | null, id: string) => {
    const base = (name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'REF';
    const suffix = (id || '').slice(0, 4).toUpperCase();
    return `${base}-${suffix}`;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile || profile.role !== 'merchant') { setLoading(false); return; }
      try {
        const { data, error } = await supabase
          .from('nbfc_tieups')
          .select('id,merchant_id,nbfc_id,admin_id,interest_rate,duration_months,terms_text,created_at, nbfc:nbfc_profiles!nbfc_tieups_nbfc_id_fkey(name,interest_rate,processing_fee,approval_type), admin:user_profiles!nbfc_tieups_admin_id_fkey(username,email)')
          .eq('merchant_id', profile.id)
          .maybeSingle();
        if (error) throw error;
        if (!cancelled) setRow(data as any);
        // Load referral code and message from merchant profile
        try {
          const { data: m } = await supabase
            .from('merchant_profiles')
            .select('referral_code,referral_message')
            .eq('merchant_id', profile.id)
            .maybeSingle();
          if (!cancelled) {
            setReferralCode((m as any)?.referral_code || '');
            setReferralMsg((m as any)?.referral_message || '');
          }
        } catch (_) {}

        // Fallback: read from latest approval notification if profile fields are empty
        if (!cancelled && (!referralCode || !referralMsg)) {
          try {
            const { data: notes } = await supabase
              .from('notifications')
              .select('payload, created_at')
              .eq('user_id', profile.id)
              .eq('type', 'tieup_approved')
              .order('created_at', { ascending: false })
              .limit(1);
            const p = (notes && notes[0]?.payload) || null;
            if (p) {
              if (!referralCode && (p as any).referral_code) setReferralCode((p as any).referral_code);
              if (!referralMsg && (p as any).referral_message) setReferralMsg((p as any).referral_message);
            }
          } catch (_) {}
        }

        // Display-only suggestion if still empty
        if (!cancelled && !referralCode) {
          const suggestion = genCode(profile.username, profile.id);
          setReferralCode(suggestion);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load tie-up');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.role]);

  if (loading) return null;
  if (error || !row) return null;

  return (
    <div className="rounded-xl border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">You are tied up with NBFC {row.nbfc?.name || row.nbfc_id}</h3>
          <p className="text-sm text-green-900/80 dark:text-green-300/80">Approved on {new Date(row.created_at).toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-3">
          {referralCode && (
            <div className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200 text-sm font-semibold border border-indigo-200 dark:border-indigo-700">
              Your Referral Code: {referralCode}
            </div>
          )}
          <button onClick={() => setShowAdmin(true)} className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">View Admin Details</button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div className="rounded bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-gray-500 dark:text-gray-400">Admin Name</div>
          <div className="font-medium text-gray-900 dark:text-white">{row.admin?.username || row.admin_id}</div>
        </div>
        <div className="rounded bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-gray-500 dark:text-gray-400">Admin Email</div>
          <div className="font-medium text-gray-900 dark:text-white truncate">{row.admin?.email || '-'}</div>
        </div>
        <div className="rounded bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-gray-500 dark:text-gray-400">Interest Rate</div>
          <div className="font-medium text-gray-900 dark:text-white truncate">{row.nbfc && (row.nbfc as any).interest_rate != null ? `${(row.nbfc as any).interest_rate}% p.a` : '-'}</div>
        </div>
      </div>

      {referralMsg && (
        <div className="mt-3 text-xs text-gray-700 dark:text-gray-300">
          {referralMsg}
        </div>
      )}

      {showAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAdmin(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">NBFC Admin</h4>
              <button onClick={() => setShowAdmin(false)} className="px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-700">Close</button>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <h5 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">NBFC</h5>
                <table className="w-full">
                  <tbody>
                    <tr><td className="py-1 pr-3 text-gray-500">Name</td><td className="py-1 font-medium text-gray-900 dark:text-white">{row.nbfc?.name || row.nbfc_id}</td></tr>
                    <tr><td className="py-1 pr-3 text-gray-500">Processing Fee</td><td className="py-1 font-medium text-gray-900 dark:text-white">{row.nbfc && (row.nbfc as any).processing_fee != null ? `${(row.nbfc as any).processing_fee}` : '-'}</td></tr>
                    <tr><td className="py-1 pr-3 text-gray-500">Approval Type</td><td className="py-1 font-medium text-gray-900 dark:text-white">{row.nbfc && (row.nbfc as any).approval_type ? (row.nbfc as any).approval_type : '-'}</td></tr>
                  </tbody>
                </table>
              </div>
              <div>
                <h5 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Admin</h5>
                <table className="w-full">
                  <tbody>
                    <tr><td className="py-1 pr-3 text-gray-500">Name</td><td className="py-1 font-medium text-gray-900 dark:text-white">{row.admin?.username || row.admin_id}</td></tr>
                    <tr><td className="py-1 pr-3 text-gray-500">Email</td><td className="py-1 font-medium text-gray-900 dark:text-white">{row.admin?.email || '-'}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
