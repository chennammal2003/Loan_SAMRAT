import { useEffect, useState } from 'react';
import MerchantProfileGate from './MerchantProfileGate';
import PendingVerificationPage from './PendingVerificationPage';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function RequireMerchantProfile({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
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
