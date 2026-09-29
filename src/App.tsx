import { type ReactNode } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import type { UserRole } from '@/types/database';

import { CustomerLayout } from '@/components/layouts/CustomerLayout';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { CustomerLogin } from '@/pages/auth/CustomerLogin';
import { CustomerRegister } from '@/pages/auth/CustomerRegister';
import { AdminLogin } from '@/pages/auth/AdminLogin';
import { CustomerHome } from '@/pages/customer/CustomerHome';
import { CustomerCatalogue } from '@/pages/customer/CustomerCatalogue';
import { CustomerOrders } from '@/pages/customer/CustomerOrders';
import { CustomerNotifications } from '@/pages/customer/CustomerNotifications';
import { CustomerProfile } from '@/pages/customer/CustomerProfile';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminOrders } from '@/pages/admin/AdminOrders';
import { AdminProducts } from '@/pages/admin/AdminProducts';
import { AdminBrands } from '@/pages/admin/AdminBrands';
import { AdminCategories } from '@/pages/admin/AdminCategories';
import { AdminInventory } from '@/pages/admin/AdminInventory';
import { AdminCustomers } from '@/pages/admin/AdminCustomers';
import { AdminNotifications } from '@/pages/admin/AdminNotifications';
import { AdminReports } from '@/pages/admin/AdminReports';
import { AdminSettings } from '@/pages/admin/AdminSettings';

function RoleGuard({ role, children }: { role: UserRole; children: ReactNode }) {
  const { profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin h-8 w-8 text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    const redirectTo = role === 'admin' ? '/admin/login' : '/login';
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (profile.role !== role) {
    const home = profile.role === 'admin' ? '/admin' : '/app';
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
      <Routes>
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Auth routes */}
        <Route path="/login" element={<CustomerLogin />} />
        <Route path="/register" element={<CustomerRegister />} />
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Customer routes */}
        <Route
          path="/app"
          element={
            <RoleGuard role="customer">
              <CustomerLayout />
            </RoleGuard>
          }
        >
          <Route index element={<CustomerHome />} />
          <Route path="catalogue" element={<CustomerCatalogue />} />
          <Route path="orders" element={<CustomerOrders />} />
          <Route path="notifications" element={<CustomerNotifications />} />
          <Route path="profile" element={<CustomerProfile />} />
        </Route>

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <RoleGuard role="admin">
              <AdminLayout />
            </RoleGuard>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="brands" element={<AdminBrands />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </CartProvider>
    </AuthProvider>
  );
}
