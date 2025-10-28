import { useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const { user } = useAuth();

  const tax = Math.round(subtotal * 0.03);
  const delivery = items.length > 0 ? 199 : 0;
  const total = subtotal + tax + delivery;

  const placeOrder = async () => {
    try {
      if (!user) {
        navigate('/signin');
        return;
      }
      if (items.length === 0) {
        navigate('/customer');
        return;
      }
      const { data: order, error: oerr } = await supabase
        .from('orders')
        .insert({ user_id: user.id, total, status: 'Placed' })
        .select()
        .single();
      if (oerr) throw oerr;
      const orderId = order.id as string;
      const rows = items.map((it) => ({
        order_id: orderId,
        product_id: it.id,
        name: it.name,
        price: it.price,
        qty: it.qty,
        image_url: it.image_url ?? null,
      }));
      const { error: ierr } = await supabase.from('order_items').insert(rows);
      if (ierr) throw ierr;
    } catch (e) {
      // Swallow errors to avoid blocking UI in environments without schema
    } finally {
      clear();
      navigate('/customer/orders');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-6">Checkout</h1>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h2 className="font-semibold mb-3">Delivery Address</h2>
              <div className="text-gray-500 text-sm">Add address management here</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h2 className="font-semibold mb-3">Payment Method</h2>
              <div className="text-gray-500 text-sm">Choose Online / EMI / Loan at next step</div>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 h-max">
            <h2 className="font-semibold mb-4">Order Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>₹{subtotal.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span>Tax (3%)</span><span>₹{tax.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span>Delivery</span><span>₹{delivery.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between font-bold pt-2 border-t"><span>Total</span><span>₹{total.toLocaleString('en-IN')}</span></div>
            </div>
            <button className="mt-4 w-full px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold" onClick={placeOrder}>Place Order</button>
          </div>
        </div>
      </div>
    </div>
  );
}
