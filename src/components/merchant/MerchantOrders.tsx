import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface OrderRow {
  id: string;
  user_id: string;
  merchant_id: string | null;
  total: number;
  status: string;
  created_at?: string | null;
}

export default function MerchantOrders() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<'all' | 'backorders' | 'failed' | 'archived'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [payFilter, setPayFilter] = useState<string>('All');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>('All');
  const [query, setQuery] = useState('');
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<'created_at' | 'total' | 'status'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Detail modal state
  const [openId, setOpenId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [orderDetail, setOrderDetail] = useState<any | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [customer, setCustomer] = useState<any | null>(null);
  const [address, setAddress] = useState<any | null>(null);
  const [shipment, setShipment] = useState<any | null>(null);
  const [shipmentEvents, setShipmentEvents] = useState<any[]>([]);
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [creatingShipment, setCreatingShipment] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [awbNumber, setAwbNumber] = useState('');
  const [estimatedDate, setEstimatedDate] = useState('');
  const [shipmentValue, setShipmentValue] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!profile) return;
        // Expect orders table with merchant_id column; fallback to empty
        const { data, error } = await supabase
          .from('orders')
          .select('id,user_id,merchant_id,total,status,payment_status,fulfillment_status,created_at')
          .eq('merchant_id', profile.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setRows((data as any[]) as OrderRow[]);
      } catch (e: any) {
        setError(e?.message || 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    })();
  }, [profile?.id]);

  const orderStatuses = ['All', 'Placed', 'Shipped', 'Delivered', 'Cancelled'];
  const paymentStatuses = ['All', 'Pending', 'Completed', 'Failed', 'Refunded'];
  const fulfillmentStatuses = ['All', 'Unfulfilled', 'Packing', 'Ready For Pickup', 'Shipped', 'Out For Delivery', 'Delivered', 'Returned'];

  const sectionFilterFn = (r: OrderRow) => {
    if (section === 'backorders') return /back\s*order/i.test(r.status) || /back\s*ordered/i.test(r.status);
    if (section === 'failed') return /fail/i.test(r.status);
    if (section === 'archived') return /archive/i.test(r.status);
    return true; // all
  };

  const statusFilterFn = (r: any) => {
    if (statusFilter !== 'All' && r.status?.toLowerCase() !== statusFilter.toLowerCase()) return false;
    if (payFilter !== 'All' && r.payment_status?.toLowerCase() !== payFilter.toLowerCase()) return false;
    if (fulfillmentFilter !== 'All' && r.fulfillment_status?.toLowerCase() !== fulfillmentFilter.toLowerCase()) return false;
    return true;
  };

  const queryFilterFn = (r: OrderRow) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      r.id.toLowerCase().includes(q) ||
      r.status?.toLowerCase().includes(q)
    );
  };

  const filtered = rows
    .filter(sectionFilterFn)
    .filter(statusFilterFn)
    .filter(queryFilterFn)
    .sort((a, b) => {
      let aVal: any = a[sortKey];
      let bVal: any = b[sortKey];
      if (sortKey === 'created_at') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const setSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const openDetails = async (orderId: string) => {
    setOpenId(orderId);
    setDetailLoading(true);
    setOrderDetail(null);
    setOrderItems([]);
    setCustomer(null);
    setAddress(null);
    setShipment(null);
    setShipmentEvents([]);
    try {
      // Order core
      const { data: order, error: oerr } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      if (oerr) throw oerr;
      setOrderDetail(order);
      // Items
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);
      setOrderItems(items || []);
      // Customer
      if (order?.user_id) {
        const { data: user } = await supabase
          .from('user_profiles')
          .select('id,full_name,phone,address')
          .eq('id', order.user_id)
          .single();
        setCustomer(user || null);
      }
      // Address
      if (order?.address_id) {
        const { data: addr } = await supabase
          .from('addresses')
          .select('*')
          .eq('id', order.address_id)
          .single();
        setAddress(addr || null);
      }
      // Shipment
      const { data: ship } = await supabase
        .from('shipments')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle?.() ?? { data: null };
      const shipmentRow = (ship as any) || null;
      setShipment(shipmentRow);
      if (shipmentRow?.id) {
        const { data: events } = await supabase
          .from('shipment_events')
          .select('*')
          .eq('shipment_id', shipmentRow.id)
          .order('event_time', { ascending: true });
        setShipmentEvents(events || []);
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('Failed to load order detail', e);
    } finally {
      setDetailLoading(false);
    }
  };

  const createShipment = async () => {
    if (!openId || !orderDetail) return;
    setCreatingShipment(true);
    setCreateErr(null);
    try {
      const { data: newShip, error: serr } = await supabase
        .from('shipments')
        .insert({
          order_id: openId,
          courier_name: courierName || null,
          tracking_number: trackingNumber || null,
          awb_number: awbNumber || null,
          estimated_delivery_date: estimatedDate ? new Date(estimatedDate).toISOString() : null,
          shipment_value: shipmentValue ? Number(shipmentValue) : null,
          status: 'Preparing',
        })
        .select()
        .single();
      if (serr) throw serr;
      const shipmentId = newShip.id as string;
      // Event
      await supabase.from('shipment_events').insert({
        shipment_id: shipmentId,
        event_type: 'Created',
        details: notes || null,
      });
      // Update order fulfillment and link shipment
      await supabase
        .from('orders')
        .update({ fulfillment_status: 'Packing', shipment_id: shipmentId })
        .eq('id', openId);

      // Refresh detail
      await openDetails(openId);
      setCreateFormOpen(false);
      setCourierName('');
      setTrackingNumber('');
      setAwbNumber('');
      setEstimatedDate('');
      setShipmentValue('');
      setNotes('');
    } catch (e: any) {
      setCreateErr(e?.message || 'Failed to create shipment');
    } finally {
      setCreatingShipment(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setSection('all'); setStatusFilter('All'); }} className={`px-3 py-1 rounded-md border ${section==='all'?'bg-blue-600 text-white border-blue-600':'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>Orders</button>
            <button onClick={() => { setSection('backorders'); setStatusFilter('All'); }} className={`px-3 py-1 rounded-md border ${section==='backorders'?'bg-blue-600 text-white border-blue-600':'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>Back Orders</button>
            <button onClick={() => { setSection('failed'); setStatusFilter('All'); }} className={`px-3 py-1 rounded-md border ${section==='failed'?'bg-blue-600 text-white border-blue-600':'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>Failed Orders</button>
            <button onClick={() => { setSection('archived'); setStatusFilter('All'); }} className={`px-3 py-1 rounded-md border ${section==='archived'?'bg-blue-600 text-white border-blue-600':'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>Archived</button>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 dark:text-gray-400">Per Page</label>
            <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} className="px-2 py-1 rounded-md border bg-white dark:bg-gray-800">
              {[10,20,50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <input placeholder="Search (ID, Status)" value={query} onChange={(e)=> { setQuery(e.target.value); setPage(1); }} className="px-3 py-1 rounded-md border bg-white dark:bg-gray-800" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {orderStatuses.map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1 rounded-full text-sm border ${statusFilter===s?'bg-blue-600 text-white border-blue-600':'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Payment</span>
            <select value={payFilter} onChange={(e)=> { setPayFilter(e.target.value); setPage(1); }} className="px-2 py-1 rounded-md border bg-white dark:bg-gray-800">
              {paymentStatuses.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Fulfillment</span>
            <select value={fulfillmentFilter} onChange={(e)=> { setFulfillmentFilter(e.target.value); setPage(1); }} className="px-2 py-1 rounded-md border bg-white dark:bg-gray-800">
              {fulfillmentStatuses.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div>Loading…</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : (
          <>
            <div className="overflow-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="text-left px-3 py-2 cursor-pointer" onClick={() => setSort('created_at')}>Order ID</th>
                    <th className="text-left px-3 py-2 cursor-pointer" onClick={() => setSort('total')}>Total</th>
                    <th className="text-left px-3 py-2 cursor-pointer" onClick={() => setSort('status')}>Status</th>
                    <th className="text-left px-3 py-2 cursor-pointer" onClick={() => setSort('created_at')}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2 text-blue-600 underline cursor-pointer" onClick={() => openDetails(r.id)}>{r.id}</td>
                      <td className="px-3 py-2">₹{(r.total || 0).toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2">{r.status}</td>
                      <td className="px-3 py-2">{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && (
                    <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={4}>No orders</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Page {currentPage} of {totalPages} • {filtered.length} result(s)</div>
              <div className="flex gap-2">
                <button className="px-3 py-1 border rounded disabled:opacity-50" onClick={()=> setPage(1)} disabled={currentPage===1}>First</button>
                <button className="px-3 py-1 border rounded disabled:opacity-50" onClick={()=> setPage(p => Math.max(1, p-1))} disabled={currentPage===1}>Prev</button>
                <button className="px-3 py-1 border rounded disabled:opacity-50" onClick={()=> setPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages}>Next</button>
                <button className="px-3 py-1 border rounded disabled:opacity-50" onClick={()=> setPage(totalPages)} disabled={currentPage===totalPages}>Last</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Order Detail Modal */}
      {openId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpenId(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Order {openId}</h2>
              <button className="px-3 py-1 border rounded" onClick={() => setOpenId(null)}>Close</button>
            </div>
            {detailLoading ? (
              <div className="p-6">Loading…</div>
            ) : orderDetail ? (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="font-semibold mb-2">Customer</div>
                    <div className="text-sm">{customer?.full_name ?? '—'}</div>
                    <div className="text-sm">{customer?.phone ?? '—'}</div>
                    <div className="text-sm break-words">{customer?.address ?? '—'}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="font-semibold mb-2">Ship To</div>
                    {address ? (
                      <div className="text-sm space-y-1">
                        <div>{address.line1}</div>
                        {address.line2 && <div>{address.line2}</div>}
                        {address.landmark && <div>Landmark: {address.landmark}</div>}
                        <div>{address.city}, {address.state} {address.pin_code}</div>
                        <div>{address.country}</div>
                        {address.phone && <div>Phone: {address.phone}</div>}
                      </div>
                    ) : (
                      <div className="text-sm">—</div>
                    )}
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="font-semibold mb-2">Payment & Status</div>
                    <div className="text-sm">Total: ₹{(orderDetail.total || 0).toLocaleString('en-IN')}</div>
                    <div className="text-sm">Payment: {orderDetail.payment_status || 'Pending'}</div>
                    <div className="text-sm">Order Status: {orderDetail.status}</div>
                    <div className="text-sm">Fulfillment: {orderDetail.fulfillment_status || 'Unfulfilled'}</div>
                    <div className="text-sm">Placed: {orderDetail.created_at ? new Date(orderDetail.created_at).toLocaleString() : '-'}</div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="font-semibold mb-3">Items</div>
                  <div className="divide-y">
                    {orderItems.map((it) => (
                      <div key={it.id} className="flex items-center gap-4 py-3">
                        {it.image_url ? (
                          <img src={it.image_url} alt={it.name} className="w-14 h-14 object-cover rounded" />
                        ) : (
                          <div className="w-14 h-14 bg-gray-200 rounded" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium">{it.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Qty: {it.qty}</div>
                        </div>
                        <div className="text-sm">₹{(it.price || 0).toLocaleString('en-IN')}</div>
                      </div>
                    ))}
                    {orderItems.length === 0 && <div className="py-2 text-sm text-gray-500">No items</div>}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">Shipment</div>
                    {!shipment && (
                      <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={()=> setCreateFormOpen(true)}>Create Shipment</button>
                    )}
                  </div>
                  {shipment ? (
                    <div className="space-y-2 text-sm">
                      <div>Courier: {shipment.courier_name ?? '—'}</div>
                      <div>Tracking: {shipment.tracking_number ?? '—'}</div>
                      <div>AWB: {shipment.awb_number ?? '—'}</div>
                      <div>Status: {shipment.status}</div>
                      <div>ETA: {shipment.estimated_delivery_date ? new Date(shipment.estimated_delivery_date).toDateString() : '—'}</div>
                      <div className="mt-3">
                        <div className="font-medium mb-1">Events</div>
                        <div className="space-y-2">
                          {shipmentEvents.map(ev => (
                            <div key={ev.id} className="flex items-start gap-3">
                              <div className="w-2 h-2 rounded-full bg-blue-600 mt-2" />
                              <div>
                                <div className="text-sm font-medium">{ev.event_type}</div>
                                <div className="text-xs text-gray-600">{ev.event_time ? new Date(ev.event_time).toLocaleString() : ''}</div>
                                {ev.details && <div className="text-xs text-gray-700 dark:text-gray-300 mt-1">{ev.details}</div>}
                              </div>
                            </div>
                          ))}
                          {shipmentEvents.length === 0 && <div className="text-sm text-gray-500">No events</div>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">No shipment yet.</div>
                  )}
                </div>

                {createFormOpen && !shipment && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                    <div className="font-semibold">Create Shipment</div>
                    {createErr && <div className="text-sm text-red-600">{createErr}</div>}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm mb-1">Courier Name</label>
                        <input className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-900" value={courierName} onChange={(e)=> setCourierName(e.target.value)} placeholder="Delhivery, Bluedart…" />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Tracking Number</label>
                        <input className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-900" value={trackingNumber} onChange={(e)=> setTrackingNumber(e.target.value)} placeholder="Tracking / Reference" />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">AWB</label>
                        <input className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-900" value={awbNumber} onChange={(e)=> setAwbNumber(e.target.value)} placeholder="AWB (optional)" />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Estimated Delivery</label>
                        <input type="date" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-900" value={estimatedDate} onChange={(e)=> setEstimatedDate(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Shipment Value</label>
                        <input type="number" className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-900" value={shipmentValue} onChange={(e)=> setShipmentValue(e.target.value)} placeholder="Amount" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm mb-1">Notes</label>
                        <textarea className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-900" value={notes} onChange={(e)=> setNotes(e.target.value)} placeholder="Optional notes" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50" disabled={creatingShipment} onClick={createShipment}>Create & Notify</button>
                      <button className="px-3 py-2 rounded border" onClick={()=> setCreateFormOpen(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6">Failed to load order.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

