import { useNavigate, useLocation } from 'react-router-dom';
import { CreditCard, Landmark } from 'lucide-react';

export default function PaymentChoicePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from ?? '/customer/checkout';
  const price = (location.state as any)?.price;
  const subtotal = (location.state as any)?.subtotal;
  const merchantId = (location.state as any)?.merchantId;
  const productId = (location.state as any)?.productId;
  const productName = (location.state as any)?.productName;
  const productImage = (location.state as any)?.productImage;
  const productCategory = (location.state as any)?.productCategory;

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6">
        <h1 className="text-xl font-bold mb-1">Choose Payment Method</h1>
        <p className="text-sm text-gray-500 mb-5">How would you like to pay for this item?</p>

        <div className="space-y-3">
          <button
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white"
            onClick={() => navigate('/customer/checkout', { state: { payType: 'online' } })}
          >
            <span className="flex items-center gap-3"><CreditCard className="w-5 h-5"/> Pay Now</span>
            <span className="text-sm opacity-90">Card / UPI / NetBanking / Wallet</span>
          </button>

          <button
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => navigate('/customer/finance-tenure', { state: { price, subtotal, merchantId, productId, productName, productImage, productCategory } })}
          >
            <span className="flex items-center gap-3"><Landmark className="w-5 h-5"/> Finance Option</span>
            <span className="text-sm opacity-90">EMI via simple application</span>
          </button>
        </div>
      </div>
    </div>
  );
}
