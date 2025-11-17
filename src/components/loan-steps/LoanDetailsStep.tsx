import React, { useEffect } from 'react';
import { LoanFormData } from '../ApplyLoanModal';
import { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface LoanDetailsStepProps {
  formData: LoanFormData;
  setFormData: React.Dispatch<React.SetStateAction<LoanFormData>>;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export default function LoanDetailsStep({ formData, setFormData, errors, setErrors }: LoanDetailsStepProps) {
  const { user } = useAuth();
  const [products, setProducts] = useState<{
    id: string;
    name: string;
    image_url: string;
    category: string;
    purity: string;
    price: number;
    stock_quantity: number;
  }[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [prodError, setProdError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPurity, setFilterPurity] = useState('');
  const [viewProduct, setViewProduct] = useState<null | {
    id: string;
    name: string;
    image_url: string;
    category: string;
    purity: string;
    price: number;
    stock_quantity: number;
  }>(null);
  // NBFC terms (from admin tie-up)
  const [nbfcTerms, setNbfcTerms] = useState<{ interest_rate?: number | null; default_tenure?: number | null; processing_fee?: number | null; processing_fee_percent?: number | null; tenure_options?: number[] | null } | null>(null);

  useEffect(() => {
    (async () => {
      if (!user?.id) {
        setProducts([]);
        return;
      }
      setLoadingProducts(true);
      setProdError(null);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id,name,image_url,category,purity,price,stock_qty')
          .eq('merchant_id', user.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        const mapped = (data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          image_url: p.image_url || '',
          category: p.category || '',
          purity: p.purity || '',
          price: typeof p.price === 'number' ? p.price : 0,
          stock_quantity: typeof p.stock_qty === 'number' ? p.stock_qty : 0,
        }));
        setProducts(mapped);
      } catch (e: any) {
        setProdError(e?.message || 'Failed to load products');
      } finally {
        setLoadingProducts(false);
      }
    })();
  }, [user?.id]);

  // Load NBFC terms for this merchant from tie-up (joins nbfc_profiles)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) return;
      try {
        const { data } = await supabase
          .from('nbfc_tieups')
          .select('nbfc:nbfc_profiles!nbfc_tieups_nbfc_id_fkey(interest_rate, default_tenure, processing_fee, processing_fee_percent, tenure_options)')
          .eq('merchant_id', user.id)
          .maybeSingle();
        const nb: any = (data as any)?.nbfc || {};
        const terms = {
          interest_rate: typeof nb.interest_rate === 'number' ? nb.interest_rate : null,
          default_tenure: typeof nb.default_tenure === 'number' ? nb.default_tenure : null,
          processing_fee: typeof nb.processing_fee === 'number' ? nb.processing_fee : null,
          processing_fee_percent: typeof nb.processing_fee_percent === 'number' ? nb.processing_fee_percent : null,
          tenure_options: Array.isArray(nb.tenure_options) ? nb.tenure_options.map((x: any)=> Number(x)).filter((n: any)=> Number.isFinite(n) && n>0) : null,
        } as const;
        if (!cancelled) setNbfcTerms(terms);
        // Prefill tenure if empty and default available
        if (!cancelled && terms.default_tenure && !formData.tenure) {
          setFormData(prev => ({ ...prev, tenure: String(terms.default_tenure) }));
        }
      } catch (_) {
        if (!cancelled) setNbfcTerms({ interest_rate: null, default_tenure: null, processing_fee: null, processing_fee_percent: null, tenure_options: null });
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [products]);

  const purities = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => p.purity && set.add(p.purity));
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(p => {
      const okSearch = p.name.toLowerCase().includes(q);
      const okCat = !filterCategory || p.category === filterCategory;
      const okPur = !filterPurity || p.purity === filterPurity;
      const okStock = p.stock_quantity > 0;
      return okSearch && okCat && okPur && okStock;
    });
  }, [products, search, filterCategory, filterPurity]);
  
  // Recalculate loan amount whenever selected products change
  useEffect(() => {
    const total = (formData.selectedProducts || []).reduce((sum, p) => sum + (p.price || 0), 0);
    if (!isNaN(total)) {
      setFormData((prev) => ({ ...prev, loanAmount: total ? String(Math.round(total)) : '' }));
    }
  }, [formData.selectedProducts]);
  // Processing fee from NBFC: percent or flat, with GST 18%
  useEffect(() => {
    const amount = formData.loanAmount ? parseFloat(formData.loanAmount) : 0;
    if (!amount || Number.isNaN(amount)) return;
    const pct = nbfcTerms?.processing_fee_percent;
    const flat = nbfcTerms?.processing_fee;
    let feeBase = 0;
    if (typeof pct === 'number' && pct > 0) feeBase = amount * (pct / 100);
    else if (typeof flat === 'number' && flat > 0) feeBase = flat;
    const gst = feeBase * 0.18;
    const total = feeBase + gst;
    setFormData((prev) => ({ ...prev, processingFee: total }));
  }, [formData.loanAmount, nbfcTerms?.processing_fee_percent, nbfcTerms?.processing_fee]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, proformaInvoice: 'File size must be less than 5MB' }));
        return;
      }
      setFormData((prev) => ({ ...prev, proformaInvoice: file }));
      setErrors((prev) => ({ ...prev, proformaInvoice: '' }));
    }
  };

  return (
    <>
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Choose Product <span className="text-red-500">*</span>
        </label>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={search}
              onChange={(e)=> setSearch(e.target.value)}
              placeholder="Search products..."
              className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-900"
            />
            <select value={filterCategory} onChange={(e)=> setFilterCategory(e.target.value)} className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-900">
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterPurity} onChange={(e)=> setFilterPurity(e.target.value)} className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-900">
              <option value="">All Purities</option>
              {purities.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {loadingProducts ? (
            <div className="text-sm text-gray-500">Loading products…</div>
          ) : prodError ? (
            <div className="text-sm text-red-600">{prodError}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map(p => {
                const selected = (formData.selectedProducts || []).some(sp => sp.id === p.id);
                return (
                  <div
                    key={p.id}
                    className={`relative text-left rounded-lg border overflow-hidden hover:shadow transition ${selected ? 'border-amber-500 ring-2 ring-amber-300' : 'border-gray-200 dark:border-gray-700'}`}
                  >
                    <label className="absolute top-2 left-2 z-10 bg-white/80 dark:bg-gray-900/80 rounded p-1 shadow">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => {
                          setFormData(prev => {
                            const exists = (prev.selectedProducts || []).some(sp => sp.id === p.id);
                            const next = exists
                              ? (prev.selectedProducts || []).filter(sp => sp.id !== p.id)
                              : [...(prev.selectedProducts || []), { id: p.id, name: p.name, price: p.price }];
                            return { ...prev, selectedProducts: next };
                          });
                        }}
                        className="w-4 h-4"
                        aria-label={`Select ${p.name}`}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setViewProduct(p)}
                      className="w-full aspect-square bg-gray-50 dark:bg-gray-900"
                    >
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                      )}
                    </button>
                    <div className="p-2">
                      <div className="text-sm font-semibold line-clamp-1">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.category} • {p.purity}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">₹{p.price?.toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-full text-sm text-gray-500">No products match filters</div>
              )}
            </div>
          )}
        </div>
        {errors.selectedProducts && <p className="text-red-500 text-sm mt-1">{errors.selectedProducts}</p>}

        {(formData.selectedProducts && formData.selectedProducts.length > 0) && (
          <div className="mt-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="text-sm font-medium mb-2">Selected ({formData.selectedProducts.length})</div>
            <div className="flex flex-wrap gap-2">
              {formData.selectedProducts.map(sp => (
                <span key={sp.id} className="text-xs px-2 py-1 bg-white dark:bg-gray-900 border rounded">
                  {sp.name} • ₹{sp.price.toLocaleString('en-IN')}
                </span>
              ))}
            </div>
            <div className="mt-3 text-sm">
              <span className="font-semibold">Total Amount:</span>{' '}
              ₹{formData.selectedProducts.reduce((s,p)=>s+p.price,0).toLocaleString('en-IN')}
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Gold Price Lock Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={formData.goldPriceLockDate}
          onChange={(e) => setFormData((prev) => ({ ...prev, goldPriceLockDate: e.target.value }))}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        {errors.goldPriceLockDate && <p className="text-red-500 text-sm mt-1">{errors.goldPriceLockDate}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Proforma Invoice / Estimate <span className="text-red-500">*</span>
        </label>
        <input
          type="file"
          onChange={handleFileChange}
          accept=".pdf,.jpg,.jpeg,.png"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">PDF, JPG, or PNG (Max 5MB)</p>
        {errors.proformaInvoice && <p className="text-red-500 text-sm mt-1">{errors.proformaInvoice}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Down Payment Details
        </label>
        <textarea
          value={formData.downPaymentDetails}
          onChange={(e) => setFormData((prev) => ({ ...prev, downPaymentDetails: e.target.value }))}
          placeholder="e.g., ₹10,000 paid via UPI"
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Down Payment Amount
        </label>
        <input
          type="number"
          value={formData.downPaymentAmount}
          onChange={(e) => setFormData((prev) => ({ ...prev, downPaymentAmount: e.target.value }))}
          placeholder="₹"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Loan Amount (auto from selected products) <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.loanAmount ? `₹${Number(formData.loanAmount).toLocaleString('en-IN')}` : ''}
          readOnly
          placeholder="Select products to compute amount"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
        />
        {errors.loanAmount && <p className="text-red-500 text-sm mt-1">{errors.loanAmount}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tenure <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.tenure}
          onChange={(e) => setFormData((prev) => ({ ...prev, tenure: e.target.value }))}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="">Select Tenure</option>
          {(nbfcTerms?.tenure_options && nbfcTerms.tenure_options.length ? nbfcTerms.tenure_options : [3,6,9,12]).map(m => (
            <option key={m} value={m}>{m} Months</option>
          ))}
        </select>
        {errors.tenure && <p className="text-red-500 text-sm mt-1">{errors.tenure}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tenure-wise EMI Breakup
        </label>
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          {formData.loanAmount && formData.tenure ? (
            <div className="space-y-2">
              {(() => {
                const totalAmount = (formData.selectedProducts || []).reduce((sum, p) => sum + (p.price || 0), 0);
                const downPayment = formData.downPaymentAmount ? parseFloat(formData.downPaymentAmount) : 0;
                const safeDownPayment = Number.isFinite(downPayment) && downPayment > 0 ? downPayment : 0;
                const principal = Math.max(totalAmount - safeDownPayment, 0);
                const tenure = parseInt(formData.tenure);

                // EMI calculation using standard formula: EMI = P * r * (1+r)^n / ((1+r)^n - 1)
                // Use NBFC tie-up interest_rate (% per annum) if available; fallback to 3% monthly
                const calculateEMI = (principal: number, months: number) => {
                  const annualPct = nbfcTerms?.interest_rate;
                  const rate = typeof annualPct === 'number' && annualPct > 0 ? (annualPct / 12) / 100 : 0.03; // fallback 3% monthly
                  const numerator = principal * rate * Math.pow(1 + rate, months);
                  const denominator = Math.pow(1 + rate, months) - 1;
                  return Math.round(numerator / denominator);
                };

                const emiAmount = calculateEMI(principal, tenure);
                const totalPayable = emiAmount * tenure;
                const interestAmount = Math.max(totalPayable - principal, 0);

                return (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p><strong>Principal (after down payment):</strong> ₹{principal.toLocaleString('en-IN')}</p>
                    <p><strong>{tenure} Months EMI:</strong> ₹{emiAmount.toLocaleString('en-IN')} / month</p>
                    <p className="text-xs mt-1">Total Payable: ₹{totalPayable.toLocaleString('en-IN')}</p>
                    <p className="text-xs">Total Interest: ₹{interestAmount.toLocaleString('en-IN')}</p>
                  </div>
                );
              })()}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">Select loan amount and tenure to see EMI breakup</p>
          )}
        </div>
      </div>

      <div>
        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.gstAccepted as unknown as boolean}
            onChange={(e) => setFormData((prev) => ({ ...prev, gstAccepted: e.target.checked }))}
            className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            I accept GST charges on the processing fee. <span className="text-red-500">*</span>
          </span>
        </label>
        {errors.gstAccepted && <p className="text-red-500 text-sm mt-1">{errors.gstAccepted}</p>}
      </div>
    </div>
    {viewProduct && (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{viewProduct!.name}</h3>
            <button className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => setViewProduct(null)}>✕</button>
          </div>
          <div className="p-4 space-y-4">
            <div className="w-full aspect-video bg-gray-50 dark:bg-gray-900 rounded overflow-hidden">
              {viewProduct!.image_url ? (
                <img src={viewProduct!.image_url} alt={viewProduct!.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
              )}
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <div><span className="font-medium">Category:</span> {viewProduct!.category || '-'} </div>
              <div><span className="font-medium">Purity:</span> {viewProduct!.purity || '-'} </div>
              <div><span className="font-medium">Price:</span> ₹{viewProduct!.price?.toLocaleString('en-IN')}</div>
              <div><span className="font-medium">Stock Qty:</span> {viewProduct!.stock_quantity}</div>
              <div className="text-xs text-gray-500">ID: {viewProduct!.id}</div>
            </div>
          </div>
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
            <button
              className="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
              onClick={() => setViewProduct(null)}
            >Close</button>
            <button
              className="px-4 py-2 rounded bg-blue-600 text-white"
              onClick={() => {
                setFormData(prev => {
                  const exists = (prev.selectedProducts || []).some(sp => sp.id === viewProduct!.id);
                  const next = exists
                    ? prev.selectedProducts
                    : [...(prev.selectedProducts || []), { id: viewProduct!.id, name: viewProduct!.name, price: viewProduct!.price }];
                  return { ...prev, selectedProducts: next };
                });
                setViewProduct(null);
              }}
            >Add to selection</button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
