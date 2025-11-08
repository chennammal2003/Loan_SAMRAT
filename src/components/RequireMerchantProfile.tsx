import { useEffect, useState } from 'react';
import MerchantProfileGate from './MerchantProfileGate';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function RequireMerchantProfile({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile || profile.role !== 'merchant') { setLoading(false); return; }
      try {
        const { data } = await supabase
          .from('merchant_profiles')
          .select('merchant_id')
          .eq('merchant_id', profile.id)
          .maybeSingle();
        if (!cancelled) setHasProfile(!!data?.merchant_id);
      } catch (_) {
        if (!cancelled) setHasProfile(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.role]);

  if (loading) return null;
  if (profile?.role === 'merchant' && !hasProfile) {
    return <MerchantProfileGate onDone={() => setHasProfile(true)} />;
  }
  return <>{children}</>;
}
