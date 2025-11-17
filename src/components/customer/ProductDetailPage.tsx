import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCart } from '../../contexts/CartContext';
import { Sparkles, Wallet } from 'lucide-react';

type Row = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  category: string | null;
  purity: string | null;
  weight: number | null;
  discount_percent: number | null;
  stock_qty: number | null;
  metal_type: string | null;
  gemstone: string | null;
  merchant_id?: string | null;
};

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();

  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // EMI controls
  const [tenure, setTenure] = useState(6);
  const [monthlyRate, setMonthlyRate] = useState(0.03);

  useEffect(() => {
    (async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id,name,description,price,image_url,category,purity,weight,discount_percent,stock_qty,metal_type,gemstone,merchant_id')
          .eq('id', id)
          .single();
        if (error) throw error;
        setRow(data as Row);
      } catch (e: any) {
        setError(e?.message || 'Failed to load product');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const basePrice = row?.price ? Number(row.price) : 0;
  const dp = row?.discount_percent ? Number(row.discount_percent) : 0;
  const discountedPrice = dp > 0 ? basePrice - (basePrice * dp / 100) : basePrice;
  const isInStock = (row?.stock_qty ?? 0) > 0;
  const makingCharges = Math.round(basePrice * 0.12);

  const emi = useMemo(() => {
    const P = discountedPrice;
    const r = monthlyRate;
    const n = tenure;
    if (P <= 0 || r <= 0 || n <= 0) return 0;
    const pow = Math.pow(1 + r, n);
    return Math.round((P * r * pow) / (pow - 1));
  }, [discountedPrice, monthlyRate, tenure]);

  const handleAddToCart = () => {
    if (!row) return;
    add({ id: row.id, name: row.name, price: discountedPrice, image_url: row.image_url || '' });
  };

  const handleBuyNow = () => {
    handleAddToCart();
    if (!row) {
      navigate('/customer/payment-choice');
      return;
    }
    navigate('/customer/payment-choice', {
      state: {
        price: discountedPrice,
        productId: row.id,
        productName: row.name,
        productImage: row.image_url || '',
        productCategory: row.category,
        merchantId: row.merchant_id || null,
      },
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
        <div className="grid md:grid-cols-2 gap-6">
          <div className="aspect-[4/3] bg-gray-200 rounded" />
          <div className="space-y-4">
            <div className="h-6 w-64 bg-gray-200 rounded" />
            <div className="h-4 w-80 bg-gray-200 rounded" />
            <div className="h-32 w-full bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="p-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow">
          <div className="text-red-600">{error || 'Product not found'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{row.name}</h1>
        <p className="text-gray-500 dark:text-gray-300">{row.category}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow overflow-hidden">
          <div className="aspect-[4/3] bg-gray-50 dark:bg-gray-800">
            {row.image_url ? (
              <img src={row.image_url} alt={row.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-5 shadow space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold">Specifications</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg border">Purity <div className="font-semibold">{row.purity}</div></div>
              <div className="p-3 rounded-lg border">Weight <div className="font-semibold">{row.weight ?? 0}g</div></div>
              <div className="p-3 rounded-lg border">Stock <div className={`font-semibold ${isInStock ? 'text-green-600' : 'text-red-600'}`}>{row.stock_qty ?? 0}</div></div>
              <div className="p-3 rounded-lg border">Metal <div className="font-semibold">{row.metal_type || '—'}</div></div>
              <div className="p-3 rounded-lg border">Gemstone <div className="font-semibold">{row.gemstone || '—'}</div></div>
              <div className="p-3 rounded-lg border">Making Charges <div className="font-semibold">
                ₹{makingCharges.toLocaleString('en-IN')}
              </div></div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl p-5 shadow space-y-3">
            {dp > 0 ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="line-through text-gray-400">₹{basePrice.toLocaleString('en-IN')}</span>
                  <span className="text-green-600 font-semibold">Save ₹{(basePrice - discountedPrice).toLocaleString('en-IN')}</span>
                </div>
                <div className="text-2xl font-bold">₹{discountedPrice.toLocaleString('en-IN')}</div>
              </div>
            ) : (
              <div className="text-2xl font-bold">₹{basePrice.toLocaleString('en-IN')}</div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleAddToCart} disabled={!isInStock} className={`px-4 py-3 rounded-lg font-semibold ${isInStock ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-gray-200 text-gray-400'}`}>Add to Cart</button>
              <button onClick={handleBuyNow} disabled={!isInStock} className={`px-4 py-3 rounded-lg font-semibold ${isInStock ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-200 text-gray-400'}`}>
                <Wallet className="w-5 h-5 inline mr-2"/>Buy Now
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl p-5 shadow space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Flexible EMI</div>
              <div className="text-sm text-gray-500">Monthly EMI estimate</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tenure (months)</label>
                <select value={tenure} onChange={(e)=> setTenure(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg">
                  {[3,6,9,12,18,24].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Monthly Rate</label>
                <select value={monthlyRate} onChange={(e)=> setMonthlyRate(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg">
                  <option value={0.02}>2% / mo</option>
                  <option value={0.025}>2.5% / mo</option>
                  <option value={0.03}>3% / mo</option>
                  <option value={0.035}>3.5% / mo</option>
                  <option value={0.04}>4% / mo</option>
                </select>
              </div>
            </div>
            <div className="mt-1 text-lg font-bold">EMI: ₹{emi.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl p-5 shadow">
        <h3 className="font-semibold mb-2">About</h3>
        <p className="text-gray-600 dark:text-gray-300 text-sm">{row.description || 'No description provided.'}</p>
      </div>
    </div>
  );
}
