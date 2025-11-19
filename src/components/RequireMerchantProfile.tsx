import { useEffect, useState } from 'react';
import MerchantProfileGate from './MerchantProfileGate';
import PendingVerificationPage from './PendingVerificationPage';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLocation } from 'react-router-dom';

export default function RequireMerchantProfile({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [merchantProfileData, setMerchantProfileData] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile || profile.role !== 'merchant') { setLoading(false); return; }
      try {
        const { data } = await supabase
          .from('merchant_profiles')
          .select('*')
          .eq('merchant_id', profile.id)
          .maybeSingle();
        if (!cancelled) {
          setHasProfile(!!data?.merchant_id);
          setMerchantProfileData(data);
        }
      } catch (_) {
        if (!cancelled) {
          setHasProfile(false);
          setMerchantProfileData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.role]);

  if (loading) return null;
  
  if (profile?.role === 'merchant') {
    // If merchant doesn't have a profile yet, show profile creation gate
    if (!hasProfile) {
      return <MerchantProfileGate onDone={() => setHasProfile(true)} />;
    }
    
    // If merchant has profile but is not approved by Super Admin, show pending page
    if (hasProfile && profile.is_active === false) {
      // Allow NBFC selection while inactive so the selection page loads
      if (location.pathname === '/nbfc/select') {
        return <>{children}</>;
      }
      return (
        <PendingVerificationPage
          userType="merchant"
          profileData={{
            business_name: merchantProfileData?.business_name,
            owner_name: merchantProfileData?.owner_name,
            email: merchantProfileData?.email || profile.email,
            phone: merchantProfileData?.phone
          }}
        />
      );
    }
  }
  
  return <>{children}</>;
}