import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// Gate for merchants: require an approved tie-up to access NBFC-dependent features
export default function TieUpGate({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [state, setState] = useState<'none'|'pending'|'approved'|'rejected'|'cancelled'>('none');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile || profile.role !== 'merchant') { setChecking(false); return; }
      try {
        // If final tie-up exists with valid admin and nbfc, allow
        const { data: tie, error: tieErr } = await supabase
          .from('nbfc_tieups')
          .select('merchant_id, admin:user_profiles!nbfc_tieups_admin_id_fkey(id), nbfc:nbfc_profiles!nbfc_tieups_nbfc_id_fkey(nbfc_id)')
          .eq('merchant_id', profile.id)
          .maybeSingle();
        if (!cancelled && tie && !tieErr && tie.admin && tie.nbfc) {
          setState('approved');
          setChecking(false);
          return;
        }
        // Else check requests
        const { data: req, error: reqErr } = await supabase
          .from('nbfc_tieup_requests')
          .select('id,status,reason')
          .eq('merchant_id', profile.id)
          .order('requested_at', { ascending: false })
          .maybeSingle();
        if (!cancelled) {
          if (!reqErr && req) {
            setRequestId(String(req.id));
            setState(req.status as any);
            setReason(req.reason || null);
          } else {
            setState('none');
          }
        }
      } catch (_) {
        setState('none');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.role]);

  // Strict gate: if merchant has no tie-up and no request, force NBFC selection
  useEffect(() => {
    if (!checking && profile?.role === 'merchant' && state === 'none' && location.pathname !== '/nbfc/select') {
      navigate('/nbfc/select', { replace: true });
    }
  }, [checking, state, profile?.role, location.pathname, navigate]);

  const cancelRequest = async () => {
    if (!requestId) return;
    setCancelling(true);
    try {
      const { error } = await supabase
        .from('nbfc_tieup_requests')
        .update({ status: 'cancelled', responded_at: new Date().toISOString() })
        .eq('id', requestId);
      if (!error) setState('cancelled');
    } finally {
      setCancelling(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Checking NBFC tie-up status...</p>
        </div>
      </div>
    );
  }

  if (profile?.role === 'merchant') {
    if (state === 'approved') return <>{children}</>;
    if (location.pathname === '/nbfc/select') return <>{children}</>;

    // Blocked states UI
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          {state === 'pending' && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Request sent — awaiting NBFC admin approval</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-2">You cannot access NBFC-dependent features until approval.</p>
              <div className="mt-4 flex gap-3">
                <button onClick={() => navigate('/nbfc/select')} className="px-4 py-2 rounded bg-gray-100 dark:bg-gray-700">Choose another NBFC</button>
                <button onClick={cancelRequest} disabled={cancelling} className={`px-4 py-2 rounded text-white ${cancelling?'bg-red-400':'bg-red-600 hover:bg-red-700'}`}>{cancelling ? 'Cancelling...' : 'Cancel request'}</button>
              </div>
            </>
          )}
          {state === 'rejected' && (
            <>
              <h2 className="text-xl font-semibold text-red-700">Request rejected</h2>
              {reason && <p className="text-gray-600 dark:text-gray-400 mt-2">Reason: {reason}</p>}
              <div className="mt-4 flex gap-3">
                <button onClick={() => navigate('/nbfc/select')} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Choose another NBFC</button>
                <button onClick={() => navigate('/dashboard')} className="px-4 py-2 rounded bg-gray-100 dark:bg-gray-700">Go to dashboard</button>
              </div>
            </>
          )}
          {state === 'cancelled' && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Request cancelled</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-2">Select a different NBFC to continue.</p>
              <div className="mt-4">
                <button onClick={() => navigate('/nbfc/select')} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Go to NBFC selection</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
