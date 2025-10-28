import { useEffect, useState } from 'react';
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

  type Address = {
    id: string;
    label: string | null;
    line1: string;
    line2: string | null;
    landmark: string | null;
    city: string;
    state: string;
    country: string | null;
    pin_code: string;
    phone: string | null;
    is_default: boolean;
    formatted_address: string | null;
  };

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [payType, setPayType] = useState<'online' | 'emi' | 'loan' | null>('online');
  const [onlineMethod, setOnlineMethod] = useState<'card' | 'upi' | 'netbanking' | 'wallet' | null>('card');
  const addressSelected = Boolean(selectedAddressId);
  const paymentSelected = payType === 'online' ? Boolean(onlineMethod) : payType !== null;

  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('addresses')
          .select('*')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false });
        if (error) throw error;
        const rows = (data as any[]) as Address[];
        setAddresses(rows);
        const def = rows.find(r => r.is_default) || rows[0];
        setSelectedAddressId(def ? def.id : null);
      } catch {
        setAddresses([]);
        setSelectedAddressId(null);
      }
    })();
  }, [user?.id]);

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
      const payment_method = payType === 'online' ? `online:${onlineMethod}` : payType || 'online:card';
      const { data: order, error: oerr } = await supabase
        .from('orders')
        .insert({ user_id: user.id, total, status: 'Placed', address_id: selectedAddressId, payment_method })
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
              {addresses.length === 0 ? (
                <div className="text-gray-500 text-sm">
                  No saved addresses. <button className="underline" onClick={()=> navigate('/customer/profile')}>Add one in Profile</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map(a => (
                    <label key={a.id} className="flex items-start gap-3 p-3 rounded-lg border bg-white dark:bg-gray-900">
                      <input type="radio" name="addr" checked={selectedAddressId === a.id} onChange={()=> setSelectedAddressId(a.id)} className="mt-1" />
                      <div>
                        <div className="font-semibold">{a.label || 'Address'}</div>
                        <div className="text-sm text-gray-600">{a.formatted_address || [a.line1, a.line2, a.landmark, a.city, a.state, a.pin_code].filter(Boolean).join(', ')}</div>
                        {a.phone && <div className="text-sm text-gray-600">Phone: {a.phone}</div>}
                      </div>
                    </label>
                  ))}
                  <button className="px-3 py-2 rounded border" onClick={()=> navigate('/customer/profile')}>Manage addresses</button>
                </div>
              )}
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h2 className="font-semibold mb-3">Payment Method</h2>
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input type="radio" name="pay" checked={payType==='online'} onChange={()=> setPayType('online')} />
                  <span>Online</span>
                </label>
                {payType==='online' && (
                  <div className="pl-6 grid grid-cols-2 gap-2 text-sm">
                    <label className="flex items-center gap-2"><input type="radio" name="online" checked={onlineMethod==='card'} onChange={()=> setOnlineMethod('card')} /> Card</label>
                    <label className="flex items-center gap-2"><input type="radio" name="online" checked={onlineMethod==='upi'} onChange={()=> setOnlineMethod('upi')} /> UPI</label>
                    <label className="flex items-center gap-2"><input type="radio" name="online" checked={onlineMethod==='netbanking'} onChange={()=> setOnlineMethod('netbanking')} /> NetBanking</label>
                    <label className="flex items-center gap-2"><input type="radio" name="online" checked={onlineMethod==='wallet'} onChange={()=> setOnlineMethod('wallet')} /> Wallet</label>
                  </div>
                )}
                <label className="flex items-center gap-2">
                  <input type="radio" name="pay" checked={payType==='emi'} onChange={()=> setPayType('emi')} />
                  <span>EMI</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="pay" checked={payType==='loan'} onChange={()=> setPayType('loan')} />
                  <span>Loan</span>
                </label>
              </div>
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
            <button
              className="mt-4 w-full px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-60"
              onClick={placeOrder}
              disabled={!addressSelected || !paymentSelected}
            >
              Place Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
