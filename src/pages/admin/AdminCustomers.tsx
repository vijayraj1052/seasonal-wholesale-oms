import { useEffect, useState } from 'react';
import { Users, Search, UserCheck, UserX } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import type { CustomerProfile } from '@/types/database';

export function AdminCustomers() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      // Admin reads customer_profiles via service role or RPC — but RLS allows
      // only the owner to SELECT. For the admin dashboard, we need an admin-only
      // function. For now, we'll use the RPC approach. If it fails, show empty.
      // This is a Phase 2 item — admin customer list requires an admin RPC.
      try {
        const { data, error: fetchError } = await supabase
          .from('customer_profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (fetchError) {
          // RLS blocks admin from reading all customer profiles directly.
          // This will be resolved with an admin RPC function in Phase 2.
          setCustomers([]);
          setError(null);
        } else {
          setCustomers((data ?? []) as CustomerProfile[]);
        }
      } catch {
        setCustomers([]);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(q) ||
      c.shop_name.toLowerCase().includes(q) ||
      c.mobile_number.includes(q) ||
      c.stall_number.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
        <p className="text-sm text-slate-500 mt-1">
          View and manage registered customers.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, shop, mobile, or stall number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error ? (
        <EmptyState
          icon={<Users className="h-7 w-7" />}
          title="Couldn't load customers"
          description={error}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" />}
          title="No customers to display"
          description={
            customers.length === 0
              ? 'Customer registrations will appear here once customers sign up. An admin-specific function to list all customers will be added in Phase 2 for secure access.'
              : 'No customers match your search.'
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 hidden md:table-cell">
                    Shop
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 hidden lg:table-cell">
                    Stall
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 hidden lg:table-cell">
                    Mobile
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 hidden xl:table-cell">
                    Licence
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.user_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {c.full_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                      {c.shop_name}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                      {c.stall_number} · {c.stall_location}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                      {c.mobile_number}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden xl:table-cell">
                      {c.licence_number || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.is_active ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 border-red-200">
                          <UserX className="h-3 w-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
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
