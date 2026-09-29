import { useEffect, useState, useCallback } from 'react';
import { Boxes, Search, AlertTriangle, Save, X, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import type { Product, Brand, Inventory } from '@/types/database';

interface InventoryRow {
  product: Product;
  brand: Brand;
  inventory: Inventory | null;
}

export function AdminInventory() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPhysical, setEditPhysical] = useState('0');
  const [editAllocated, setEditAllocated] = useState('0');
  const [editReserved, setEditReserved] = useState('0');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('products')
      .select('*, brand:brands(*)')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const productIds = (data ?? []).map((p) => p.id);
    const invMap = new Map<string, Inventory>();
    if (productIds.length > 0) {
      const { data: inv } = await supabase
        .from('inventory')
        .select('*')
        .in('product_id', productIds);
      (inv ?? []).forEach((i) =>
        invMap.set(i.product_id, i as Inventory)
      );
    }

    setRows(
      (data ?? []).map((p) => ({
        product: p as Product,
        brand: (p as { brand: Brand }).brand,
        inventory: invMap.get(p.id) ?? null,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((row) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      row.product.name.toLowerCase().includes(q) ||
      row.brand.name.toLowerCase().includes(q) ||
      (row.product.product_code ?? '').toLowerCase().includes(q)
    );
  });

  const startEdit = (row: InventoryRow) => {
    setEditingId(row.product.id);
    setEditPhysical(row.inventory?.physical_stock.toString() ?? '0');
    setEditAllocated(row.inventory?.allocated_stock.toString() ?? '0');
    setEditReserved(row.inventory?.reserved_stock.toString() ?? '0');
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSaveError(null);
  };

  const handleSave = async (row: InventoryRow) => {
    const physVal = parseInt(editPhysical, 10);
    const allocVal = parseInt(editAllocated, 10);
    const resVal = parseInt(editReserved, 10);

    if (isNaN(physVal) || physVal < 0) {
      setSaveError('Physical stock must be a non-negative number.');
      return;
    }
    if (isNaN(allocVal) || allocVal < 0) {
      setSaveError('Allocated stock must be a non-negative number.');
      return;
    }
    if (isNaN(resVal) || resVal < 0) {
      setSaveError('Reserved stock must be a non-negative number.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    const { error: upsertError } = await supabase
      .from('inventory')
      .upsert(
        {
          product_id: row.product.id,
          physical_stock: physVal,
          allocated_stock: allocVal,
          reserved_stock: resVal,
          last_updated: new Date().toISOString(),
        },
        { onConflict: 'product_id' }
      );

    if (upsertError) {
      setSaveError(upsertError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditingId(null);
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && rows.length === 0) {
    return (
      <EmptyState
        icon={<Boxes className="h-7 w-7" />}
        title="Couldn't load inventory"
        description={error}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage stock levels: physical, allocated, reserved, and net available.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-7 w-7" />}
          title="No inventory to display"
          description="Inventory records will appear here once products are added and stock is entered."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 hidden md:table-cell">
                    Brand
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">
                    Physical
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">
                    Allocated
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">
                    Reserved
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">
                    Net Available
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => {
                  const net =
                    row.inventory?.net_available_stock ?? null;
                  const isOutOfStock = net !== null && net <= 0;
                  const isLowStock = net !== null && net > 0 && net <= 10;
                  const isEditing = editingId === row.product.id;

                  return (
                    <tr key={row.product.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.product.name}
                        {row.product.product_code && (
                          <span className="block text-xs text-slate-400">
                            #{row.product.product_code}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                        {row.brand.name}
                      </td>

                      {isEditing ? (
                        <>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              min="0"
                              value={editPhysical}
                              onChange={(e) => setEditPhysical(e.target.value)}
                              className="w-20 rounded border border-slate-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              min="0"
                              value={editAllocated}
                              onChange={(e) => setEditAllocated(e.target.value)}
                              className="w-20 rounded border border-slate-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              min="0"
                              value={editReserved}
                              onChange={(e) => setEditReserved(e.target.value)}
                              className="w-20 rounded border border-slate-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {(parseInt(editPhysical, 10) || 0) -
                              (parseInt(editAllocated, 10) || 0) -
                              (parseInt(editReserved, 10) || 0)}
                          </td>
                          <td className="px-4 py-3 text-center" />
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                loading={saving}
                                onClick={() => handleSave(row)}
                              >
                                <Save className="h-3.5 w-3.5" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEdit}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {row.inventory?.physical_stock ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {row.inventory?.allocated_stock ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {row.inventory?.reserved_stock ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">
                            {net ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isOutOfStock ? (
                              <Badge className="bg-red-100 text-red-800 border-red-200">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Out of Stock
                              </Badge>
                            ) : isLowStock ? (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                                Low Stock
                              </Badge>
                            ) : net !== null ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                                In Stock
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-500 border-slate-200">
                                Not Set
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEdit(row)}
                            >
                              Adjust
                            </Button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {saveError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {saveError}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">
        Net Available = Physical − Allocated − Reserved. This is a calculated
        field and cannot be edited directly.
      </p>
    </div>
  );
}
