import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { createProfileSubmissionNotification } from '../lib/notifications';

interface MerchantProfilePanelProps {
  open: boolean;
  onClose: () => void;
}

interface MerchantProfileForm {
  merchant_id: string; // maps to user id
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

const emptyForm = (merchant_id: string, defaults?: Partial<MerchantProfileForm>): MerchantProfileForm => ({
  merchant_id,
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
  ...(defaults || {}),
});

export default function MerchantProfilePanel({ open, onClose }: MerchantProfilePanelProps) {
  const { profile } = useAuth();
  const [form, setForm] = useState<MerchantProfileForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  // View/Edit toggle
  const [isEditing, setIsEditing] = useState(false);
  const genCode = (biz: string, location: string, seed: string) => {
    const slug = (s: string) => (s || '').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
    let h = 0; for (let i = 0; i < (seed || '').length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const r = (h % 900) + 100;
    return `${slug(biz)}-${slug(location)}-${r}`;
  };

  useEffect(() => {
    if (profile?.id) {
      // Pre-fill with user profile basics
      setForm(emptyForm(profile.id, { owner_name: profile.username, email: profile.email }));
      // Try to load existing merchant profile if table exists
      (async () => {
        try {
          const { data, error } = await supabase
            .from('merchant_profiles')
            .select('*')
            .eq('merchant_id', profile.id)
            .single();
          if (!error && data) {
            setForm({
              merchant_id: profile.id,
              business_name: data.business_name || '',
              owner_name: data.owner_name || profile.username,
              email: data.email || profile.email,
              phone: data.phone || '',
              address: data.address || '',
              age: data.age?.toString?.() || '',
              business_type: data.business_type || '',
              business_category: data.business_category || '',
              gst_number: data.gst_number || '',
              pan_number: data.pan_number || '',
              bank_name: data.bank_name || '',
              account_number: data.account_number || '',
              ifsc_code: data.ifsc_code || '',
              upi_id: data.upi_id || '',
              shop_url: data.shop_url || '',
            });
            setIsEditing(false);
          } else {
            // No data, keep view mode until user clicks Edit
            setIsEditing(false);
          }
        } catch (e) {
          // Silently ignore if table doesn't exist or RLS prevents read
          // Keep view mode by default
          setIsEditing(false);
        }
      })();
    }
  }, [profile?.id]);

  if (!profile) return null;
  const close = () => {
    if (!saving) onClose();
  };

  const handleSave = async () => {
    if (!form) return;
    // Basic validation
    if (!form.owner_name || !form.business_name || !form.phone) {
      setToast({ type: 'error', message: 'Owner name, Business name, and Phone are required.' });
      return;
    }
    // Normalize phone: ensure leading + if starts with country code digits
    let phone = form.phone.trim();
    if (/^\d{10,15}$/.test(phone)) {
      phone = `+${phone}`;
    }
    setSaving(true);
    try {
      // Check if this is a new profile submission (first time save)
      const { data: existingProfile } = await supabase
        .from('merchant_profiles')
        .select('merchant_id')
        .eq('merchant_id', form.merchant_id)
        .maybeSingle();
      
      const isNewProfile = !existingProfile;
      
      // Attempt upsert into merchant_profiles (requires table with unique constraint on merchant_id)
      const { error } = await supabase
        .from('merchant_profiles')
        .upsert(
          {
            merchant_id: form.merchant_id,
            business_name: form.business_name,
            owner_name: form.owner_name,
            email: form.email,
            phone,
            address: form.address,
            age: form.age ? Number(form.age) : null,
            business_type: form.business_type,
            business_category: form.business_category,
            gst_number: form.gst_number,
            pan_number: form.pan_number,
            bank_name: form.bank_name,
            account_number: form.account_number,
            ifsc_code: form.ifsc_code,
            upi_id: form.upi_id || null,
            shop_url: form.shop_url || null,
          },
          { onConflict: 'merchant_id' }
        );
      if (error) throw error;
      
      // Create notification for Super Admin if this is a new profile
      if (isNewProfile) {
        await createProfileSubmissionNotification({
          type: 'merchant_profile_submitted',
          userId: form.merchant_id,
          userName: form.owner_name || profile.username || 'Unknown',
          userEmail: form.email || profile.email || 'Unknown',
          profileData: {
            business_name: form.business_name,
            business_type: form.business_type,
            business_category: form.business_category,
            phone: phone
          }
        });

        // CRITICAL: Ensure user is set to inactive after profile submission
        // This is a failsafe in case the signup process didn't set it correctly
        const { error: inactiveError } = await supabase
          .from('user_profiles')
          .update({ 
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', form.merchant_id);

        if (inactiveError) {
          console.error('Error setting merchant to inactive after profile submission:', inactiveError);
        }
      }
      
      setToast({ type: 'success', message: 'Profile saved successfully! Redirecting...' });
      
      // If this is a new profile, close the panel and let gates show the pending page
      if (isNewProfile) {
        // Ensure the user is inactive (failsafe)
        await supabase
          .from('user_profiles')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', form.merchant_id);

        // Wait until the merchant_profiles row is visible to the app before redirecting
        try {
          for (let i = 0; i < 20; i++) {
            const { data: check } = await supabase
              .from('merchant_profiles')
              .select('merchant_id')
              .eq('merchant_id', form.merchant_id)
              .maybeSingle();
            if (check?.merchant_id) break;
            await new Promise((r) => setTimeout(r, 250));
          }
        } catch (_) {}

        onClose();
        // Navigate to dashboard; gates will render Under Review until Super Admin approves
        window.location.replace('/dashboard');
      } else {
        setTimeout(() => setToast(null), 3000);
        // Switch back to view mode after save, keep panel open
        setIsEditing(false);
      }
    } catch (e: any) {
      console.error('Failed to save merchant profile', e);
      setToast({ type: 'error', message: e?.message || 'Failed to save profile. Ask admin to enable merchant_profiles table.' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={close}
      />

      {/* Slide-over on the right side */}
      <div className="absolute right-0 top-0 h-full w-full sm:w-[520px] bg-white dark:bg-gray-800 shadow-2xl transform transition-transform translate-x-0">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Merchant Profile</h3>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-sm hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Edit
              </button>
            )}
            <button onClick={close} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto h-[calc(100%-64px)]">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Merchant ID</label>
              <input
                value={genCode(form?.business_name || '', form?.address || '', profile.id)}
                readOnly
                className="w-full px-3 py-2 rounded border bg-gray-100 dark:bg-gray-700"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">This ID is derived from Business Name and Address (location). Fill those fields to update.</p>
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Business Name</label>
              <input value={form?.business_name || ''} onChange={(e)=>setForm(f=>({...(f as any), business_name:e.target.value}))} readOnly={!isEditing} className={`w-full px-3 py-2 rounded border ${isEditing ? 'bg-white dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-700/70 cursor-not-allowed'}`} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Owner Name</label>
              <input value={form?.owner_name || ''} onChange={(e)=>setForm(f=>({...(f as any), owner_name:e.target.value}))} readOnly={!isEditing} className={`w-full px-3 py-2 rounded border ${isEditing ? 'bg-white dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-700/70 cursor-not-allowed'}`} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Email Address</label>
              <input type="email" value={form?.email || ''} onChange={(e)=>setForm(f=>({...(f as any), email:e.target.value}))} readOnly={!isEditing} className={`w-full px-3 py-2 rounded border ${isEditing ? 'bg-white dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-700/70 cursor-not-allowed'}`} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Phone Number</label>
              <input value={form?.phone || ''} onChange={(e)=>setForm(f=>({...(f as any), phone:e.target.value}))} readOnly={!isEditing} className={`w-full px-3 py-2 rounded border ${isEditing ? 'bg-white dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-700/70 cursor-not-allowed'}`} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Shop URL</label>
              <input
                type="url"
                value={form?.shop_url || ''}
                onChange={(e)=>setForm(f=>({...(f as any), shop_url:e.target.value}))}
                readOnly={!isEditing}
                className={`w-full px-3 py-2 rounded border ${isEditing ? 'bg-white dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-700/70 cursor-not-allowed'}`}
                placeholder="https://yourshop.example.com"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Address</label>
              <textarea value={form?.address || ''} onChange={(e)=>setForm(f=>({...(f as any), address:e.target.value}))} rows={2} readOnly={!isEditing} className={`w-full px-3 py-2 rounded border ${isEditing ? 'bg-white dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-700/70 cursor-not-allowed'}`} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Age</label>
              <input type="number" value={form?.age || ''} onChange={(e)=>setForm(f=>({...(f as any), age:e.target.value}))} readOnly={!isEditing} className={`w-full px-3 py-2 rounded border ${isEditing ? 'bg-white dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-700/70 cursor-not-allowed'}`} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Business Type</label>
              <input value={form?.business_type || ''} onChange={(e)=>setForm(f=>({...(f as any), business_type:e.target.value}))} readOnly={!isEditing} className={`w-full px-3 py-2 rounded border ${isEditing ? 'bg-white dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-700/70 cursor-not-allowed'}`} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Business Category</label>
              <input value={form?.business_category || ''} onChange={(e)=>setForm(f=>({...(f as any), business_category:e.target.value}))} readOnly={!isEditing} className={`w-full px-3 py-2 rounded border ${isEditing ? 'bg-white dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-700/70 cursor-not-allowed'}`} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">GST Number</label>
              <input value={form?.gst_number || ''} onChange={(e)=>setForm(f=>({...(f as any), gst_number:e.target.value}))} readOnly={!isEditing} className={`w-full px-3 py-2 rounded border ${isEditing ? 'bg-white dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-700/70 cursor-not-allowed'}`} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">PAN Number</label>
              <input value={form?.pan_number || ''} onChange={(e)=>setForm(f=>({...(f as any), pan_number:e.target.value}))} readOnly={!isEditing} className={`w-full px-3 py-2 rounded border ${isEditing ? 'bg-white dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-700/70 cursor-not-allowed'}`} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Bank Name</label>
              <input value={form?.bank_name || ''} onChange={(e)=>setForm(f=>({...(f as any), bank_name:e.target.value}))} readOnly={!isEditing} className={`w-full px-3 py-2 rounded border ${isEditing ? 'bg-white dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-700/70 cursor-not-allowed'}`} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">Account Number</label>
              <input value={form?.account_number || ''} onChange={(e)=>setForm(f=>({...(f as any), account_number:e.target.value}))} readOnly={!isEditing} className={`w-full px-3 py-2 rounded border ${isEditing ? 'bg-white dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-700/70 cursor-not-allowed'}`} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">IFSC Code</label>
              <input value={form?.ifsc_code || ''} onChange={(e)=>setForm(f=>({...(f as any), ifsc_code:e.target.value}))} readOnly={!isEditing} className={`w-full px-3 py-2 rounded border ${isEditing ? 'bg-white dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-700/70 cursor-not-allowed'}`} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">UPI ID (optional)</label>
              <input value={form?.upi_id || ''} onChange={(e)=>setForm(f=>({...(f as any), upi_id:e.target.value}))} readOnly={!isEditing} className={`w-full px-3 py-2 rounded border ${isEditing ? 'bg-white dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-700/70 cursor-not-allowed'}`} />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            {isEditing ? (
              <>
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save Profile'}</button>
              </>
            ) : (
              <button onClick={close} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700">Close</button>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded shadow-lg ${toast.type==='success'?'bg-green-600 text-white':'bg-red-600 text-white'}`}>
          <div className="flex items-center space-x-2">
            <span className="font-medium">{toast.type==='success'?'Success':'Error'}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
