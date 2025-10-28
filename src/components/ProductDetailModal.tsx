import React from 'react';
import { X, Wallet, Tag, Weight, Sparkles } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useNavigate } from 'react-router-dom';

interface Product {
  id: string;
  name: string;
  category: string;
  purity: string;
  weight: number;
  price: number;
  discount_percent: number;
  stock_quantity: number;
  image_url: string;
  description: string;
}

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
}

export default function ProductDetailModal({ product, onClose }: ProductDetailModalProps) {
  const basePrice = typeof product.price === 'number' ? product.price : 0;
  const dp = typeof product.discount_percent === 'number' ? product.discount_percent : 0;
  const discountedPrice = dp > 0 ? basePrice - (basePrice * dp / 100) : basePrice;
  const makingCharges = Math.round(basePrice * 0.12);
  const isInStock = product.stock_quantity > 0;
  const [payFlow, setPayFlow] = React.useState<'pay_now' | 'finance'>('pay_now');
  const [payMethod, setPayMethod] = React.useState<'card' | 'upi' | 'netbanking' | 'wallet' | null>(null);
  const { add } = useCart();
  const navigate = useNavigate();

  const [tenure, setTenure] = React.useState<number>(6);
  const [monthlyRate, setMonthlyRate] = React.useState<number>(0.03); // 3% default
  const emi = React.useMemo(() => {
    const P = discountedPrice;
    const r = monthlyRate;
    const n = tenure;
    if (P <= 0 || r <= 0 || n <= 0) return 0;
    const pow = Math.pow(1 + r, n);
    return Math.round((P * r * pow) / (pow - 1));
  }, [discountedPrice, monthlyRate, tenure]);

  const handleAddToCart = () => {
    add({ id: product.id, name: product.name, price: discountedPrice, image_url: product.image_url });
  };

  const handleBuyNow = () => {
    handleAddToCart();
    navigate('/customer/checkout');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-label="Product details">
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Product Details</h2>
          <button
            onClick={onClose}
            type="button"
            aria-label="Close"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
            <div className="space-y-4">
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-amber-50 to-yellow-50 shadow-lg">
                <img
                  src={product.image_url}
                  alt={product.name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                {product.discount_percent > 0 && (
                  <div className="absolute top-4 right-4 bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    {product.discount_percent}% OFF
                  </div>
                )}
              </div>

              {!isInStock && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <p className="text-red-600 font-semibold">Currently Out of Stock</p>
                  <p className="text-red-500 text-sm mt-1">We'll notify you when available</p>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">{product.name}</h1>
                  <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-sm font-semibold">
                    {product.purity}
                  </span>
                </div>
                <p className="text-gray-600 dark:text-gray-300 capitalize text-sm">{product.category}</p>
              </div>

              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{product.description}</p>

              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-gray-800 dark:to-gray-800 rounded-xl p-6 space-y-4">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                  Specifications
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                      <Weight className="w-4 h-4" />
                      Weight
                    </div>
                    <div className="font-bold text-gray-800 dark:text-gray-100">{product.weight}g</div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                    <div className="text-gray-500 dark:text-gray-300 text-sm mb-1">Purity</div>
                    <div className="font-bold text-amber-600">{product.purity}</div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                    <div className="text-gray-500 dark:text-gray-300 text-sm mb-1">Making Charges</div>
                    <div className="font-bold text-gray-800 dark:text-gray-100">₹{makingCharges.toLocaleString()}</div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                    <div className="text-gray-500 dark:text-gray-300 text-sm mb-1">Stock</div>
                    <div className={`font-bold ${isInStock ? 'text-green-600' : 'text-red-600'}`}>
                      {isInStock ? `${product.stock_quantity} available` : 'Out of stock'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 border-2 border-amber-200 dark:border-amber-300 rounded-xl p-6">
                <div className="space-y-3">
                  {product.discount_percent > 0 ? (
                    <>
                      <div className="flex justify-between text-gray-600 dark:text-gray-300">
                        <span>Original Price</span>
                        <span className="line-through">₹{basePrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-green-600 font-semibold">
                        <span>Discount ({product.discount_percent}%)</span>
                        <span>-₹{(basePrice - discountedPrice).toLocaleString()}</span>
                      </div>
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between items-center">
                        <span className="text-lg font-bold text-gray-800 dark:text-gray-100">Total Price</span>
                        <span className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">
                          ₹{discountedPrice.toLocaleString()}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-800 dark:text-gray-100">Total Price</span>
                      <span className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">
                        ₹{basePrice.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Payment Options</h3>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPayFlow('pay_now')}
                    disabled={!isInStock}
                    className={`py-3 rounded-xl font-semibold border transition-all ${
                      payFlow === 'pay_now'
                        ? 'bg-amber-100 border-amber-300 text-amber-700'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                    } ${!isInStock ? 'opacity-50 cursor-not-allowed' : ''}`}
                    type="button"
                  >
                    Pay Now
                  </button>
                  <button
                    onClick={() => setPayFlow('finance')}
                    disabled={!isInStock}
                    className={`py-3 rounded-xl font-semibold border transition-all ${
                      payFlow === 'finance'
                        ? 'bg-amber-100 border-amber-300 text-amber-700'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                    } ${!isInStock ? 'opacity-50 cursor-not-allowed' : ''}`}
                    type="button"
                  >
                    Finance Option
                  </button>
                </div>

                {payFlow === 'pay_now' ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <button
                        onClick={() => setPayMethod('card')}
                        className={`px-4 py-3 rounded-lg border text-sm font-medium ${payMethod === 'card' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-200'}`}
                        type="button"
                      >
                        Credit/Debit Card
                      </button>
                      <button
                        onClick={() => setPayMethod('upi')}
                        className={`px-4 py-3 rounded-lg border text-sm font-medium ${payMethod === 'upi' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-200'}`}
                        type="button"
                      >
                        UPI
                      </button>
                      <button
                        onClick={() => setPayMethod('netbanking')}
                        className={`px-4 py-3 rounded-lg border text-sm font-medium ${payMethod === 'netbanking' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-200'}`}
                        type="button"
                      >
                        NetBanking
                      </button>
                      <button
                        onClick={() => setPayMethod('wallet')}
                        className={`px-4 py-3 rounded-lg border text-sm font-medium ${payMethod === 'wallet' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-200'}`}
                        type="button"
                      >
                        Digital Wallet
                      </button>
                    </div>

                    {/* Details panel */}
                    {payMethod === 'card' && (
                      <div className="space-y-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="grid grid-cols-1 gap-3">
                          <input className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2" placeholder="Card Number" />
                          <input className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2" placeholder="Name on Card" />
                          <div className="grid grid-cols-2 gap-3">
                            <input className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2" placeholder="MM/YY" />
                            <input className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2" placeholder="CVV" />
                          </div>
                        </div>
                        <button className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold">Pay ₹{discountedPrice.toLocaleString()}</button>
                      </div>
                    )}
                    {payMethod === 'upi' && (
                      <div className="space-y-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <input className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 w-full" placeholder="Enter UPI ID (e.g., name@upi)" />
                        <div className="text-sm text-gray-600 dark:text-gray-300">We also support QR — proceed to see QR.</div>
                        <button className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold">Pay ₹{discountedPrice.toLocaleString()}</button>
                      </div>
                    )}
                    {payMethod === 'netbanking' && (
                      <div className="space-y-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <select className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 w-full">
                          <option>Select your bank</option>
                          <option>HDFC Bank</option>
                          <option>ICICI Bank</option>
                          <option>SBI</option>
                          <option>Axis Bank</option>
                          <option>Kotak Bank</option>
                        </select>
                        <button className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold">Proceed to Bank</button>
                      </div>
                    )}
                    {payMethod === 'wallet' && (
                      <div className="space-y-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <select className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 w-full">
                          <option>Select wallet</option>
                          <option>Paytm</option>
                          <option>PhonePe</option>
                          <option>Amazon Pay</option>
                          <option>Mobikwik</option>
                        </select>
                        <button className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold">Pay ₹{discountedPrice.toLocaleString()}</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-400/40 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-300">
                      Finance/EMI flow can be completed after KYC and eligibility check. We’ll guide you through a quick application.
                    </div>
                    <button
                      disabled={!isInStock}
                      className={`w-full flex items-center justify-center gap-3 py-3 rounded-xl font-semibold border-2 transition-all duration-200 ${
                        isInStock ? 'border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10' : 'border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed'
                      }`}
                      type="button"
                      aria-disabled={!isInStock}
                    >
                      <Wallet className="w-5 h-5" />
                      Start Finance Application
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold text-gray-800 dark:text-gray-100">Flexible EMI</div>
                    <div className="text-sm text-gray-500">Monthly EMI estimate</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tenure (months)</label>
                      <select value={tenure} onChange={(e)=> setTenure(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                        {[3,6,9,12,18,24].map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Monthly Rate</label>
                      <select value={monthlyRate} onChange={(e)=> setMonthlyRate(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                        <option value={0.02}>2% / mo</option>
                        <option value={0.025}>2.5% / mo</option>
                        <option value={0.03}>3% / mo</option>
                        <option value={0.035}>3.5% / mo</option>
                        <option value={0.04}>4% / mo</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-3 text-lg font-bold">EMI: ₹{emi.toLocaleString('en-IN')}</div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleAddToCart}
                    disabled={!isInStock}
                    className={`flex-1 flex items-center justify-center gap-2 ${isInStock ? 'bg-amber-500 hover:bg-amber-600' : 'bg-gray-300'} text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 shadow`}
                  >
                    Add to Cart
                  </button>
                  <button
                    onClick={handleBuyNow}
                    disabled={!isInStock}
                    className={`flex-1 flex items-center justify-center gap-2 ${isInStock ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300'} text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 shadow`}
                  >
                    <Wallet className="w-5 h-5" /> Buy Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
