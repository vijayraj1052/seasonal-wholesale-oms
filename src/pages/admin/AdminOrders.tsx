import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ShoppingCart,
  Search,
  ArrowLeft,
  Save,
  AlertCircle,
  CheckCircle2,
  X,
  Lock,
  IndianRupee,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatINR } from '@/lib/format';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  type Order,
  type OrderStatus,
} from '@/types/database';

interface OrderItemDetail {
  id: string;
  product_id: string;
  unit_name: string;
  requested_quantity: number;
  confirmed_quantity: number | null;
  unit_price: number;
  product_subtotal: number;
  product_name_snapshot: string;
  brand_name_snapshot: string;
  variety_snapshot: string | null;
  product_code: string | null;
  base_price: number | null;
  product_discount_percent: number | null;
}

interface ConfirmedQtyState {
  [itemId: string]: string;
}

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Detail view state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItemDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Review state
  const [confirmedQtys, setConfirmedQtys] = useState<ConfirmedQtyState>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Confirm state
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState(false);

  // Mark as Paid state
  const [markingPaid, setMarkingPaid] = useState(false);
  const [paidError, setPaidError] = useState<string | null>(null);
  const [paidSuccess, setPaidSuccess] = useState(false);

  // Order-level discount state
  const [orderDiscountStr, setOrderDiscountStr] = useState('0');
  const [orderDiscountSaved, setOrderDiscountSaved] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setOrders((data ?? []) as Order[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const loadOrderDetail = useCallback(async (order: Order) => {
    setSelectedOrder(order);
    setDetailLoading(true);
    setDetailError(null);
    setSaveError(null);
    setSaveSuccess(false);
    setConfirmError(null);
    setConfirmSuccess(false);
    setPaidError(null);
    setPaidSuccess(false);
    setItems([]);
    setConfirmedQtys({});
    setOrderDiscountStr(
      order.discount_percent != null ? order.discount_percent.toString() : '0'
    );
    setOrderDiscountSaved(false);

    const { data, error: itemsError } = await supabase
      .from('order_items')
      .select(
        `
        id, product_id, unit_name, requested_quantity, confirmed_quantity,
        unit_price, product_subtotal, product_name_snapshot,
        brand_name_snapshot, variety_snapshot,
        base_price, product_discount_percent,
        product:products(product_code)
      `
      )
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    if (itemsError) {
      setDetailError(itemsError.message);
      setDetailLoading(false);
      return;
    }

    const mapped: OrderItemDetail[] = (data ?? []).map((row) => {
      const r = row as {
        id: string;
        product_id: string;
        unit_name: string;
        requested_quantity: number;
        confirmed_quantity: number | null;
        unit_price: number;
        product_subtotal: number;
        product_name_snapshot: string;
        brand_name_snapshot: string;
        variety_snapshot: string | null;
        base_price: number | null;
        product_discount_percent: number | null;
        product: { product_code: string | null }[] | null;
      };
      const productCode = Array.isArray(r.product) && r.product.length > 0
        ? r.product[0].product_code
        : null;
      return {
        id: r.id,
        product_id: r.product_id,
        unit_name: r.unit_name,
        requested_quantity: r.requested_quantity,
        confirmed_quantity: r.confirmed_quantity,
        unit_price: Number(r.unit_price),
        product_subtotal: Number(r.product_subtotal),
        product_name_snapshot: r.product_name_snapshot,
        brand_name_snapshot: r.brand_name_snapshot,
        variety_snapshot: r.variety_snapshot,
        product_code: productCode,
        base_price: r.base_price != null ? Number(r.base_price) : null,
        product_discount_percent:
          r.product_discount_percent != null ? Number(r.product_discount_percent) : null,
      };
    });

    setItems(mapped);

    // Default confirmed qty to requested qty (or existing confirmed qty if already set)
    const qtyMap: ConfirmedQtyState = {};
    mapped.forEach((item) => {
      qtyMap[item.id] = (
        item.confirmed_quantity ?? item.requested_quantity
      ).toString();
    });
    setConfirmedQtys(qtyMap);
    setDetailLoading(false);
  }, []);

  const closeDetail = () => {
    setSelectedOrder(null);
    setItems([]);
    setConfirmedQtys({});
    setSaveError(null);
    setSaveSuccess(false);
    setConfirmError(null);
    setConfirmSuccess(false);
    setPaidError(null);
    setPaidSuccess(false);
    setOrderDiscountStr('0');
    setOrderDiscountSaved(false);
  };

  const isPendingReview = selectedOrder?.status === 'PENDING_REVIEW';

  const canMarkPaid =
    selectedOrder?.status === 'CONFIRMED' ||
    selectedOrder?.status === 'PAYMENT_PENDING';

  const handleMarkPaid = async () => {
    if (!selectedOrder) return;
    setPaidError(null);
    setPaidSuccess(false);
    setMarkingPaid(true);

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'PAID',
        payment_marked_at: new Date().toISOString(),
      })
      .eq('id', selectedOrder.id);

    if (updateError) {
      setPaidError(updateError.message);
      setMarkingPaid(false);
      return;
    }

    await loadOrders();
    const updated = ordersRef.current.find(
      (o) => o.id === selectedOrder.id
    );
    if (updated) {
      setSelectedOrder({ ...updated, status: 'PAID', payment_marked_at: new Date().toISOString() });
    } else {
      setSelectedOrder({ ...selectedOrder, status: 'PAID', payment_marked_at: new Date().toISOString() });
    }

    setPaidSuccess(true);
    setMarkingPaid(false);
  };

  // ===== Billing calculations =====
  const getDisplayQty = (item: OrderItemDetail) => {
    const qtyStr = confirmedQtys[item.id];
    return qtyStr !== undefined ? parseInt(qtyStr, 10) : item.requested_quantity;
  };

  const lineBasePrice = (item: OrderItemDetail) =>
    item.base_price ?? item.unit_price;
  const lineDiscPercent = (item: OrderItemDetail) =>
    item.product_discount_percent ?? 0;
  const lineEffPrice = (item: OrderItemDetail) => item.unit_price;
  const lineGrossTotal = (item: OrderItemDetail) =>
    lineBasePrice(item) * getDisplayQty(item);
  const lineDiscAmount = (item: OrderItemDetail) =>
    lineGrossTotal(item) - lineEffPrice(item) * getDisplayQty(item);
  const lineNetTotal = (item: OrderItemDetail) =>
    lineEffPrice(item) * getDisplayQty(item);

  const grossTotal = items.reduce((s, i) => s + lineGrossTotal(i), 0);
  const totalProductDisc = items.reduce((s, i) => s + lineDiscAmount(i), 0);
  const subtotalAfterProductDisc = items.reduce(
    (s, i) => s + lineNetTotal(i),
    0
  );

  const orderDiscountPercent = (() => {
    const v = parseFloat(orderDiscountStr);
    return isNaN(v) ? 0 : Math.max(0, Math.min(100, v));
  })();
  const orderDiscountAmount =
    subtotalAfterProductDisc * (orderDiscountPercent / 100);
  const netPayable = subtotalAfterProductDisc - orderDiscountAmount;

  // Legacy totals (kept for backward compat in any logic that references them)
  const requestedTotal = items.reduce(
    (sum, item) => sum + item.unit_price * item.requested_quantity,
    0
  );
  const reviewedTotal = subtotalAfterProductDisc;

  const handleOrderDiscountChange = (value: string) => {
    setOrderDiscountStr(value);
    setOrderDiscountSaved(false);
    setSaveSuccess(false);
  };

  const handleQtyChange = (itemId: string, value: string) => {
    setConfirmedQtys((prev) => ({ ...prev, [itemId]: value }));
    setSaveSuccess(false);
  };

  const hasQtyChanges = () => {
    return items.some((item) => {
      const current = confirmedQtys[item.id];
      if (current === undefined) return false;
      const original = (item.confirmed_quantity ?? item.requested_quantity).toString();
      return current !== original;
    });
  };

  const hasDiscountChange = () => {
    const saved = selectedOrder?.discount_percent ?? 0;
    const current = parseFloat(orderDiscountStr);
    return isNaN(current) ? saved !== 0 : current !== saved;
  };

  const hasUnsavedChanges = () =>
    hasQtyChanges() || (isPendingReview && hasDiscountChange());

  const handleConfirmOrder = async () => {
    if (!selectedOrder) return;
    setConfirmError(null);
    setConfirmSuccess(false);
    setConfirming(true);

    const { data, error: rpcError } = await supabase.rpc('confirm_order', {
      p_order_id: selectedOrder.id,
    });

    if (rpcError) {
      setConfirmError(rpcError.message);
      setConfirming(false);
      return;
    }

    if (!data || !data.order_number) {
      setConfirmError('Confirmation failed. Please try again.');
      setConfirming(false);
      return;
    }

    // Refresh the order list and reload the detail with updated status
    await loadOrders();

    // Find the updated order from the refreshed list
    const updated = ordersRef.current.find(
      (o) => o.id === selectedOrder.id
    );
    if (updated) {
      await loadOrderDetail({ ...updated, status: 'CONFIRMED', confirmed_at: new Date().toISOString() });
    } else {
      await loadOrderDetail({ ...selectedOrder, status: 'CONFIRMED', confirmed_at: new Date().toISOString() });
    }

    setConfirmSuccess(true);
    setConfirming(false);
  };

  const handleSaveReview = async () => {
    if (!selectedOrder) return;
    setSaveError(null);
    setSaveSuccess(false);

    // Validate all quantities
    for (const item of items) {
      const qtyStr = confirmedQtys[item.id];
      if (qtyStr === undefined || qtyStr.trim() === '') {
        setSaveError('All items must have a confirmed quantity. Enter 0 to remove an item from confirmation.');
        return;
      }
      const qty = parseInt(qtyStr, 10);
      if (isNaN(qty) || qty < 0) {
        setSaveError('Confirmed quantities must be non-negative whole numbers.');
        return;
      }
    }

    setSaving(true);

    // Update each item's confirmed_quantity and product_subtotal
    // We do NOT change order status or inventory
    const updates = items.map((item) => {
      const qty = parseInt(confirmedQtys[item.id], 10);
      const subtotal = Number((item.unit_price * qty).toFixed(2));
      return supabase
        .from('order_items')
        .update({
          confirmed_quantity: qty,
          product_subtotal: subtotal,
        })
        .eq('id', item.id);
    });

    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);

    if (failed && failed.error) {
      setSaveError(failed.error.message);
      setSaving(false);
      return;
    }

    // Save order-level discount
    const discVal = parseFloat(orderDiscountStr);
    const discToSave = isNaN(discVal) ? 0 : Math.max(0, Math.min(100, discVal));
    const { error: orderDiscError } = await supabase
      .from('orders')
      .update({ discount_percent: discToSave })
      .eq('id', selectedOrder.id);

    if (orderDiscError) {
      setSaveError(orderDiscError.message);
      setSaving(false);
      return;
    }

    // Refresh items to reflect saved state
    await loadOrderDetail({
      ...selectedOrder,
      discount_percent: discToSave,
    });
    setOrderDiscountSaved(true);
    setSaveSuccess(true);
    setConfirmError(null);
    setConfirmSuccess(false);
    setSaving(false);
  };

  // Keep a ref to the latest orders for use in async callbacks
  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  const filtered = orders.filter((order) => {
    const matchesStatus =
      statusFilter === 'all' || order.status === statusFilter;
    const matchesSearch =
      !search ||
      order.order_number.toLowerCase().includes(search.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      order.customer_shop.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const statusOptions: (OrderStatus | 'all')[] = [
    'all',
    'PENDING_REVIEW',
    'CONFIRMED',
    'PAYMENT_PENDING',
    'PAID',
    'READY_FOR_RELEASE',
    'COMPLETED',
    'CANCELLED',
  ];

  // ===== Loading =====
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  // ===== Error (list) =====
  if (error && orders.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart className="h-7 w-7" />}
        title="Couldn't load orders"
        description={error}
      />
    );
  }

  // ===== Order Detail View =====
  if (selectedOrder) {
    return (
      <div className="space-y-6">
        {/* Back button + title */}
        <div className="flex items-center gap-3">
          <button
            onClick={closeDetail}
            className="p-2 -ml-2 text-slate-400 hover:text-slate-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {selectedOrder.order_number}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {new Date(selectedOrder.created_at).toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          <Badge
            className={`ml-auto ${ORDER_STATUS_COLORS[selectedOrder.status as OrderStatus]}`}
          >
            {ORDER_STATUS_LABELS[selectedOrder.status as OrderStatus]}
          </Badge>
        </div>

        {/* Customer info */}
        <Card>
          <CardBody className="space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Customer
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-slate-400">Name:</span>{' '}
                <span className="font-medium text-slate-900">
                  {selectedOrder.customer_name}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Phone:</span>{' '}
                <span className="font-medium text-slate-900">
                  {selectedOrder.customer_mobile}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Shop:</span>{' '}
                <span className="font-medium text-slate-900">
                  {selectedOrder.customer_shop}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Stall:</span>{' '}
                <span className="font-medium text-slate-900">
                  {selectedOrder.customer_stall_number}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Location:</span>{' '}
                <span className="font-medium text-slate-900">
                  {selectedOrder.customer_stall_location}
                </span>
              </div>
              {selectedOrder.customer_licence && (
                <div>
                  <span className="text-slate-400">Licence:</span>{' '}
                  <span className="font-medium text-slate-900">
                    {selectedOrder.customer_licence}
                  </span>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Detail loading */}
        {detailLoading && (
          <div className="flex items-center justify-center py-10">
            <Spinner size="lg" />
          </div>
        )}

        {/* Detail error */}
        {detailError && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {detailError}
          </div>
        )}

        {/* Order items */}
        {!detailLoading && !detailError && (
          <>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Product
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700 hidden md:table-cell">
                        Brand
                      </th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-700">
                        Unit
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">
                        MRP / Base
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700 hidden lg:table-cell">
                        Disc %
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">
                        Unit Price
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">
                        Req Qty
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">
                        Conf Qty
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">
                        Net Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const qtyStr = confirmedQtys[item.id];
                      const confirmedQty =
                        qtyStr !== undefined
                          ? parseInt(qtyStr, 10)
                          : item.requested_quantity;
                      const bPrice = lineBasePrice(item);
                      const discPct = lineDiscPercent(item);
                      const discAmt = lineDiscAmount(item);
                      const netTotal = lineNetTotal(item);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-900">
                              {item.product_name_snapshot}
                            </span>
                            {item.variety_snapshot && (
                              <span className="block text-xs text-slate-500">
                                {item.variety_snapshot}
                              </span>
                            )}
                            {item.product_code && (
                              <span className="block text-xs text-slate-400">
                                #{item.product_code}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                            {item.brand_name_snapshot || '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600">
                            {item.unit_name}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {formatINR(bPrice)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500 hidden lg:table-cell">
                            {discPct > 0 ? `${discPct}%` : '—'}
                            {discAmt > 0 && (
                              <span className="block text-xs text-slate-400">
                                −{formatINR(discAmt)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {formatINR(lineEffPrice(item))}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">
                            {item.requested_quantity}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isPendingReview ? (
                              <input
                                type="number"
                                min="0"
                                value={qtyStr ?? ''}
                                onChange={(e) =>
                                  handleQtyChange(item.id, e.target.value)
                                }
                                className="w-20 rounded border border-slate-300 px-2 py-1 text-sm text-right text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            ) : (
                              <span className="font-medium text-slate-900">
                                {item.confirmed_quantity ?? '—'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">
                            {formatINR(netTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Bill breakdown */}
            <Card>
              <CardBody className="space-y-2">
                {/* Order-level discount input (editable during review) */}
                {isPendingReview ? (
                  <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-100">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Order-Level Discount %
                      </label>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Applied after product-level discounts.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={orderDiscountStr}
                        onChange={(e) =>
                          handleOrderDiscountChange(e.target.value)
                        }
                        className="w-24 rounded border border-slate-300 px-2 py-1.5 text-sm text-right text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-500">%</span>
                    </div>
                  </div>
                ) : null}

                {/* Line items */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Gross Total (before product discounts)</span>
                  <span className="font-medium text-slate-700">{formatINR(grossTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Total Product-Level Discount</span>
                  <span className="font-medium text-slate-600">−{formatINR(totalProductDisc)}</span>
                </div>
                <div className="flex items-center justify-between text-sm border-t border-slate-100 pt-2">
                  <span className="text-slate-600 font-medium">Subtotal (after product discounts)</span>
                  <span className="font-semibold text-slate-800">{formatINR(subtotalAfterProductDisc)}</span>
                </div>

                {/* Order-level discount */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    Order Discount ({orderDiscountPercent}%)
                  </span>
                  <span className="font-medium text-slate-600">−{formatINR(orderDiscountAmount)}</span>
                </div>

                {/* Net payable */}
                <div className="flex items-center justify-between text-base border-t border-slate-200 pt-2">
                  <span className="font-bold text-slate-900">Net Payable</span>
                  <span className="font-bold text-blue-700">{formatINR(netPayable)}</span>
                </div>

                {/* Saved order discount indicator (non-review) */}
                {!isPendingReview && orderDiscountPercent > 0 && (
                  <p className="text-xs text-slate-400 pt-1">
                    Order-level discount of {orderDiscountPercent}% was applied
                    during review.
                  </p>
                )}
              </CardBody>
            </Card>

            {/* Review save bar (only for PENDING_REVIEW) */}
            {isPendingReview && (
              <Card>
                <CardBody className="space-y-4">
                  <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Reviewing order request</p>
                      <p className="text-xs mt-0.5">
                        Adjust confirmed quantities as needed. The unit price
                        shown is the price captured at submission (after any
                        applicable discount). Saving only records confirmed
                        quantities — it does not change the order status or
                        affect inventory.
                      </p>
                    </div>
                  </div>

                  {saveError && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {saveError}
                    </div>
                  )}

                  {saveSuccess && !confirmSuccess && (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Confirmed quantities have been saved. The order remains
                      Pending Review.
                    </div>
                  )}

                  {/* Confirm order section */}
                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                      <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Confirm Order &amp; Allocate Stock</p>
                        <p className="text-xs mt-0.5">
                          Confirming transitions this order to{" "}
                          <span className="font-semibold">Confirmed</span> and
                          permanently allocates inventory using the saved
                          confirmed quantities. This action cannot be undone
                          from this screen. Ensure all quantities are correct
                          before confirming.
                        </p>
                      </div>
                    </div>

                    {confirmError && (
                      <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{confirmError}</span>
                      </div>
                    )}

                    {confirmSuccess && (
                      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        Order has been confirmed. Stock has been allocated and
                        the order is now Confirmed.
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <Button
                        variant="secondary"
                        onClick={handleConfirmOrder}
                        loading={confirming}
                        disabled={hasUnsavedChanges() || confirming || confirmSuccess}
                      >
                        <Lock className="h-4 w-4" />
                        Confirm Order
                      </Button>
                      {hasUnsavedChanges() && (
                        <span className="text-xs text-amber-600">
                          Save your changes before confirming.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
                    <Button
                      onClick={handleSaveReview}
                      loading={saving}
                      disabled={!hasUnsavedChanges() && !saveSuccess}
                    >
                      <Save className="h-4 w-4" />
                      Save Reviewed Quantities
                    </Button>
                    <Button variant="outline" onClick={closeDetail}>
                      <X className="h-4 w-4" />
                      Close
                    </Button>
                    {hasUnsavedChanges() && !saveSuccess && (
                      <span className="text-xs text-amber-600 ml-auto">
                        Unsaved changes
                      </span>
                    )}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Mark as Paid section */}
            {canMarkPaid && (
              <Card>
                <CardBody className="space-y-3">
                  <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
                    <IndianRupee className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Mark as Paid</p>
                      <p className="text-xs mt-0.5">
                        Record that physical payment has been received for this
                        order. This updates the payment status only — it does
                        not allocate or deduct inventory.
                      </p>
                    </div>
                  </div>

                  {paidError && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {paidError}
                    </div>
                  )}

                  {paidSuccess && (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Order marked as Paid. Payment status updated.
                    </div>
                  )}

                  <Button
                    variant="primary"
                    onClick={handleMarkPaid}
                    loading={markingPaid}
                    disabled={markingPaid || paidSuccess}
                  >
                    <IndianRupee className="h-4 w-4" />
                    Mark as Paid
                  </Button>
                </CardBody>
              </Card>
            )}

            {/* Payment confirmed indicator */}
            {selectedOrder.status === 'PAID' && selectedOrder.payment_marked_at && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Payment received on{' '}
                {new Date(selectedOrder.payment_marked_at).toLocaleDateString(
                  undefined,
                  { year: 'numeric', month: 'short', day: 'numeric' }
                )}
              </div>
            )}

            {/* Non-pending info note */}
            {!isPendingReview && selectedOrder.status !== 'PAID' && (
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-500">
                <AlertCircle className="h-4 w-4 shrink-0" />
                This order is no longer in review. Confirmed quantities are
                shown for reference and cannot be edited here.
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ===== Order List View =====
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
        <p className="text-sm text-slate-500 mt-1">
          Review order requests, confirm quantities, and manage status.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by order number, customer, or shop…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All Statuses' : ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="h-7 w-7" />}
          title="No orders found"
          description={
            orders.length === 0
              ? 'Order requests from customers will appear here.'
              : 'No orders match your filters.'
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Order #
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 hidden md:table-cell">
                    Shop
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 hidden lg:table-cell">
                    Date
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => loadOrderDetail(order)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-blue-700">
                      {order.order_number}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {order.customer_name}
                      <p className="text-xs text-slate-400">
                        {order.customer_mobile}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                      {order.customer_shop}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        className={
                          ORDER_STATUS_COLORS[order.status as OrderStatus]
                        }
                      >
                        {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
