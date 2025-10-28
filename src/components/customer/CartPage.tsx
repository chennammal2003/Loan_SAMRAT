import { useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';

export default function CartPage() {
  const { items, remove, setQty, subtotal } = useCart();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Your Cart</h1>
        {items.length === 0 ? (
          <div className="text-gray-500">Your cart is empty.</div>
        ) : (
          <div className="space-y-4">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
                <img src={it.image_url || ''} alt={it.name} className="w-16 h-16 object-cover rounded" />
                <div className="flex-1">
                  <div className="font-semibold">{it.name}</div>
                  <div className="text-sm text-gray-500">₹{it.price.toLocaleString('en-IN')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 border rounded" onClick={() => setQty(it.id, Math.max(1, it.qty - 1))}>-</button>
                  <input value={it.qty} onChange={(e)=> setQty(it.id, Math.max(1, Number(e.target.value)||1))} className="w-12 text-center border rounded" />
                  <button className="px-2 py-1 border rounded" onClick={() => setQty(it.id, it.qty + 1)}>+</button>
                </div>
                <div className="w-24 text-right font-semibold">₹{(it.price * it.qty).toLocaleString('en-IN')}</div>
                <button className="ml-2 text-red-600" onClick={() => remove(it.id)}>Remove</button>
              </div>
            ))}
            <div className="flex justify-end items-center gap-6 pt-4">
              <div className="text-lg">Subtotal: <span className="font-bold">₹{subtotal.toLocaleString('en-IN')}</span></div>
              <button className="px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold" onClick={() => navigate('/customer/checkout')}>Checkout</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
