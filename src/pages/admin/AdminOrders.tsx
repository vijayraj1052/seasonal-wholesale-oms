import { useEffect, useState } from 'react';
import { ShoppingCart, Search } from 'lucide-react';
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

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<ShoppingCart className="h-7 w-7" />}
        title="Couldn't load orders"
        description={error}
      />
    );
  }

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
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
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
                        className={ORDER_STATUS_COLORS[order.status as OrderStatus]}
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

      <p className="text-xs text-slate-400 text-center">
        Order detail views with quantity modification, confirmation, and status
        changes will be available in Phase 2.
      </p>
    </div>
  );
}
