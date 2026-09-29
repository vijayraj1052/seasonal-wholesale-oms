import { useEffect, useState, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, Package, ShoppingBag, Bell, User, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';

const navItems = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/catalogue', label: 'Catalogue', icon: Package },
  { to: '/app/orders', label: 'My Orders', icon: ShoppingBag },
  { to: '/app/notifications', label: 'Notifications', icon: Bell },
  { to: '/app/profile', label: 'Profile', icon: User },
];

export function CustomerLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);
    setUnreadCount(count ?? 0);
  }, []);

  useEffect(() => {
    fetchUnread();
    const channel = supabase
      .channel('customer-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile?.user_id}`,
        },
        () => fetchUnread()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUnread, profile?.user_id]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar — mobile */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between md:hidden">
        <span className="text-lg font-bold text-slate-900">Wholesale OMS</span>
        <button
          onClick={handleSignOut}
          className="p-2 text-slate-500 hover:text-slate-700"
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {/* Top bar — desktop */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-3 hidden md:flex items-center justify-between">
        <span className="text-xl font-bold text-slate-900">Wholesale OMS</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">
            {profile?.full_name} · {profile?.shop_name}
          </span>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Desktop nav */}
      <nav className="hidden md:flex bg-white border-b border-slate-200 px-6 gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `relative inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
            {item.label === 'Notifications' && unreadCount > 0 && (
              <span className="ml-1 rounded-full bg-red-500 text-white text-xs px-1.5 py-0.5 min-w-[18px] text-center">
                {unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-6 px-4 md:px-6 py-4 md:py-6 max-w-5xl w-full mx-auto">
        <Outlet />
      </main>

      {/* Bottom nav — mobile */}
      <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200 flex items-center justify-around md:hidden safe-area-bottom">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `relative flex flex-col items-center gap-0.5 py-2.5 px-2 flex-1 transition-colors ${
                isActive ? 'text-blue-600' : 'text-slate-500'
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
            {item.label === 'Notifications' && unreadCount > 0 && (
              <span className="absolute top-1 right-2 rounded-full bg-red-500 text-white text-[9px] px-1.5 py-0.5 min-w-[16px] text-center leading-none">
                {unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
