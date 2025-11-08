import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface NbfcProfile {
  nbfc_id: string;
  name: string;
  interest_rate: number;
  approval_type: string;
  processing_fee: number;
}

type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export default function NbfcSelect() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ncfcs, setNbfcs] = useState<NbfcProfile[]>([]);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile) return;
      if (profile.role !== 'merchant') {
        navigate('/dashboard', { replace: true });
        return;
      }
      try {
        // If already tied up, or latest request is approved, send to dashboard
        try {
          const { data: tie, error: tieErr } = await supabase
            .from('nbfc_tieups')
            .select('merchant_id')
            .eq('merchant_id', profile.id)
            .maybeSingle();
          if (!cancelled && !tieErr && tie) {
            navigate('/dashboard', { replace: true });
            return;
          }
        } catch (_) {}
        try {
          const { data: req } = await supabase
            .from('nbfc_tieup_requests')
            .select('status')
            .eq('merchant_id', profile.id)
            .order('requested_at', { ascending: false })
            .maybeSingle();
          if (!cancelled && req?.status === 'approved') {
            navigate('/dashboard', { replace: true });
            return;
          }
        } catch (_) {}

        const { data, error } = await supabase
          .from('nbfc_profiles')
          .select('nbfc_id,name,interest_rate,approval_type,processing_fee')
          .order('name');
        if (error) throw error;
        if (!cancelled) setNbfcs(data || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load NBFCs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.role]);

  const requestTieUp = async (nbfc: NbfcProfile) => {
    if (!profile) return;
    setError(null);
    setRequesting(nbfc.nbfc_id);
    try {
      // Create or upsert a pending request if not already pending/approved
      const payload = {
        merchant_id: profile.id,
        nbfc_id: nbfc.nbfc_id,
        admin_id: nbfc.nbfc_id, // NBFC admin user id equals nbfc_id
        status: 'pending' as RequestStatus,
        requested_at: new Date().toISOString(),
        responded_at: null,
        reason: null,
      };

      const { error } = await supabase
        .from('nbfc_tieup_requests')
        .upsert(payload, { onConflict: 'merchant_id,nbfc_id' });
      if (error) throw error;

      // Admin dashboard notification (best-effort)
      try {
        await supabase.from('admin_notifications').insert({
          admin_id: nbfc.nbfc_id,
          type: 'merchant_request',
          title: 'Merchant tie-up request',
          message: `${profile.username || profile.id} requested to connect with ${nbfc.name}`,
          payload: { merchant_id: profile.id, merchant_name: profile.username, nbfc_id: nbfc.nbfc_id, nbfc_name: nbfc.name },
        });
      } catch (_) {}

      navigate('/dashboard', { replace: true });
    } catch (e: any) {
      setError(e?.message || 'Failed to create tie-up request');
    } finally {
      setRequesting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading NBFCs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">Select an NBFC</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">Choose your financing partner to continue.</p>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200">{error}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ncfcs.map((n) => (
            <div key={n.nbfc_id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{n.name}</h3>
              <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                <p>Interest: <span className="font-medium">{n.interest_rate}% p.a</span></p>
                <p>Processing Fee: <span className="font-medium">₹{n.processing_fee}</span></p>
                <p>Approval ETA: <span className="font-medium">{n.approval_type}</span></p>
              </div>
              <div className="mt-4">
                <button onClick={() => requestTieUp(n)} disabled={requesting === n.nbfc_id}
                  className={`px-4 py-2 rounded-lg text-white ${requesting === n.nbfc_id ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {requesting === n.nbfc_id ? 'Requesting...' : 'Continue'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
