import { useEffect, useState, useCallback } from 'react';
import { ShoppingBag, ChevronRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
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
        'id, order_id, product_id, unit_name, requested_quantity, confirmed_quantity, unit_price, product_subtotal, product_name_snapshot, brand_name_snapshot, variety_snapshot, created_at'
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
    const orderTotal = items.reduce(
      (sum, item) => sum + Number(item.product_subtotal),
      0
    );
    const isPaid = selectedOrder.status === 'PAID';

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
            className={`ml-auto ${ORDER_STATUS_COLORS[selectedOrder.status as OrderStatus]}`}
          >
            {ORDER_STATUS_LABELS[selectedOrder.status as OrderStatus]}
          </Badge>
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
                        Unit Price
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">
                        Line Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const displayQty =
                        item.confirmed_quantity ?? item.requested_quantity;
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
                            {formatINR(Number(item.unit_price))}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">
                            {displayQty}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">
                            {formatINR(Number(item.product_subtotal))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="flex items-center justify-end gap-2 text-base">
              <span className="text-slate-600 font-medium">Order Total:</span>
              <span className="font-bold text-slate-900">
                {formatINR(orderTotal)}
              </span>
            </div>

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
