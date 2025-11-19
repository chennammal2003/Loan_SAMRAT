import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { createProfileSubmissionNotification } from '../lib/notifications';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';

interface Props {
  onDone: () => void;
}

// Tamil Nadu districts
const TN_DISTRICTS = [
  'Ariyalur','Chengalpattu','Chennai','Coimbatore','Cuddalore','Dharmapuri','Dindigul','Erode',
  'Kallakurichi','Kanchipuram','Kanyakumari','Karur','Krishnagiri','Madurai','Mayiladuthurai','Nagapattinam',
  'Namakkal','Nilgiris','Perambalur','Pudukkottai','Ramanathapuram','Ranipet','Salem','Sivaganga','Tenkasi',
  'Thanjavur','Theni','Thoothukudi','Tiruchirappalli','Tirunelveli','Tirupathur','Tiruppur','Tiruvallur',
  'Tiruvannamalai','Tiruvarur','Vellore','Viluppuram','Virudhunagar'
];

interface FormState {
  business_name: string;
  owner_name: string;
  email: string;
  phone: string;
  address: string;
  age: string;
  business_type: string;
  business_category: string;
  gst_number: string;
  pan_number: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  upi_id?: string;
  shop_url?: string;
}

const empty: FormState = {
  business_name: '',
  owner_name: '',
  email: '',
  phone: '',
  address: '',
  age: '',
  business_type: '',
  business_category: '',
  gst_number: '',
  pan_number: '',
  bank_name: '',
  account_number: '',
  ifsc_code: '',
  upi_id: '',
  shop_url: '',
};

