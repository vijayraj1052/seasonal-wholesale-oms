import { useEffect, useState, useCallback } from 'react';
import { ShoppingBag, ChevronRight, ArrowLeft, CheckCircle2, Download } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatINR } from '@/lib/format';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  type Order,
  type OrderStatus,
  type OrderItem,
} from '@/types/database';

export function CustomerOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
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
    }
    load();
  }, []);

  const loadOrderDetail = useCallback(async (order: Order) => {
    setSelectedOrder(order);
    setDetailLoading(true);
    setDetailError(null);
    setItems([]);

    const { data, error: itemsError } = await supabase
      .from('order_items')
      .select(
        'id, order_id, product_id, unit_name, requested_quantity, confirmed_quantity, unit_price, product_subtotal, product_name_snapshot, brand_name_snapshot, variety_snapshot, base_price, product_discount_percent, created_at'
      )
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    if (itemsError) {
      setDetailError(itemsError.message);
      setDetailLoading(false);
      return;
    }

    setItems((data ?? []) as OrderItem[]);
    setDetailLoading(false);
  }, []);

  const closeDetail = () => {
    setSelectedOrder(null);
    setItems([]);
    setDetailError(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Spinner size="lg" />
        <p className="mt-3 text-sm text-slate-500">Loading your orders…</p>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<ShoppingBag className="h-7 w-7" />}
        title="Couldn't load your orders"
        description={error}
      />
    );
  }

  // ===== Order Detail View =====
  if (selectedOrder) {
    const itemBasePrice = (item: OrderItem) =>
      item.base_price != null ? Number(item.base_price) : Number(item.unit_price);
    const itemDiscPct = (item: OrderItem) =>
      item.product_discount_percent != null
        ? Number(item.product_discount_percent)
        : 0;
    const itemEffPrice = (item: OrderItem) => Number(item.unit_price);
    const itemDisplayQty = (item: OrderItem) =>
      item.confirmed_quantity ?? item.requested_quantity;
    const itemGrossTotal = (item: OrderItem) =>
      itemBasePrice(item) * itemDisplayQty(item);
    const itemDiscAmount = (item: OrderItem) =>
      itemGrossTotal(item) - itemEffPrice(item) * itemDisplayQty(item);
    const itemNetTotal = (item: OrderItem) =>
      itemEffPrice(item) * itemDisplayQty(item);

    const grossTotal = items.reduce((s, i) => s + itemGrossTotal(i), 0);
    const totalProductDisc = items.reduce(
      (s, i) => s + itemDiscAmount(i),
      0
    );
    const subtotalAfterProductDisc = items.reduce(
      (s, i) => s + itemNetTotal(i),
      0
    );
    const orderDiscPct = selectedOrder.discount_percent ?? 0;
    const orderDiscAmount =
      subtotalAfterProductDisc * (orderDiscPct / 100);
    const netPayable = subtotalAfterProductDisc - orderDiscAmount;
    const isPaid = selectedOrder.status === 'PAID';

    const escapeHtml = (value: unknown) =>
      String(value ?? '—').replace(/[&<>"']/g, (character) => {
        const entities: Record<string, string> = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        };
        return entities[character];
      });

    const downloadBillPdf = () => {
      const printWindow = window.open('', '_blank', 'width=1000,height=750');
      if (!printWindow) {
        window.alert('Please allow pop-ups for this site to download the bill as PDF.');
        return;
      }

      const itemRows = items.map((item) => {
        const quantity = itemDisplayQty(item);
        return `
          <tr>
            <td>${escapeHtml(item.product_name_snapshot)}${item.variety_snapshot ? `<br><small>${escapeHtml(item.variety_snapshot)}</small>` : ''}</td>
            <td>${escapeHtml(item.brand_name_snapshot || '—')}</td>
            <td>${escapeHtml(item.unit_name)}</td>
            <td class="number">${escapeHtml(formatINR(itemBasePrice(item)))}</td>
            <td class="number">${itemDiscPct(item)}%</td>
            <td class="number">${escapeHtml(formatINR(itemEffPrice(item)))}</td>
            <td class="number">${quantity}</td>
            <td class="number">${escapeHtml(formatINR(itemNetTotal(item)))}</td>
          </tr>`;
      }).join('');

      const orderDate = new Date(selectedOrder.created_at).toLocaleString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      const paymentDueDate = selectedOrder.payment_due_date
        ? new Date(selectedOrder.payment_due_date).toLocaleDateString('en-IN', {
            year: 'numeric', month: 'short', day: 'numeric',
          })
        : '';
      const paymentDate = selectedOrder.payment_marked_at
        ? new Date(selectedOrder.payment_marked_at).toLocaleDateString('en-IN', {
            year: 'numeric', month: 'short', day: 'numeric',
          })
        : '';

      printWindow.document.write(`<!doctype html>
        <html lang="en"><head><meta charset="utf-8"><title>Bill ${escapeHtml(selectedOrder.order_number)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; color: #172033; margin: 28px; font-size: 12px; }
          h1 { margin: 0 0 5px; font-size: 23px; }
          h2 { margin: 22px 0 9px; font-size: 14px; }
          .muted { color: #64748b; }
          .top { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2px solid #1e40af; padding-bottom: 14px; }
          .status { text-align: right; }
          .details { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 22px; margin-top: 16px; }
          .details strong { display: inline-block; min-width: 85px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { padding: 8px 6px; border-bottom: 1px solid #dbe2ea; text-align: left; vertical-align: top; }
          th { background: #f1f5f9; font-size: 10px; }
          .number { text-align: right; white-space: nowrap; }
          small { color: #64748b; }
          .totals { width: 330px; max-width: 100%; margin: 18px 0 0 auto; }
          .total-row { display: flex; justify-content: space-between; gap: 18px; padding: 6px 0; }
          .final { border-top: 2px solid #172033; margin-top: 5px; padding-top: 10px; font-size: 16px; font-weight: bold; }
          .footer { margin-top: 30px; border-top: 1px solid #dbe2ea; padding-top: 10px; color: #64748b; font-size: 10px; }
          @media print { body { margin: 12mm; } button { display: none; } }
        </style></head><body>
          <div class="top"><div><h1>FINAL BILL</h1><div class="muted">Order: ${escapeHtml(selectedOrder.order_number)}</div><div class="muted">Date: ${escapeHtml(orderDate)}</div></div>
          <div class="status"><strong>${escapeHtml(ORDER_STATUS_LABELS[selectedOrder.status as OrderStatus])}</strong>${isPaid && paymentDate ? `<div class="muted">Paid on ${escapeHtml(paymentDate)}</div>` : ''}</div></div>
          <h2>Customer Details</h2>
          <div class="details">
            <div><strong>Name:</strong> ${escapeHtml(selectedOrder.customer_name)}</div>
            <div><strong>Phone:</strong> ${escapeHtml(selectedOrder.customer_mobile)}</div>
            <div><strong>Shop:</strong> ${escapeHtml(selectedOrder.customer_shop)}</div>
            <div><strong>Stall:</strong> ${escapeHtml(selectedOrder.customer_stall_number)}</div>
            <div><strong>Location:</strong> ${escapeHtml(selectedOrder.customer_stall_location)}</div>
            ${selectedOrder.customer_licence ? `<div><strong>Licence:</strong> ${escapeHtml(selectedOrder.customer_licence)}</div>` : ''}
          </div>
          <h2>Items</h2>
          <table><thead><tr><th>Product</th><th>Brand</th><th>Unit</th><th class="number">MRP / Base</th><th class="number">Disc %</th><th class="number">Unit Price</th><th class="number">Qty</th><th class="number">Net Total</th></tr></thead><tbody>${itemRows}</tbody></table>
          <div class="totals">
            <div class="total-row"><span>Gross Total</span><strong>${escapeHtml(formatINR(grossTotal))}</strong></div>
            <div class="total-row"><span>Product-Level Discount</span><strong>−${escapeHtml(formatINR(totalProductDisc))}</strong></div>
            <div class="total-row"><span>Subtotal after product discounts</span><strong>${escapeHtml(formatINR(subtotalAfterProductDisc))}</strong></div>
            ${orderDiscPct > 0 ? `<div class="total-row"><span>Order Discount (${orderDiscPct}%)</span><strong>−${escapeHtml(formatINR(orderDiscAmount))}</strong></div>` : ''}
            <div class="total-row final"><span>NET PAYABLE</span><span>${escapeHtml(formatINR(netPayable))}</span></div>
            ${paymentDueDate && !isPaid ? `<div class="total-row"><span>Payment due by</span><strong>${escapeHtml(paymentDueDate)}</strong></div>` : ''}
          </div>
          <div class="footer">Generated from Wholesale OMS. Please retain this bill for your records.</div>
          <script>window.onload = () => { window.focus(); window.print(); };</script>
        </body></html>`);
      printWindow.document.close();
    };

    return (
      <div className="space-y-6">
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
            className={`${ORDER_STATUS_COLORS[selectedOrder.status as OrderStatus]}`}
          >
            {ORDER_STATUS_LABELS[selectedOrder.status as OrderStatus]}
          </Badge>
          <button
            type="button"
            onClick={downloadBillPdf}
            disabled={detailLoading || !!detailError || items.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        </div>

        {/* Payment status */}
        {isPaid && selectedOrder.payment_marked_at && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Payment received on{' '}
            {new Date(selectedOrder.payment_marked_at).toLocaleDateString(
              undefined,
              { year: 'numeric', month: 'short', day: 'numeric' }
            )}
          </div>
        )}

        {/* Customer info */}
        <Card>
          <CardBody className="space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Billing Details
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

        {detailLoading && (
          <div className="flex items-center justify-center py-10">
            <Spinner size="lg" />
          </div>
        )}

        {detailError && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {detailError}
          </div>
        )}

        {/* Order items bill */}
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
                      <th className="px-4 py-3 text-left font-semibold text-slate-700 hidden sm:table-cell">
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
                        Qty
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">
                        Net Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const bPrice = itemBasePrice(item);
      const discPct = itemDiscPct(item);
      const discAmt = itemDiscAmount(item);
      const effPrice = itemEffPrice(item);
      const displayQty = itemDisplayQty(item);
      const netTotal = itemNetTotal(item);
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
                          </td>
                          <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">
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
                            {formatINR(effPrice)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">
                            {displayQty}
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
                {orderDiscPct > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">
                      Order Discount ({orderDiscPct}%)
                    </span>
                    <span className="font-medium text-slate-600">−{formatINR(orderDiscAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-base border-t border-slate-200 pt-2">
                  <span className="font-bold text-slate-900">Net Payable</span>
                  <span className="font-bold text-blue-700">{formatINR(netPayable)}</span>
                </div>
              </CardBody>
            </Card>

            {selectedOrder.payment_due_date && !isPaid && (
              <p className="text-sm text-amber-600 text-right">
                Payment due by{' '}
                {new Date(selectedOrder.payment_due_date).toLocaleDateString(
                  undefined,
                  { year: 'numeric', month: 'short', day: 'numeric' }
                )}
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  // ===== Order List View =====
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">My Orders</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          View your order requests, confirmed quantities, and status.
        </p>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-7 w-7" />}
          title="No orders yet"
          description="When you submit an order request, it will appear here with its current status."
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isPaid = order.status === 'PAID';
            return (
              <div
                key={order.id}
                onClick={() => loadOrderDetail(order)}
                className="cursor-pointer"
              >
                <Card className="hover:shadow-md transition-shadow">
                <CardBody className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">
                        {order.order_number}
                      </span>
                      <Badge
                        className={
                          ORDER_STATUS_COLORS[order.status as OrderStatus]
                        }
                      >
                        {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                      </Badge>
                      {isPaid && (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100">
                          Paid
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(order.created_at).toLocaleDateString(
                        undefined,
                        {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        }
                      )}
                      {order.payment_due_date && !isPaid && (
                        <>
                          {' · '}
                          Due{' '}
                          {new Date(
                            order.payment_due_date
                          ).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
                </CardBody>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
