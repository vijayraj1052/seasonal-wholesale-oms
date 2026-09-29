import { Link } from 'react-router-dom';
import { Package, ShoppingBag, Bell, ArrowRight, Boxes } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardBody } from '@/components/ui/Card';

export function CustomerHome() {
  const { profile } = useAuth();

  const quickLinks = [
    {
      to: '/app/catalogue',
      label: 'Browse Catalogue',
      desc: 'View available products and pricing',
      icon: Package,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      to: '/app/orders',
      label: 'My Orders',
      desc: 'Track your order requests and status',
      icon: ShoppingBag,
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      to: '/app/notifications',
      label: 'Notifications',
      desc: 'View your updates and alerts',
      icon: Bell,
      color: 'bg-amber-50 text-amber-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 md:p-8 text-white shadow-md">
        <div className="flex items-center gap-3 mb-3">
          <Boxes className="h-8 w-8" />
          <h1 className="text-2xl font-bold">
            Welcome, {profile?.full_name?.split(' ')[0] ?? 'there'}
          </h1>
        </div>
        <p className="text-blue-100 text-sm md:text-base max-w-lg">
          Browse the wholesale catalogue, submit order requests, and track
          your orders from confirmation to collection.
        </p>
      </div>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((link) => (
          <Link key={link.to} to={link.to}>
            <Card className="hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group h-full">
              <CardBody className="flex flex-col h-full">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl mb-3 ${link.color}`}
                >
                  <link.icon className="h-5.5 w-5.5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  {link.label}
                </h3>
                <p className="text-sm text-slate-500 mt-1 flex-1">
                  {link.desc}
                </p>
                <div className="flex items-center gap-1 text-sm font-medium text-blue-600 mt-3 group-hover:gap-2 transition-all">
                  Open
                  <ArrowRight className="h-4 w-4" />
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      {/* Stall info */}
      <Card>
        <CardBody>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Your Stall Information
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-slate-500 text-xs uppercase tracking-wide">
                Shop
              </dt>
              <dd className="text-slate-900 font-medium mt-0.5">
                {profile?.shop_name || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs uppercase tracking-wide">
                Stall No.
              </dt>
              <dd className="text-slate-900 font-medium mt-0.5">
                {profile?.stall_number || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs uppercase tracking-wide">
                Location
              </dt>
              <dd className="text-slate-900 font-medium mt-0.5">
                {profile?.stall_location || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs uppercase tracking-wide">
                Mobile
              </dt>
              <dd className="text-slate-900 font-medium mt-0.5">
                {profile?.mobile_number || '—'}
              </dd>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
