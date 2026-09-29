import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Tag,
  FolderTree,
  Boxes,
  ShoppingCart,
  Users,
  Bell,
  FileBarChart,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/brands', label: 'Brands', icon: Tag },
  { to: '/admin/categories', label: 'Categories', icon: FolderTree },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell },
  { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-slate-900 text-slate-100 fixed inset-y-0">
        <div className="px-5 py-5 border-b border-slate-800">
          <span className="text-lg font-bold">Wholesale OMS</span>
          <p className="text-xs text-slate-400 mt-0.5">Admin Panel</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-slate-800">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-white">{profile?.full_name}</p>
            <p className="text-xs text-slate-400">Administrator</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white w-full transition-colors"
          >
            <LogOut className="h-4.5 w-4.5 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 flex flex-col transition-transform duration-200 md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-lg font-bold">Wholesale OMS</span>
            <p className="text-xs text-slate-400 mt-0.5">Admin Panel</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-slate-800">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white w-full"
          >
            <LogOut className="h-4.5 w-4.5 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-slate-600 hover:text-slate-900"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-base font-bold text-slate-900">
            Admin Panel
          </span>
          <div className="w-9" />
        </header>

        <main className="flex-1 px-4 md:px-8 py-4 md:py-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
