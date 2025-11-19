import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import PendingVerificationPage from './PendingVerificationPage';

// Gate for merchants: require an approved tie-up to access NBFC-dependent features
export default function TieUpGate({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [state, setState] = useState<'none'|'pending'|'approved'|'rejected'|'cancelled'>('none');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [adminContact, setAdminContact] = useState<{ name?: string|null; email?: string|null; phone?: string|null } | null>(null);
  const [hasMerchantProfile, setHasMerchantProfile] = useState<boolean | null>(null);
  const [merchantProfileData, setMerchantProfileData] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile || profile.role !== 'merchant') { setChecking(false); return; }
      // If merchant is not yet approved by Super Admin, first check if their merchant profile exists.
      // New merchants can complete their profile but must wait for Super Admin approval before NBFC selection.
      if (profile.is_active === false) {
        const { data: mp, error: mpErr } = await supabase
          .from('merchant_profiles')
          .select('*')
          .eq('merchant_id', profile.id)
          .maybeSingle();
        if (cancelled) return;
        if (!mpErr && mp) {
          setHasMerchantProfile(true);
          setMerchantProfileData(mp);
          // Stay on dashboard where the pending page will be shown by this gate below
          setState('none');
          setChecking(false);
          return;
        } else {
          setHasMerchantProfile(false);
          setMerchantProfileData(null);
          // Allow them to finish profile inside dashboard without extra checks
          setState('none');
          setChecking(false);
          return;
        }
      }
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
        // Mark that a profile effectively exists for gating purposes if we haven't already
        if (hasMerchantProfile === null) setHasMerchantProfile(true);
        // Else check requests
        const { data: req, error: reqErr } = await supabase
          .from('nbfc_tieup_requests')
          .select('id,status,reason, admin:user_profiles!nbfc_tieup_requests_admin_id_fkey(id,username,full_name,email,mobile,phone)')
          .eq('merchant_id', profile.id)
          .order('requested_at', { ascending: false })
          .maybeSingle();
        if (!cancelled) {
          if (!reqErr && req) {
            setRequestId(String(req.id));
            setState(req.status as any);
            setReason(req.reason || null);
            const a = Array.isArray((req as any).admin) ? (req as any).admin[0] : (req as any).admin;
            if (a) setAdminContact({ name: a.full_name || a.username || null, email: a.email || null, phone: a.mobile || a.phone || null } as any);
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
  }, [profile?.id, profile?.role, profile?.is_active]);

  // Strict gate: if merchant is active and has no tie-up and no request, force NBFC selection
  useEffect(() => {
    if (
      !checking &&
      profile?.role === 'merchant' &&
      profile.is_active !== false &&
      state === 'none' &&
      location.pathname !== '/nbfc/select'
    ) {
      navigate('/nbfc/select', { replace: true });
    }
  }, [checking, state, profile?.is_active, profile?.role, location.pathname, navigate]);

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
    // If merchant is inactive and their merchant profile exists, show
    // the Profile Under Review page while they wait for Super Admin approval.
    if (profile.is_active === false && hasMerchantProfile === true) {
      return (
        <PendingVerificationPage
          userType="merchant"
          profileData={{
            business_name: merchantProfileData?.business_name,
            owner_name: merchantProfileData?.owner_name,
            email: merchantProfileData?.email,
            phone: merchantProfileData?.phone,
          }}
        />
      );
    }

    // If merchant is inactive but their merchant profile does NOT yet exist,
    // allow them into the dashboard so they can complete profile.
    if (profile.is_active === false && hasMerchantProfile === false) {
      return <>{children}</>;
    }

    if (state === 'approved') return <>{children}</>;
    // Only allow access to NBFC selection when merchant is active
    if (location.pathname === '/nbfc/select' && profile.is_active === true) return <>{children}</>;

    // Blocked states UI
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          {state === 'pending' && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Request sent — awaiting NBFC admin approval</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-2">You cannot access NBFC-dependent features until approval.</p>
              {adminContact && (adminContact.name || adminContact.email || adminContact.phone) && (
                <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 text-sm">
                  <p className="text-gray-700 dark:text-gray-200 font-medium mb-1">NBFC Admin Contact:</p>
                  {adminContact.name && (
                    <p className="text-gray-600 dark:text-gray-300">Name: <span className="font-medium">{adminContact.name}</span></p>
                  )}
                  {adminContact.email && (
                    <p className="text-gray-600 dark:text-gray-300">Email: <span className="font-medium">{adminContact.email}</span></p>
                  )}
                  {adminContact.phone && (
                    <p className="text-gray-600 dark:text-gray-300">Mobile: <span className="font-medium">{adminContact.phone}</span></p>
                  )}
                </div>
              )}
              <div className="mt-4 flex gap-3 flex-wrap">
                <button onClick={() => navigate('/nbfc/select')} className="px-4 py-2 rounded bg-gray-100 dark:bg-gray-700">Choose another NBFC</button>
                <button onClick={cancelRequest} disabled={cancelling} className={`px-4 py-2 rounded text-white ${cancelling?'bg-red-400':'bg-red-600 hover:bg-red-700'}`}>{cancelling ? 'Cancelling...' : 'Cancel request'}</button>
                <button
                  onClick={async ()=>{ try { await signOut?.(); } finally { navigate('/signin', { replace: true }); } }}
                  className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
          {state === 'rejected' && (
            <>
              <h2 className="text-xl font-semibold text-red-700">Request rejected</h2>
              {reason && <p className="text-gray-600 dark:text-gray-400 mt-2">Reason: {reason}</p>}
              {adminContact && (adminContact.name || adminContact.email || adminContact.phone) && (
                <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 text-sm">
                  <p className="text-gray-700 dark:text-gray-200 font-medium mb-1">NBFC Admin Contact:</p>
                  {adminContact.name && (
                    <p className="text-gray-600 dark:text-gray-300">Name: <span className="font-medium">{adminContact.name}</span></p>
                  )}
                  {adminContact.email && (
                    <p className="text-gray-600 dark:text-gray-300">Email: <span className="font-medium">{adminContact.email}</span></p>
                  )}
                  {adminContact.phone && (
                    <p className="text-gray-600 dark:text-gray-300">Mobile: <span className="font-medium">{adminContact.phone}</span></p>
                  )}
                </div>
              )}
              <div className="mt-4 flex gap-3 flex-wrap">
                <button onClick={() => navigate('/nbfc/select')} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Choose another NBFC</button>
                <button onClick={() => navigate('/dashboard')} className="px-4 py-2 rounded bg-gray-100 dark:bg-gray-700">Go to dashboard</button>
                <button
                  onClick={async ()=>{ try { await signOut?.(); } finally { navigate('/signin', { replace: true }); } }}
                  className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
          {state === 'cancelled' && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Request cancelled</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-2">Select a different NBFC to continue.</p>
              {adminContact && (adminContact.name || adminContact.email || adminContact.phone) && (
                <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 text-sm">
                  <p className="text-gray-700 dark:text-gray-200 font-medium mb-1">NBFC Admin Contact:</p>
                  {adminContact.name && (
                    <p className="text-gray-600 dark:text-gray-300">Name: <span className="font-medium">{adminContact.name}</span></p>
                  )}
                  {adminContact.email && (
                    <p className="text-gray-600 dark:text-gray-300">Email: <span className="font-medium">{adminContact.email}</span></p>
                  )}
                  {adminContact.phone && (
                    <p className="text-gray-600 dark:text-gray-300">Mobile: <span className="font-medium">{adminContact.phone}</span></p>
                  )}
                </div>
              )}
              <div className="mt-4 flex gap-3 flex-wrap">
                <button onClick={() => navigate('/nbfc/select')} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Go to NBFC selection</button>
                <button
                  onClick={async ()=>{ try { await signOut?.(); } finally { navigate('/signin', { replace: true }); } }}
                  className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}