import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ChevronDown, ChevronUp, X, Eye } from 'lucide-react';

interface MerchantProfile {
  merchant_id: string;
  business_name?: string;
  owner_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  age?: number | null;
  business_type?: string;
  business_category?: string;
  gst_number?: string;
  pan_number?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  upi_id?: string | null;
}

interface TieupRow {
  merchant_id: string;
  nbfc_id: string;
  admin_id: string;
  created_at: string;
  merchant?: { username: string; email: string };
}

interface NbfcGroup {
  nbfc_id: string;
  nbfc_username: string;
  nbfc_email: string;
  merchants: TieupRow[];
  expanded: boolean;
}

export default function AdminNbfcMerchants() {
  const { profile } = useAuth();
  const [groups, setGroups] = useState<NbfcGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [merchantMap, setMerchantMap] = useState<Record<string, MerchantProfile>>({});
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile || profile.role !== 'admin') {
        setLoading(false);
        return;
      }

      try {
        // Fetch all active tie-ups for this admin
        const { data: tieups, error: tieupErr } = await supabase
          .from('nbfc_tieups')
          .select('merchant_id, nbfc_id, admin_id, created_at, merchant:user_profiles!nbfc_tieups_merchant_id_fkey(username, email)')
          .eq('admin_id', profile.id)
          .order('nbfc_id', { ascending: true });

        if (tieupErr) throw tieupErr;

        const list = (tieups || []) as any[];

        // Get unique NBFC IDs
        const nbfcIds = Array.from(new Set(list.map((t) => t.nbfc_id)));

        // Fetch NBFC details
        let nbfcNames: Record<string, { username: string; email: string }> = {};
        if (nbfcIds.length > 0) {
          const { data: nbfcProfiles } = await supabase
            .from('user_profiles')
            .select('id, username, email')
            .in('id', nbfcIds);

          nbfcProfiles?.forEach((n: any) => {
            nbfcNames[n.id] = { username: n.username, email: n.email };
          });
        }

        // Fetch all merchant profiles
        const merchantIds = Array.from(new Set(list.map((t) => t.merchant_id)));
        let merchantDetails: Record<string, MerchantProfile> = {};
        if (merchantIds.length > 0) {
          const { data: profiles } = await supabase
            .from('merchant_profiles')
            .select(
              'merchant_id, business_name, owner_name, email, phone, address, age, business_type, business_category, gst_number, pan_number, bank_name, account_number, ifsc_code, upi_id'
            )
            .in('merchant_id', merchantIds);

          profiles?.forEach((p: any) => {
            merchantDetails[p.merchant_id] = {
              merchant_id: p.merchant_id,
              business_name: p.business_name,
              owner_name: p.owner_name,
              email: p.email,
              phone: p.phone,
              address: p.address,
              age: p.age,
              business_type: p.business_type,
              business_category: p.business_category,
              gst_number: p.gst_number,
              pan_number: p.pan_number,
              bank_name: p.bank_name,
              account_number: p.account_number,
              ifsc_code: p.ifsc_code,
              upi_id: p.upi_id,
            };
          });
        }

        if (!cancelled) setMerchantMap(merchantDetails);

        // Group by NBFC
        const groupMap = new Map<string, TieupRow[]>();
        list.forEach((t: any) => {
          if (!groupMap.has(t.nbfc_id)) {
            groupMap.set(t.nbfc_id, []);
          }
          groupMap.get(t.nbfc_id)?.push(t);
        });

        const grouped: NbfcGroup[] = Array.from(groupMap.entries()).map(([nbfcId, merchants]) => ({
          nbfc_id: nbfcId,
          nbfc_username: nbfcNames[nbfcId]?.username || 'Unknown NBFC',
          nbfc_email: nbfcNames[nbfcId]?.email || '',
          merchants,
          expanded: false,
        }));

        if (!cancelled) setGroups(grouped);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load NBFC merchants');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.role]);

  const toggleExpand = (nbfcId: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.nbfc_id === nbfcId ? { ...g, expanded: !g.expanded } : g))
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile || profile.role !== 'admin') {
    return null;
  }

  if (error) {
    return <div className="p-6 text-red-600 bg-red-50 dark:bg-red-900/20 rounded">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">NBFC Merchants Overview</h1>
        <p className="text-gray-600 dark:text-gray-400">
          View all tied-up merchants grouped by NBFC. Click to expand and see details.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow">
          <p className="text-gray-500 dark:text-gray-400">No NBFC tie-ups yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div
              key={group.nbfc_id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700"
            >
              {/* NBFC Header */}
              <button
                onClick={() => toggleExpand(group.nbfc_id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="text-left flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{group.nbfc_username}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{group.nbfc_email}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    <span className="font-medium">{group.merchants.length}</span> merchant
                    {group.merchants.length !== 1 ? 's' : ''} tied-up
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm font-medium">
                    {group.merchants.length}
                  </span>
                  {group.expanded ? (
                    <ChevronUp size={20} className="text-gray-600 dark:text-gray-400" />
                  ) : (
                    <ChevronDown size={20} className="text-gray-600 dark:text-gray-400" />
                  )}
                </div>
              </button>

              {/* Merchant List */}
              {group.expanded && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50">
                    <div className="space-y-3">
                      {group.merchants.map((merchant) => (
                        <div
                          key={merchant.merchant_id}
                          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between hover:shadow-md transition-shadow"
                        >
                          <div className="flex-1 pr-4">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {merchant.merchant?.username || merchant.merchant_id}
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {merchant.merchant?.email || '-'}
                            </p>

                            {/* Merchant Details Preview */}
                            {merchantMap[merchant.merchant_id] && (
                              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                                <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700">
                                  <div className="text-gray-500 dark:text-gray-400">Business</div>
                                  <div className="font-medium text-gray-900 dark:text-white">
                                    {merchantMap[merchant.merchant_id]?.business_name || '-'}
                                  </div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700">
                                  <div className="text-gray-500 dark:text-gray-400">Owner</div>
                                  <div className="font-medium text-gray-900 dark:text-white">
                                    {merchantMap[merchant.merchant_id]?.owner_name || '-'}
                                  </div>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700">
                                  <div className="text-gray-500 dark:text-gray-400">Phone</div>
                                  <div className="font-medium text-gray-900 dark:text-white">
                                    {merchantMap[merchant.merchant_id]?.phone || '-'}
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                              Tied-up since: {new Date(merchant.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedMerchant(merchant.merchant_id)}
                            className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1 text-sm whitespace-nowrap"
                          >
                            <Eye size={16} />
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Merchant Details Modal */}
      {selectedMerchant && merchantMap[selectedMerchant] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Merchant Details</h3>
              <button
                onClick={() => setSelectedMerchant(null)}
                className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={20} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Owner Name</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {merchantMap[selectedMerchant]?.owner_name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Business Name</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {merchantMap[selectedMerchant]?.business_name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Email</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {merchantMap[selectedMerchant]?.email || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Phone</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {merchantMap[selectedMerchant]?.phone || '-'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 dark:text-gray-400">Address</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {merchantMap[selectedMerchant]?.address || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Age</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {merchantMap[selectedMerchant]?.age ?? '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Business Type</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {merchantMap[selectedMerchant]?.business_type || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Business Category</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {merchantMap[selectedMerchant]?.business_category || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">GST Number</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {merchantMap[selectedMerchant]?.gst_number || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">PAN Number</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {merchantMap[selectedMerchant]?.pan_number || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Bank Name</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {merchantMap[selectedMerchant]?.bank_name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Account Number</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {merchantMap[selectedMerchant]?.account_number || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">IFSC Code</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {merchantMap[selectedMerchant]?.ifsc_code || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">UPI ID</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {merchantMap[selectedMerchant]?.upi_id || '-'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setSelectedMerchant(null)}
                className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
