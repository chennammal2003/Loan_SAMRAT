import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function NbfcProfileGate({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || !profile) {
        setChecking(false);
        return;
      }

      // Only gate admins (treated as NBFC) for now
      if (profile.role !== 'admin') {
        setHasProfile(true);
        setChecking(false);
        return;
      }

      const { data, error } = await supabase
        .from('nbfc_profiles')
        .select('nbfc_id')
        .eq('nbfc_id', profile.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        // If table not accessible, allow navigation but log
        console.error('nbfc_profiles check error', error);
        setHasProfile(true);
        setChecking(false);
        return;
      }

      const exists = !!data;
      setHasProfile(exists);
      setChecking(false);

      // If missing and not already on setup, redirect
      if (!exists && location.pathname !== '/nbfc/setup') {
        navigate('/nbfc/setup', { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, profile?.id, profile?.role, location.pathname, navigate]);

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Checking NBFC profile...</p>
        </div>
      </div>
    );
  }

  if (profile?.role === 'admin' && hasProfile === false) {
    return null; // Redirected to setup
  }

  return <>{children}</>;
}
