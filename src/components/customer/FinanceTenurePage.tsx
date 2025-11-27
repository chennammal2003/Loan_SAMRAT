import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type NbfcTerms = {
  interest_rate: number | null;
  tenure_options: number[] | null;
};

export default function FinanceTenurePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const price = (location.state as any)?.price as number | undefined;
  const subtotal = (location.state as any)?.subtotal as number | undefined;
  const merchantId = (location.state as any)?.merchantId as string | undefined;
  const productId = (location.state as any)?.productId as string | undefined;
  const productName = (location.state as any)?.productName as string | undefined;
  const productImage = (location.state as any)?.productImage as string | undefined;
  const productCategory = (location.state as any)?.productCategory as string | undefined;

  const grossAmount = typeof price === 'number' ? price : (typeof subtotal === 'number' ? subtotal : 0);
  const [downPayment, setDownPayment] = useState<string>('');
  const [nbfcTerms, setNbfcTerms] = useState<NbfcTerms | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTenure, setSelectedTenure] = useState<number | ''>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!merchantId) return;
      setLoading(true);
      try {
        const { data } = await supabase
          .from('nbfc_tieups')
          .select('nbfc:nbfc_profiles!nbfc_tieups_nbfc_id_fkey(interest_rate, tenure_options)')
          .eq('merchant_id', merchantId)
          .maybeSingle();
        const nb: any = (data as any)?.nbfc || {};
        const interest = typeof nb.interest_rate === 'number' ? nb.interest_rate : null;
        const optsRaw = nb.tenure_options ?? null;
        const opts: number[] | null = Array.isArray(optsRaw)
          ? optsRaw.map((x: any) => Number(x)).filter((n: any) => Number.isFinite(n) && n > 0)
          : null;
        if (!cancelled) {
          setNbfcTerms({ interest_rate: interest, tenure_options: opts && opts.length ? opts : null });
        }
      } catch (_) {
        if (!cancelled) setNbfcTerms({ interest_rate: null, tenure_options: null });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [merchantId]);

  const annualRate = nbfcTerms?.interest_rate != null ? nbfcTerms.interest_rate : 12; // default 12% p.a.
  const tenureOptions = nbfcTerms?.tenure_options && nbfcTerms.tenure_options.length
    ? nbfcTerms.tenure_options
    : [6, 12, 18, 24, 30, 36];

  const principal = useMemo(() => {
    const rawDown = downPayment ? parseFloat(downPayment) : 0;
    const safeDown = Number.isFinite(rawDown) && rawDown > 0 ? rawDown : 0;
    const p = Math.max(grossAmount - safeDown, 0);
    return { principal: p, safeDown };
  }, [grossAmount, downPayment]);

  const calcEmi = (months: number) => {
    const P = principal.principal;
    if (!P || !months) return 0;
    const r = (annualRate / 12) / 100; // monthly rate
    const pow = Math.pow(1 + r, months);
    return Math.round((P * r * pow) / (pow - 1));
  };

  const currentEmi = selectedTenure ? calcEmi(selectedTenure) : 0;
  const currentTotal = selectedTenure ? currentEmi * selectedTenure : 0;
  const currentInterest = Math.max(currentTotal - principal.principal, 0);
  const hasDownPaymentInput = downPayment.trim() !== '';

  return (
    <div className="max-w-xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow dark:shadow-lg p-6">
        <h1 className="text-xl font-bold mb-1 text-gray-900 dark:text-white">Select Tenure</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Choose your preferred tenure</p>
        <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          Product Price: ₹{grossAmount.toLocaleString('en-IN')} · Interest: {annualRate}% p.a.
        </div>

        <div className="mb-4">
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Down Payment Amount</label>
          <input
            type="number"
            value={downPayment}
            onChange={(e) => setDownPayment(e.target.value)}
            placeholder="Enter down payment"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            min={0}
            max={grossAmount}
          />
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            EMI will be calculated on principal = product price − down payment.
          </p>
        </div>

        <div className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          Principal after down payment: ₹{principal.principal.toLocaleString('en-IN')}
        </div>

        {loading ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">Loading finance options…</div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Select Tenure (months)</label>
              <select
                value={selectedTenure || ''}
                onChange={(e) => setSelectedTenure(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                <option value="">Select tenure</option>
                {tenureOptions.map((m) => (
                  <option key={m} value={m}>{m} Months</option>
                ))}
              </select>
            </div>

            {selectedTenure && hasDownPaymentInput ? (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                  <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-900 dark:text-gray-100">Tenure</th>
                      <th className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">Principal (₹)</th>
                      <th className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">EMI / month (₹)</th>
                      <th className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">Total Payable (₹)</th>
                      <th className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">Total Interest (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-amber-50 dark:bg-amber-900/20">
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{selectedTenure} Months</td>
                      <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{principal.principal.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{currentEmi.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{currentTotal.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{currentInterest.toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Enter down payment and select a tenure to see the EMI breakdown.
              </p>
            )}

            <button
              type="button"
              disabled={!selectedTenure || principal.principal <= 0}
              onClick={() => {
                if (!selectedTenure) return;
                navigate('/customer/loan-apply', {
                  state: {
                    tenure: selectedTenure,
                    emi: currentEmi,
                    amount: principal.principal,
                    downPayment: principal.safeDown,
                    interestRate: annualRate,
                    productId,
                    productName,
                    productImage,
                    productCategory,
                    productPrice: grossAmount,
                    merchantId,
                  },
                });
              }}
              className={`w-full mt-2 px-4 py-3 rounded-lg font-semibold text-white ${
                !selectedTenure || principal.principal <= 0
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
