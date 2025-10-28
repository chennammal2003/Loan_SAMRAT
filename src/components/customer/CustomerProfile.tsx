import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

type Address = {
  id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  country: string | null;
  pin_code: string;
  phone: string | null;
  is_default: boolean;
  lat: number | null;
  lng: number | null;
  formatted_address: string | null;
};

function CustomerProfile() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [addrFormOpen, setAddrFormOpen] = useState(false);
  const [addrSaving, setAddrSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addr, setAddr] = useState({
    label: 'Home',
    line1: '',
    line2: '',
    landmark: '',
    city: '',
    state: '',
    country: 'India',
    pin_code: '',
    phone: '',
    is_default: false,
    lat: '' as unknown as number | null,
    lng: '' as unknown as number | null,
    formatted_address: '',
  });

  useEffect(() => {
    setUsername(profile?.username || '');
  }, [profile?.username]);

  useEffect(() => {
    (async () => {
      if (!user) return;
      setLoadingAddresses(true);
      try {
        const { data, error } = await supabase
          .from('addresses')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setAddresses((data as any[]) as Address[]);
      } catch {
        setAddresses([]);
      } finally {
        setLoadingAddresses(false);
      }
    })();
  }, [user?.id]);

  // const defaultAddressId = useMemo(() => addresses.find(a => a.is_default)?.id || null, [addresses]);

  const saveProfile = async () => {
    if (!user) return;
    setUpdatingProfile(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ username })
        .eq('id', user.id);
      if (error) throw error;
    } finally {
      setUpdatingProfile(false);
    }
  };

  const useCurrentLocation = async () => {
    return new Promise<void>((resolve) => {
      if (!('geolocation' in navigator)) {
        resolve();
        return;
      }
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
          const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
          const j = await res.json();
          const a = j.address || {};
          setAddr(prev => ({
            ...prev,
            lat,
            lng,
            formatted_address: j.display_name || prev.formatted_address,
            line1: prev.line1 || [a.house_number, a.road].filter(Boolean).join(' '),
            line2: prev.line2 || a.neighbourhood || a.suburb || '',
            city: prev.city || a.city || a.town || a.village || '',
            state: prev.state || a.state || '',
            country: prev.country || a.country || 'India',
            pin_code: prev.pin_code || a.postcode || '',
          }));
        } catch {
        } finally {
          resolve();
        }
      }, () => resolve(), { enableHighAccuracy: true, timeout: 10000 });
    });
  };

  const resetAddrForm = () => {
    setEditingId(null);
    setAddr({
      label: 'Home',
      line1: '',
      line2: '',
      landmark: '',
      city: '',
      state: '',
      country: 'India',
      pin_code: '',
      phone: '',
      is_default: false,
      lat: '' as unknown as number | null,
      lng: '' as unknown as number | null,
      formatted_address: '',
    });
  };

  const submitAddress = async () => {
    if (!user) return;
    setAddrSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('addresses')
          .update({ ...addr })
          .eq('id', editingId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('addresses')
          .insert([{ ...addr, user_id: user.id }]);
        if (error) throw error;
      }
      const { data } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setAddresses((data as any[]) as Address[]);
      setAddrFormOpen(false);
      resetAddrForm();
    } catch {
    } finally {
      setAddrSaving(false);
    }
  };

  const handleEditAddress = (a: Address) => {
    setEditingId(a.id);
    setAddr({
      label: a.label || '',
      line1: a.line1,
      line2: a.line2 || '',
      landmark: a.landmark || '',
      city: a.city,
      state: a.state,
      country: a.country || 'India',
      pin_code: a.pin_code,
      phone: a.phone || '',
      is_default: a.is_default,
      lat: a.lat,
      lng: a.lng,
      formatted_address: a.formatted_address || '',
    });
    setAddrFormOpen(true);
  };

  const handleDeleteAddress = async (id: string) => {
    if (!user) return;
    try {
      await supabase.from('addresses').delete().eq('id', id).eq('user_id', user.id);
      setAddresses((prev) => prev.filter(a => a.id !== id));
    } catch {}
  };

  const setDefaultAddress = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.rpc('set_default_address', { uid: user.id, address_id: id });
      if (error) throw error;
    } catch {
      // Fallback if RPC is not defined: client-side two-step update
      await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
      await supabase.from('addresses').update({ is_default: true }).eq('id', id).eq('user_id', user.id);
    } finally {
      const { data } = await supabase.from('addresses').select('*').eq('user_id', user.id);
      setAddresses((data as any[]) as Address[]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow">
        <h1 className="text-2xl font-bold mb-1">My Profile</h1>
        <p className="text-gray-600 dark:text-gray-300">Manage your profile, addresses and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">User Information</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Email</label>
              <input value={profile?.email || ''} readOnly className="w-full px-3 py-2 rounded border bg-gray-50 dark:bg-gray-800" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Name</label>
              <input value={username} onChange={(e)=> setUsername(e.target.value)} className="w-full px-3 py-2 rounded border" />
            </div>
            <div className="flex gap-3">
              <button disabled={updatingProfile} onClick={saveProfile} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold">Save</button>
              <button onClick={async ()=> { await signOut(); navigate('/signin'); }} className="px-4 py-2 rounded-lg border">Logout</button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Saved Addresses</h2>
            <button onClick={()=> { resetAddrForm(); setAddrFormOpen(true); }} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold">Add Address</button>
          </div>

          {loadingAddresses ? (
            <div>Loading…</div>
          ) : addresses.length === 0 ? (
            <div className="text-gray-600">No saved addresses</div>
          ) : (
            <div className="space-y-3">
              {addresses.map(a => (
                <div key={a.id} className="border rounded-lg p-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold flex items-center gap-2">{a.label || 'Address'} {a.is_default && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Default</span>}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{a.formatted_address || [a.line1, a.line2, a.landmark, a.city, a.state, a.pin_code].filter(Boolean).join(', ')}</div>
                    {a.phone && <div className="text-sm text-gray-600">Phone: {a.phone}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    {!a.is_default && (
                      <button onClick={()=> setDefaultAddress(a.id)} className="px-3 py-2 rounded border">Set Default</button>
                    )}
                    <button onClick={()=> handleEditAddress(a)} className="px-3 py-2 rounded border">Edit</button>
                    <button onClick={()=> handleDeleteAddress(a.id)} className="px-3 py-2 rounded border text-red-600">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {addrFormOpen && (
            <div className="mt-6 border-t pt-6">
              <h3 className="font-semibold mb-3">{editingId ? 'Edit Address' : 'Add New Address'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Label</label>
                  <input value={addr.label} onChange={(e)=> setAddr(prev=> ({...prev, label: e.target.value}))} className="w-full px-3 py-2 border rounded" placeholder="Home / Work" />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Phone</label>
                  <input value={addr.phone || ''} onChange={(e)=> setAddr(prev=> ({...prev, phone: e.target.value}))} className="w-full px-3 py-2 border rounded" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-500 mb-1">Address Line 1</label>
                  <input value={addr.line1} onChange={(e)=> setAddr(prev=> ({...prev, line1: e.target.value}))} className="w-full px-3 py-2 border rounded" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-500 mb-1">Address Line 2</label>
                  <input value={addr.line2 || ''} onChange={(e)=> setAddr(prev=> ({...prev, line2: e.target.value}))} className="w-full px-3 py-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Landmark</label>
                  <input value={addr.landmark || ''} onChange={(e)=> setAddr(prev=> ({...prev, landmark: e.target.value}))} className="w-full px-3 py-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">City</label>
                  <input value={addr.city} onChange={(e)=> setAddr(prev=> ({...prev, city: e.target.value}))} className="w-full px-3 py-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">State</label>
                  <input value={addr.state} onChange={(e)=> setAddr(prev=> ({...prev, state: e.target.value}))} className="w-full px-3 py-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">PIN/ZIP</label>
                  <input value={addr.pin_code} onChange={(e)=> setAddr(prev=> ({...prev, pin_code: e.target.value}))} className="w-full px-3 py-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Country</label>
                  <input value={addr.country || ''} onChange={(e)=> setAddr(prev=> ({...prev, country: e.target.value}))} className="w-full px-3 py-2 border rounded" />
                </div>
                <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-gray-700">
                    <input type="checkbox" checked={addr.is_default} onChange={(e)=> setAddr(prev=> ({...prev, is_default: e.target.checked}))} className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                    Set as default
                  </label>
                  <button onClick={useCurrentLocation} type="button" className="px-3 py-2 rounded border">Use current location</button>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button disabled={addrSaving} onClick={submitAddress} className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold">Save Address</button>
                <button onClick={()=> { setAddrFormOpen(false); resetAddrForm(); }} className="px-5 py-2.5 rounded-lg border">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow">
          <h2 className="text-lg font-semibold mb-3">Payment & Orders</h2>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={()=> navigate('/customer/orders')} className="px-4 py-2 rounded border">My Orders</button>
            <button className="px-4 py-2 rounded border">Saved Methods</button>
            <button className="px-4 py-2 rounded border">Transactions</button>
            <button onClick={()=> navigate('/customer/wishlist')} className="px-4 py-2 rounded border">Wishlist</button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow">
          <h2 className="text-lg font-semibold mb-3">Notifications & Settings</h2>
          <div className="space-y-2">
            <label className="flex items-center justify-between">
              <span>Notifications</span>
              <input type="checkbox" className="toggle checkbox" />
            </label>
            <div className="flex items-center gap-2">
              <span>Language</span>
              <select className="px-3 py-2 border rounded"><option>English</option><option>Tamil</option><option>Hindi</option></select>
            </div>
            <button className="px-4 py-2 rounded border">Privacy Settings</button>
            <button className="px-4 py-2 rounded border">Help & Support</button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow">
          <h2 className="text-lg font-semibold mb-3">Jewelry</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Price Alerts</span>
              <input type="checkbox" className="toggle checkbox" />
            </div>
            <div className="text-sm text-gray-600">Live gold & silver rates are shown in the header; detailed tracker available in store.</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerProfile;
