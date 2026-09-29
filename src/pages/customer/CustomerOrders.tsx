import { useEffect, useState } from 'react';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  type Order,
  type OrderStatus,
} from '@/types/database';

export function CustomerOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          {orders.map((order) => (
            <Card key={order.id}>
              <CardBody className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">
                      {order.order_number}
                    </span>
                    <Badge
                      className={ORDER_STATUS_COLORS[order.status as OrderStatus]}
                    >
                      {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(order.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                    {order.payment_due_date && (
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
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center pt-2">
        Detailed order views with item breakdowns will be available in the next
        phase.
      </p>
    </div>
  );
}
