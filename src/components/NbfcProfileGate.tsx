import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import PendingVerificationPage from './PendingVerificationPage';

export default function NbfcProfileGate({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [nbfcProfileData, setNbfcProfileData] = useState<any>(null);

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
        .select('*')
        .eq('nbfc_id', profile.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        // If table not accessible, allow navigation but log
        console.error('nbfc_profiles check error', error);
        setHasProfile(true);
        setNbfcProfileData(null);
        setChecking(false);
        return;
      }

      const exists = !!data;
      setHasProfile(exists);
      setNbfcProfileData(data);
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

  if (profile?.role === 'admin') {
    // If admin doesn't have a profile yet, redirect to setup (already handled above)
    if (hasProfile === false) {
      return null; // Redirected to setup
    }
    
    // If admin has profile but is not approved by Super Admin, show pending page
    if (hasProfile === true && profile.is_active === false) {
      return (
        <PendingVerificationPage
          userType="nbfc_admin"
          profileData={{
            nbfc_name: nbfcProfileData?.name,
            email: profile.email,
            phone: nbfcProfileData?.contact_number
          }}
        />
      );
    }
  }

  return <>{children}</>;
}