const genCode = (biz: string, location: string, seed: string) => {
  const slug = (s: string) => (s || '').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  // simple deterministic hash from seed
  let h = 0;
  for (let i = 0; i < (seed || '').length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const r = (h % 900) + 100; // 100..999
  return `${slug(biz)}-${slug(location)}-${r}`;
};

export default function MerchantProfileGate({ onDone }: Props) {
  const { profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [showSuccess, setShowSuccess] = useState(false);
  const [merchantId, setMerchantId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showDistricts, setShowDistricts] = useState(false);
  const [districtQuery, setDistrictQuery] = useState('');
  // No splash: we will not block the portal during loading

  useEffect(() => {
    const init = async () => {
      if (!profile) return;
      // Prefill with auth profile data
      setForm((f) => ({
        ...f,
        owner_name: profile.username || '',
        email: profile.email || '',
      }));
      // Check if merchant profile exists; treat presence as completed
      try {
        const { data, error } = await supabase
          .from('merchant_profiles')
          .select('*')
          .eq('merchant_id', profile.id)
          .maybeSingle();
        if (!error && data && data.merchant_id) {
          // already completed
          onDone();
          return;
        }
      } catch (_) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    init();
    return () => {};
  }, [profile]);

  const currentErrors = useMemo(() => {
    const e: Record<string, string> = {};
    const required: Array<keyof FormState> = [
      'business_name', 'owner_name', 'email', 'phone', 'age', 'business_type', 'business_category',
      'gst_number', 'pan_number', 'bank_name', 'account_number', 'ifsc_code'
    ];
    required.forEach((k) => {
      if (!(form[k] || '').toString().trim()) e[k] = 'Required';
    });
    if (form.email && !/.+@.+\..+/.test(form.email)) e.email = 'Invalid email';
    if (form.phone && !/^\d{10}$/.test(form.phone)) e.phone = '10 digit phone';
    if (form.age && Number(form.age) <= 0) e.age = 'Invalid age';
    return e;
  }, [form]);

  const isValid = Object.keys(currentErrors).length === 0;

  const save = async () => {
    if (!profile) return;
    setError(null);
    if (!isValid) { setError('Please fill all required fields'); return; }
    setSaving(true);
    try {
      // Try to find existing by merchant_id (FK to user_profiles.id)
      const { data: existing, error: findErr } = await supabase
        .from('merchant_profiles')
        .select('merchant_id')
        .eq('merchant_id', profile.id)
        .maybeSingle();
      if (findErr) throw findErr;

      // Generate a friendly public-facing code to show the user using Branch (business_name) + Location (address)
      const code = genCode(form.business_name, form.address, profile.id);

      if (existing) {
        // Update existing (keep merchant_id)
        const { error: updErr } = await supabase
          .from('merchant_profiles')
          .update({
            business_name: form.business_name,
            owner_name: form.owner_name,
            phone: form.phone,
            address: form.address || null,
            age: Number(form.age),
            business_type: form.business_type,
            business_category: form.business_category,
            gst_number: form.gst_number,
            pan_number: form.pan_number,
            bank_name: form.bank_name,
            account_number: form.account_number,
            ifsc_code: form.ifsc_code,
            upi_id: form.upi_id || null,
            shop_url: form.shop_url || null,
            updated_at: new Date().toISOString(),
          })
          .eq('merchant_id', profile.id);
        if (updErr) throw updErr;
      } else {
        // Insert new row with generated Merchant ID
        const { error: insErr } = await supabase
          .from('merchant_profiles')
          .insert({
            merchant_id: profile.id,
            business_name: form.business_name,
            owner_name: form.owner_name,
            email: form.email,
            phone: form.phone,
            address: form.address || null,
            age: Number(form.age),
            business_type: form.business_type,
            business_category: form.business_category,
            gst_number: form.gst_number,
            pan_number: form.pan_number,
            bank_name: form.bank_name,
            account_number: form.account_number,
            ifsc_code: form.ifsc_code,
            upi_id: form.upi_id || null,
            shop_url: form.shop_url || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        if (insErr) throw insErr;
      }

      // Whenever merchant saves profile, send notification and mark merchant inactive
      {
        try {
          await createProfileSubmissionNotification({
            type: 'merchant_profile_submitted',
            userId: profile.id,
            userName: form.owner_name || profile.username || 'Unknown',
            userEmail: form.email || profile.email || 'Unknown',
            profileData: {
              business_name: form.business_name,
              business_type: form.business_type,
              business_category: form.business_category,
              phone: form.phone,
            },
          });
        } catch (e) {
          console.error('Failed to create merchant profile submission notification', e);
        }

        // Ensure merchant is set inactive until Super Admin approval
        try {
          await supabase
            .from('user_profiles')
            .update({
              is_active: false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', profile.id);
        } catch (e) {
          console.error('Failed to set merchant inactive after profile submission', e);
        }

        // Refresh auth profile so TieUpGate sees is_active=false
        try {
          await refreshProfile?.();
        } catch (_) {}
      }

      setMerchantId(code);
      setShowSuccess(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    // Render nothing during loading so the portal is immediately visible after login
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)] ring-1 ring-black/5 overflow-hidden">
        <div className="px-6 py-5 border-b border-white/60 dark:border-white/10 bg-gradient-to-r from-blue-50/60 to-indigo-50/60 dark:from-blue-900/10 dark:to-indigo-900/10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">🏷️</div>
              <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">Merchant Profile Setup</h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Complete your profile to continue</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="px-3 py-1.5 rounded-full bg-gray-900/5 dark:bg-white/10 hover:bg-gray-900/10 dark:hover:bg-white/15 text-xs text-gray-700 dark:text-gray-200 border border-gray-900/10 dark:border-white/10 transition-colors"
              title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
            >
              {theme === 'light' ? 'Dark' : 'Light'}
            </button>
            <button
              onClick={async () => { try { await signOut(); } finally { navigate('/signin'); } }}
              className="px-3 py-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 text-xs transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[70vh] overflow-y-auto">
          <Field label="Business Name" value={form.business_name} onChange={(v)=>setForm({...form,business_name:v})} error={currentErrors.business_name} />
          <Field label="Owner Name" value={form.owner_name} onChange={(v)=>setForm({...form,owner_name:v})} error={currentErrors.owner_name} />
          <Field type="email" label="Email Address" value={form.email} onChange={(v)=>setForm({...form,email:v})} error={currentErrors.email} />
          <Field label="Phone Number" value={form.phone} onChange={(v)=>setForm({...form,phone:v})} error={currentErrors.phone} />
          <Field label="Shop URL (optional)" value={form.shop_url||''} onChange={(v)=>setForm({...form,shop_url:v})} />
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
              <button
                type="button"
                onClick={() => setShowDistricts(true)}
                className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Pick Tamil Nadu District
              </button>
            </div>
            <textarea
              value={form.address}
              onChange={(e)=>setForm({...form,address:e.target.value})}
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-white/90 dark:bg-gray-700/80 border border-gray-300 dark:border-gray-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              placeholder="Street, City, State, PIN"
            />
          </div>
          <Field type="number" label="Age" value={form.age} onChange={(v)=>setForm({...form,age:v})} error={currentErrors.age} />
          <Field label="Business Type" value={form.business_type} onChange={(v)=>setForm({...form,business_type:v})} error={currentErrors.business_type} />
          <Field label="Business Category" value={form.business_category} onChange={(v)=>setForm({...form,business_category:v})} error={currentErrors.business_category} />
          <Field label="GST Number" value={form.gst_number} onChange={(v)=>setForm({...form,gst_number:v})} error={currentErrors.gst_number} />
          <Field label="PAN Number" value={form.pan_number} onChange={(v)=>setForm({...form,pan_number:v})} error={currentErrors.pan_number} />
          <Field label="Bank Name" value={form.bank_name} onChange={(v)=>setForm({...form,bank_name:v})} error={currentErrors.bank_name} />
          <Field label="Account Number" value={form.account_number} onChange={(v)=>setForm({...form,account_number:v})} error={currentErrors.account_number} />
          <Field label="IFSC Code" value={form.ifsc_code} onChange={(v)=>setForm({...form,ifsc_code:v})} error={currentErrors.ifsc_code} />
          <Field label="UPI ID (optional)" value={form.upi_id||''} onChange={(v)=>setForm({...form,upi_id:v})} />
        </div>

        {error && (
          <div className="px-6 pb-3 text-sm text-red-600">{error}</div>
        )}

        <div className="px-6 py-4 border-t border-white/60 dark:border-white/10 flex justify-end gap-3 bg-gradient-to-r from-transparent via-transparent to-blue-50/40 dark:to-blue-900/10">
          <button
            disabled={saving}
            onClick={save}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:shadow-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {showSuccess && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-green-600 text-xl">✓</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Profile updated successfully!</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Your Merchant ID: <span className="font-semibold">{merchantId}</span></p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Click Continue to access the application.</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={onDone} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* Tamil Nadu District Picker */}
      {showDistricts && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDistricts(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Select District (Tamil Nadu)</h4>
              <button onClick={() => setShowDistricts(false)} className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700">Close</button>
            </div>
            <input
              value={districtQuery}
              onChange={(e)=>setDistrictQuery(e.target.value)}
              placeholder="Search district..."
              className="w-full mb-3 px-3 py-2 rounded border bg-white dark:bg-gray-700"
            />
            <div className="max-h-64 overflow-y-auto grid grid-cols-2 gap-2">
              {TN_DISTRICTS.filter(d => d.toLowerCase().includes(districtQuery.toLowerCase())).map(d => (
                <button
                  key={d}
                  onClick={() => { setForm({...form, address: d}); setShowDistricts(false); }}
                  className="text-left px-3 py-2 rounded border bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600"
                >
                  {d}
                </button>
              ))}
              {TN_DISTRICTS.filter(d => d.toLowerCase().includes(districtQuery.toLowerCase())).length === 0 && (
                <p className="col-span-2 text-sm text-gray-500">No matches</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, error, type='text' }: { label: string; value: string; onChange: (v:string)=>void; error?: string; type?: string; }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e)=>onChange(e.target.value)}
        className={`w-full px-3 py-2 rounded-lg bg-white/90 dark:bg-gray-700/80 border ${error?'border-red-400':'border-gray-300 dark:border-gray-600'} shadow-sm focus:outline-none focus:ring-2 ${error?'focus:ring-red-300':'focus:ring-blue-400'} transition`}
        placeholder={label}
      />
      {error && <p className="text-xs text-red-500 mt-1 italic">{error}</p>}
    </div>
  );
}
