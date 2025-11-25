import React, { useEffect, useState } from 'react';
import { Users, Search, Eye, Building2, Mail, Phone, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface MerchantProfile {
  merchant_id: string;
  business_name?: string;
  owner_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  business_type?: string;
  gst_number?: string;
  pan_number?: string;
}

interface TiedMerchant {
  id: string;
  username: string;
  email: string;
  profile: MerchantProfile | null;
  tiedUpAt: string;
  status: string;
}

export default function NbfcMerchantsView() {
  const { profile } = useAuth();
  const [merchants, setMerchants] = useState<TiedMerchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TiedMerchant | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (profile?.role === 'nbfc_admin' && profile?.id) {
      fetchTiedMerchants();
    }
  }, [profile?.id, profile?.role]);

  const fetchTiedMerchants = async () => {
    if (!profile?.id) return;
    
    setLoading(true);
    try {
      // Get all approved tie-up requests for this NBFC
      const { data: tieups, error: tieupErr } = await supabase
        .from('nbfc_tieup_requests')
        .select('merchant_id, created_at, status')
        .eq('nbfc_id', profile.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (tieupErr) throw tieupErr;

      if (!tieups || tieups.length === 0) {
        setMerchants([]);
        setLoading(false);
        return;
      }

      const merchantIds = tieups.map((t: any) => t.merchant_id);

      // Get merchant user profiles
      const { data: merchantUsers, error: userErr } = await supabase
        .from('user_profiles')
        .select('id, username, email')
        .in('id', merchantIds);

      if (userErr) throw userErr;

      // Get merchant business profiles
      const { data: merchantProfiles, error: profileErr } = await supabase
        .from('merchant_profiles')
        .select('*')
        .in('merchant_id', merchantIds);

      if (profileErr) throw profileErr;

      // Merge data
      const profileMap = new Map(
        (merchantProfiles || []).map((p: any) => [p.merchant_id, p])
      );

      const tieupMap = new Map(
        tieups.map((t: any) => [t.merchant_id, t])
      );

      const merged: TiedMerchant[] = (merchantUsers || []).map((u: any) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        profile: profileMap.get(u.id) || null,
        tiedUpAt: tieupMap.get(u.id)?.created_at || new Date().toISOString(),
        status: tieupMap.get(u.id)?.status || 'approved',
      }));

      setMerchants(merged);
    } catch (err) {
      console.error('Error fetching tied merchants:', err);
      setMerchants([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = merchants.filter((m) => {
    const searchLower = search.toLowerCase();
    return (
      m.username.toLowerCase().includes(searchLower) ||
      m.email.toLowerCase().includes(searchLower) ||
      m.profile?.business_name?.toLowerCase().includes(searchLower) ||
      m.profile?.owner_name?.toLowerCase().includes(searchLower)
    );
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading merchants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Tied-Up Merchants
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            View all merchants tied up with your NBFC
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Total Merchants</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{merchants.length}</p>
              </div>
              <Users className="w-10 h-10 text-blue-600 opacity-20" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Active Tie-ups</p>
                <p className="text-3xl font-bold text-green-600">{merchants.filter(m => m.status === 'approved').length}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30"></div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Last Updated</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatDate(new Date().toISOString())}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30"></div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search merchants by name, email, or business..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>
        </div>

        {/* Merchants Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {search ? 'No merchants found' : 'No tied-up merchants yet'}
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                {search
                  ? 'Try adjusting your search terms'
                  : 'Merchants will appear here once they tie up with your NBFC'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Merchant Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Business
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Tied Since
                    </th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filtered.map((merchant) => (
                    <tr key={merchant.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {merchant.profile?.owner_name || merchant.username}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {merchant.username}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {merchant.profile?.business_name || '-'}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {merchant.profile?.business_type || 'Not specified'}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-sm text-gray-900 dark:text-white flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            {merchant.email}
                          </p>
                          {merchant.profile?.phone && (
                            <p className="text-sm text-gray-900 dark:text-white flex items-center gap-2">
                              <Phone className="w-4 h-4" />
                              {merchant.profile.phone}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(merchant.tiedUpAt)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => {
                            setSelected(merchant);
                            setShowDetails(true);
                          }}
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showDetails && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDetails(false)}></div>
          <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {selected.profile?.owner_name || selected.username}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selected.profile?.business_name || 'Merchant Details'}
                </p>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-4 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Personal Information */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Personal Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Username</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selected.username}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Email</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selected.email}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Owner Name</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selected.profile?.owner_name || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Phone</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selected.profile?.phone || '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Business Information */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Business Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Business Name</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selected.profile?.business_name || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Business Type</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selected.profile?.business_type || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">GST Number</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selected.profile?.gst_number || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">PAN Number</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {selected.profile?.pan_number || '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Address */}
              {selected.profile?.address && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Address
                  </h4>
                  <p className="text-gray-900 dark:text-white flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {selected.profile.address}
                  </p>
                </div>
              )}

              {/* Tie-up Information */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Tie-up Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Status</p>
                    <p className="font-medium">
                      <span className="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                        {selected.status}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Tied Since</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formatDate(selected.tiedUpAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
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
