import { useEffect, useState } from 'react';
import {
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import type { OrderStatus } from '@/types/database';

interface DashboardStats {
  pendingReview: number;
  confirmed: number;
  paymentPending: number;
  paid: number;
  completed: number;
  totalProducts: number;
  lowStock: number;
  totalCustomers: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const [
        { count: pendingReview },
        { count: confirmed },
        { count: paymentPending },
        { count: paid },
        { count: completed },
        { count: totalProducts },
        { count: totalCustomers },
      ] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'PENDING_REVIEW'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'CONFIRMED'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'PAYMENT_PENDING'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'PAID'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'COMPLETED'),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('customer_profiles').select('*', { count: 'exact', head: true }),
      ]);

      const { data: lowStockItems } = await supabase
        .from('inventory')
        .select('product_id')
        .lte('available_stock', 0);

      setStats({
        pendingReview: pendingReview ?? 0,
        confirmed: confirmed ?? 0,
        paymentPending: paymentPending ?? 0,
        paid: paid ?? 0,
        completed: completed ?? 0,
        totalProducts: totalProducts ?? 0,
        lowStock: lowStockItems?.length ?? 0,
        totalCustomers: totalCustomers ?? 0,
      });
      setLoading(false);
    }

    load().catch((e) => {
      setError(e.message);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  const statCards = [
    {
      label: 'Pending Review',
      value: stats!.pendingReview,
      icon: Clock,
      color: 'bg-amber-50 text-amber-600',
      border: 'border-amber-200',
    },
    {
      label: 'Confirmed',
      value: stats!.confirmed,
      icon: CheckCircle,
      color: 'bg-blue-50 text-blue-600',
      border: 'border-blue-200',
    },
    {
      label: 'Payment Pending',
      value: stats!.paymentPending,
      icon: AlertTriangle,
      color: 'bg-orange-50 text-orange-600',
      border: 'border-orange-200',
    },
    {
      label: 'Paid',
      value: stats!.paid,
      icon: CheckCircle,
      color: 'bg-emerald-50 text-emerald-600',
      border: 'border-emerald-200',
    },
    {
      label: 'Completed',
      value: stats!.completed,
      icon: TrendingUp,
      color: 'bg-green-50 text-green-600',
      border: 'border-green-200',
    },
    {
      label: 'Total Products',
      value: stats!.totalProducts,
      icon: Package,
      color: 'bg-slate-50 text-slate-600',
      border: 'border-slate-200',
    },
    {
      label: 'Low / Out of Stock',
      value: stats!.lowStock,
      icon: Boxes,
      color: 'bg-red-50 text-red-600',
      border: 'border-red-200',
    },
    {
      label: 'Total Customers',
      value: stats!.totalCustomers,
      icon: Users,
      color: 'bg-cyan-50 text-cyan-600',
      border: 'border-cyan-200',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Overview of orders, products, and inventory.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label} className={card.border}>
            <CardBody>
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.color}`}
                >
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{card.label}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Quick actions placeholder */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent Orders"
            subtitle="Latest order requests"
          />
          <CardBody>
            <div className="flex items-center justify-center py-8 text-slate-400">
              <ShoppingCart className="h-8 w-8" />
              <span className="ml-2 text-sm">
                Recent orders list — available in Phase 2
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Inventory Alerts"
            subtitle="Products needing attention"
          />
          <CardBody>
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Boxes className="h-8 w-8" />
              <span className="ml-2 text-sm">
                Low stock alerts — available in Phase 2
              </span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
