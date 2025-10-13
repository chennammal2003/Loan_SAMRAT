import { useEffect, useMemo, useState } from 'react';
import { Users, X, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';

type MerchantProfile = {
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
};

type MerchantRow = {
  id: string; // user id
  username: string;
  email: string;
  created_at: string;
  profile?: MerchantProfile | null;
};

export default function MerchantDetails() {
  const [rows, setRows] = useState<MerchantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MerchantRow | null>(null);
  const [search, setSearch] = useState('');
  const genCode = (biz?: string, location?: string, seed?: string) => {
    const slug = (s?: string) => (s || '').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
    let h = 0; for (let i = 0; i < (seed || '').length; i++) h = (h * 31 + (seed as string).charCodeAt(i)) >>> 0;
    const r = (h % 900) + 100;
    return `${slug(biz)}-${slug(location)}-${r}`;
  };

  const downloadCSV = () => {
    const headers = [
      'Merchant ID','Username','Created At',
      'Owner Name','Business Name','Email','Phone','Address','Age',
      'Business Type','Business Category','GST Number','PAN Number',
      'Bank Name','Account Number','IFSC Code','UPI ID'
    ];
    const escape = (v: any) => {
      const s = v === null || v === undefined ? '' : String(v);
      const needsQuotes = /[",\n]/.test(s);
      const t = s.replace(/"/g,'""');
      return needsQuotes ? `"${t}"` : t;
    };
    const lines = [headers.join(',')];
    filtered.forEach((r) => {
      const p = r.profile || {} as any;
      const line = [
        r.id, r.username, r.created_at,
        p.owner_name || r.username, p.business_name || '', p.email || r.email, p.phone || '', p.address || '', p.age ?? '',
        p.business_type || '', p.business_category || '', p.gst_number || '', p.pan_number || '',
        p.bank_name || '', p.account_number || '', p.ifsc_code || '', p.upi_id || ''
      ].map(escape).join(',');
      lines.push(line);
    });
    const blob = new Blob(["\uFEFF" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    a.download = `Merchants_${now}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchMerchants();
  }, []);

  const fetchMerchants = async () => {
    try {
      // Strategy A: query merchant_profiles first and pull related user (most robust)
      const { data: profileFirst, error: pfErr } = await supabase
        .from('merchant_profiles')
        .select(`*, user:user_profiles(id, username, email, created_at)`) // relies on FK merchant_id -> user_profiles.id
        .order('created_at', { ascending: false });

      if (!pfErr && profileFirst && profileFirst.length > 0) {
        const mappedA: MerchantRow[] = profileFirst.map((row: any) => ({
          id: row.user?.id || row.merchant_id,
          username: row.user?.username || '-',
          email: row.user?.email || row.email || '-',
          created_at: row.user?.created_at || row.updated_at || new Date().toISOString(),
          profile: {
            merchant_id: row.merchant_id,
            business_name: row.business_name,
            owner_name: row.owner_name,
            email: row.email,
            phone: row.phone,
            address: row.address,
            age: row.age,
            business_type: row.business_type,
            business_category: row.business_category,
            gst_number: row.gst_number,
            pan_number: row.pan_number,
            bank_name: row.bank_name,
            account_number: row.account_number,
            ifsc_code: row.ifsc_code,
            upi_id: row.upi_id,
          },
        }));
        setRows(mappedA);
        return;
      }

      // Strategy B: nested select join from user_profiles filtered by role
      const { data, error } = await supabase
        .from('user_profiles')
        .select(`id, username, email, created_at, merchant_profiles:merchant_profiles(*)`)
        .eq('role', 'merchant')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const mapped: MerchantRow[] = data.map((u: any) => ({
          id: u.id,
          username: u.username,
          email: u.email,
          created_at: u.created_at,
          profile: u.merchant_profiles || null,
        }));
        setRows(mapped);
        return;
      }

      // Fallback: fetch separately and merge on id
      const [usersRes, profRes] = await Promise.all([
        supabase.from('user_profiles').select('id,username,email,created_at').eq('role', 'merchant'),
        supabase.from('merchant_profiles').select('*'),
      ]);
      const users = usersRes.data || [];
      const profs = (profRes.data || []) as MerchantProfile[];
      const mapped: MerchantRow[] = users.map((u: any) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        created_at: u.created_at,
        profile: profs.find((p) => p.merchant_id === u.id) || null,
      }));
      setRows(mapped);
    } catch (error) {
      console.error('Error fetching merchants:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.profile?.owner_name,
        r.profile?.business_name,
        r.profile?.phone,
        r.profile?.email || r.email,
        r.profile?.address,
        r.username,
        r.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!loading && rows.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Merchants</h3>
        <p className="text-gray-600 dark:text-gray-400">No merchants have registered yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div />
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search owner, business, phone, email, address, ID"
            className="w-full md:w-96 px-3 py-2 rounded border bg-white dark:bg-gray-800 dark:border-gray-700 text-sm"
          />
          <button onClick={downloadCSV} className="px-3 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700">Download Excel</button>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">Owner Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Business Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Phone</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Address</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">{r.profile?.owner_name || r.username}</td>
                  <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300">{r.profile?.business_name || '-'}</td>
                  <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300">{r.profile?.phone || '-'}</td>
                  <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300 truncate max-w-xs">{r.profile?.address || '-'}</td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => setSelected(r)}
                      className="inline-flex items-center space-x-2 px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-center text-sm text-gray-500 dark:text-gray-400">No results</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Merchant Details</h3>
              <button onClick={() => setSelected(null)} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Merchant ID</p>
                  <p className="font-medium">{genCode(selected.profile?.business_name, selected.profile?.address, selected.id)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Owner Name</p>
                  <p className="font-medium">{selected.profile?.owner_name || selected.username}</p>
                </div>
                <div>
                  <p className="text-gray-500">Business Name</p>
                  <p className="font-medium">{selected.profile?.business_name || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Email</p>
                  <p className="font-medium">{selected.profile?.email || selected.email}</p>
                </div>
                <div>
                  <p className="text-gray-500">Phone</p>
                  <p className="font-medium">{selected.profile?.phone || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Address</p>
                  <p className="font-medium">{selected.profile?.address || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Age</p>
                  <p className="font-medium">{selected.profile?.age ?? '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Business Type</p>
                  <p className="font-medium">{selected.profile?.business_type || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Business Category</p>
                  <p className="font-medium">{selected.profile?.business_category || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">GST Number</p>
                  <p className="font-medium">{selected.profile?.gst_number || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">PAN Number</p>
                  <p className="font-medium">{selected.profile?.pan_number || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Bank Name</p>
                  <p className="font-medium">{selected.profile?.bank_name || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Account Number</p>
                  <p className="font-medium">{selected.profile?.account_number || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">IFSC Code</p>
                  <p className="font-medium">{selected.profile?.ifsc_code || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">UPI ID</p>
                  <p className="font-medium">{selected.profile?.upi_id || '-'}</p>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={() => setSelected(null)} className="px-4 py-2 rounded bg-blue-600 text-white">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
