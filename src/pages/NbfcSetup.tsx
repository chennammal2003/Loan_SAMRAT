import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const APPROVAL_TYPES = ['Instant', 'Within 24 hrs', 'Manual Review'] as const;

export default function NbfcSetup() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [interestRate, setInterestRate] = useState<string>('');
  const [processingFee, setProcessingFee] = useState<string>('');
  const [approvalType, setApprovalType] = useState<typeof APPROVAL_TYPES[number]>('Instant');
  const [notes, setNotes] = useState('');
  const [tenureOptions, setTenureOptions] = useState<number[]>([]);
  const [tenureInput, setTenureInput] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile) return;
      // Only NBFC role (admin) is expected to use this
      if (profile.role !== 'admin') {
        navigate('/dashboard', { replace: true });
        return;
      }
      const { data, error } = await supabase
        .from('nbfc_profiles')
        .select('*')
        .eq('nbfc_id', profile.id)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) {
        // Already set up; go to dashboard
        navigate('/dashboard', { replace: true });
        return;
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.role, navigate]);

  const canSubmit = useMemo(() => {
    const ir = Number(interestRate);
    const pf = Number(processingFee);
    const approvalValid = APPROVAL_TYPES.includes(approvalType);
    return !!name && !Number.isNaN(ir) && ir >= 0 && !Number.isNaN(pf) && pf >= 0 && approvalValid && tenureOptions.length > 0;
  }, [name, interestRate, processingFee, approvalType, tenureOptions]);

  const addTenureFromInput = () => {
    const v = Number(tenureInput.trim());
    if (!Number.isNaN(v) && v > 0 && Number.isInteger(v)) {
      setTenureOptions(prev => (prev.includes(v) ? prev : [...prev, v].sort((a,b)=>a-b)));
      setTenureInput('');
    }
  };
  const removeTenure = (t: number) => {
    setTenureOptions(prev => prev.filter(x => x !== t));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const ir = Number(interestRate);
      const pf = Number(processingFee);

      const payload = {
        nbfc_id: profile.id,
        name,
        interest_rate: ir,
        default_tenure: null,
        processing_fee: pf,
        approval_type: approvalType,
        notes: notes || '',
        tenure_options: tenureOptions,
        updated_at: new Date().toISOString(),
      } as const;

      const { error } = await supabase
        .from('nbfc_profiles')
        .insert(payload);

      if (error) throw error;

      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Failed to save NBFC profile');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Preparing NBFC setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-start justify-center p-4 md:p-8">
      <div className="w-full max-w-3xl bg-white dark:bg-gray-800 shadow rounded-xl overflow-hidden">
        <div className="bg-blue-600 text-white px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Add NBFC Details</h1>
              <p className="text-blue-100">Enter the financial institution information — interest, tenure options, processing fee and approval type.</p>
            </div>
            <button onClick={toggleTheme} className="inline-flex items-center px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 transition">
              <span className="text-sm">{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        </div>
        <div className="p-6">

        {error && (
          <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">NBFC Name</label>
            <input value={name} onChange={(e)=>setName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="Enter NBFC name" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Interest Rate (% p.a)</label>
              <input type="number" step="0.01" min={0} value={interestRate} onChange={(e)=>setInterestRate(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="e.g., 12.50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Processing Fee (₹)</label>
              <input type="number" step="0.01" min={0} value={processingFee} onChange={(e)=>setProcessingFee(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="e.g., 5000" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tenure Options (months)</label>
            <div className="mt-1 flex gap-2">
              <input
                value={tenureInput}
                onChange={(e)=>setTenureInput(e.target.value)}
                onKeyDown={(e)=>{ if (e.key === 'Enter') { e.preventDefault(); addTenureFromInput(); } }}
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2"
                placeholder="Enter tenure in months (e.g., 12)"
              />
              <button type="button" onClick={addTenureFromInput} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Add</button>
            </div>
            <div className="mt-2">
              {tenureOptions.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">No tenure options added yet.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tenureOptions.map(t => (
                    <span key={t} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {t} months
                      <button type="button" onClick={()=>removeTenure(t)} className="text-blue-600 hover:text-blue-800">×</button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Press Enter in the tenure input to add quickly.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Approval Type</label>
            <select value={approvalType} onChange={(e)=>setApprovalType(e.target.value as any)} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2">
              <option value="">Select approval type</option>
              {APPROVAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea value={notes} onChange={(e)=>setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" placeholder="Any additional information..." />
          </div>

          <div className="pt-2">
            <button type="submit" disabled={!canSubmit || submitting} className={`w-full md:w-auto inline-flex items-center justify-center px-4 py-2 rounded text-white ${(!canSubmit || submitting) ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {submitting ? 'Saving...' : 'Save NBFC Details'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </div>
  );
}
