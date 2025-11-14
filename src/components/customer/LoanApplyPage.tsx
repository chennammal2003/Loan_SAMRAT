import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useState } from 'react';

export default function LoanApplyPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const location = useLocation();
  const tenure = (location.state as any)?.tenure as number | undefined;
  const emi = (location.state as any)?.emi as number | undefined;
  const amount = (location.state as any)?.amount as number | undefined;

  const [form, setForm] = useState({
    full_name: profile?.username || '',
    email: profile?.email || '',
    phone: '',
    address: '',
    pan: '',
    aadhaar: '',
    occupation: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      // Optional: persist a loan application (ignore error if table/columns missing)
      const { error: _ignore } = await supabase
        .from('loan_applications')
        .insert([{ user_id: user?.id, amount: amount || 0, tenure: tenure || 0, emi: emi || 0, ...form }]);
      navigate('/customer/checkout', { state: { payType: 'emi' } });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6">
        <h1 className="text-xl font-bold mb-4">Loan Application</h1>
        <div className="mb-4 p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
          <div className="font-semibold">Selected Tenure</div>
          <div className="text-sm text-gray-700 dark:text-gray-300">{tenure ?? '-'} Months · EMI: ₹{(emi ?? 0).toLocaleString('en-IN')}</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Full Name</label>
            <input value={form.full_name} onChange={(e)=> setForm({...form, full_name: e.target.value})} className="w-full px-3 py-2 border rounded" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Email</label>
            <input value={form.email} onChange={(e)=> setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border rounded" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Phone</label>
            <input value={form.phone} onChange={(e)=> setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 border rounded" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Address</label>
            <input value={form.address} onChange={(e)=> setForm({...form, address: e.target.value})} className="w-full px-3 py-2 border rounded" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">PAN Number</label>
            <input value={form.pan} onChange={(e)=> setForm({...form, pan: e.target.value})} className="w-full px-3 py-2 border rounded" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Aadhaar Number</label>
            <input value={form.aadhaar} onChange={(e)=> setForm({...form, aadhaar: e.target.value})} className="w-full px-3 py-2 border rounded" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-500 mb-1">Occupation</label>
            <input value={form.occupation} onChange={(e)=> setForm({...form, occupation: e.target.value})} className="w-full px-3 py-2 border rounded" />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button disabled={submitting} onClick={submit} className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold">Submit</button>
          <button onClick={()=> navigate(-1)} className="px-5 py-2.5 rounded-lg border">Back</button>
        </div>
      </div>
    </div>
  );
}
