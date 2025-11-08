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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile || profile.role !== 'merchant') { setLoading(false); return; }
      try {
        const { data, error } = await supabase
          .from('nbfc_tieups')
          .select('id,merchant_id,nbfc_id,admin_id,interest_rate,duration_months,terms_text,created_at, nbfc:nbfc_profiles!nbfc_tieups_nbfc_id_fkey(name), admin:user_profiles!nbfc_tieups_admin_id_fkey(username,email)')
          .eq('merchant_id', profile.id)
          .maybeSingle();
        if (error) throw error;
        if (!cancelled) setRow(data as any);
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
        <button onClick={() => setShowAdmin(true)} className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">View Admin Details</button>
      </div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div className="rounded bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-gray-500 dark:text-gray-400">Interest Rate</div>
          <div className="font-medium text-gray-900 dark:text-white">{row.interest_rate != null ? `${row.interest_rate}% p.a` : '-'}</div>
        </div>
        <div className="rounded bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-gray-500 dark:text-gray-400">Duration</div>
          <div className="font-medium text-gray-900 dark:text-white">{row.duration_months != null ? `${row.duration_months} months` : '-'}</div>
        </div>
        <div className="rounded bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-gray-500 dark:text-gray-400">Loan Terms</div>
          <div className="font-medium text-gray-900 dark:text-white truncate">{row.terms_text || '-'}</div>
        </div>
      </div>

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
                    <tr><td className="py-1 pr-3 text-gray-500">Processing Fee</td><td className="py-1 font-medium text-gray-900 dark:text-white">{/* optional; shown if available via a separate query in parent */}-</td></tr>
                    <tr><td className="py-1 pr-3 text-gray-500">Approval Type</td><td className="py-1 font-medium text-gray-900 dark:text-white">-</td></tr>
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
