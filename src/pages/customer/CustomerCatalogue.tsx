import { useEffect, useState, useMemo } from 'react';
import { Package, Search, ShoppingCart, Plus, Minus, Check } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { useCart } from '@/context/CartContext';
import type {
  Product,
  Brand,
  Category,
  ProductUnit,
  Inventory,
  CartItem,
  UnitType,
} from '@/types/database';

interface CatalogueRow {
  product: Product;
  brand: Brand;
  category: Category | null;
  units: ProductUnit[];
  inventory: Inventory | null;
}

export function CustomerCatalogue() {
  const { addItem, totalItems } = useCart();
  const [rows, setRows] = useState<CatalogueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Per-product UI state: selected unit and quantity
  const [selectedUnit, setSelectedUnit] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [addedFlash, setAddedFlash] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data: products, error: productError } = await supabase
        .from('products')
        .select('*, brand:brands(*), category:categories(*)')
        .eq('is_active', true)
        .order('serial_number', { ascending: true, nullsFirst: false });

      if (productError) {
        setError(productError.message);
        setLoading(false);
        return;
      }

      if (!products || products.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const productIds = products.map((p) => p.id);

      const [{ data: units }, { data: inventory }] = await Promise.all([
        supabase
          .from('product_units')
          .select('*')
          .in('product_id', productIds)
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('inventory')
          .select('*')
          .in('product_id', productIds),
      ]);

      const unitsMap = new Map<string, ProductUnit[]>();
      (units ?? []).forEach((u) => {
        const arr = unitsMap.get(u.product_id) ?? [];
        arr.push(u as ProductUnit);
        unitsMap.set(u.product_id, arr);
      });

      const inventoryMap = new Map<string, Inventory>();
      (inventory ?? []).forEach((inv) => {
        inventoryMap.set(inv.product_id, inv as Inventory);
      });

      const combined: CatalogueRow[] = products.map((p) => ({
        product: p as Product,
        brand: (p as { brand: Brand }).brand,
        category: (p as { category: Category | null }).category,
        units: unitsMap.get(p.id) ?? [],
        inventory: inventoryMap.get(p.id) ?? null,
      }));

      setRows(combined);
      setLoading(false);
    }

    load();
  }, []);

  const brands = useMemo(
    () =>
      Array.from(
        new Map(rows.map((r) => [r.brand.id, r.brand])).values()
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [rows]
  );

  const categories = useMemo(
    () =>
      Array.from(
        new Map(
          rows
            .filter((r) => r.category !== null)
            .map((r) => [(r.category as Category).id, r.category as Category])
        ).values()
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [rows]
  );

  const filtered = rows.filter((row) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      row.product.name.toLowerCase().includes(q) ||
      row.brand.name.toLowerCase().includes(q) ||
      (row.product.variety ?? '').toLowerCase().includes(q) ||
      (row.product.product_code ?? '').toLowerCase().includes(q);
    const matchesBrand = brandFilter === 'all' || row.brand.id === brandFilter;
    const matchesCategory =
      categoryFilter === 'all' ||
      (row.category !== null && row.category.id === categoryFilter);
    return matchesSearch && matchesBrand && matchesCategory;
  });

  const getNetStock = (row: CatalogueRow) =>
    row.inventory?.net_available_stock ?? 0;

  const isOrderable = (row: CatalogueRow) => {
    if (!row.product.ordering_enabled) return false;
    if (getNetStock(row) <= 0) return false;
    if (row.units.length === 0) return false;
    return true;
  };

  const getSelectedUnit = (row: CatalogueRow): ProductUnit | null => {
    const unitId = selectedUnit[row.product.id];
    if (unitId) {
      const found = row.units.find((u) => u.id === unitId);
      if (found) return found;
    }
    return row.units[0] ?? null;
  };

  const getQuantity = (productId: string) => quantities[productId] ?? 1;

  const effectivePrice = (unit: ProductUnit) => {
    const discount = unit.base_price * (unit.discount_percent / 100);
    return unit.base_price - discount;
  };

  const handleAddToCart = (row: CatalogueRow) => {
    const unit = getSelectedUnit(row);
    if (!unit) return;
    const qty = getQuantity(row.product.id);
    const netStock = getNetStock(row);
    if (qty > netStock) return;

    const item: CartItem = {
      product_id: row.product.id,
      product_name: row.product.name,
      brand_name: row.brand.name,
      unit_id: unit.id,
      unit_type: unit.unit_type as UnitType,
      unit_label: unit.unit_label,
      quantity_per_unit: unit.quantity_per_unit,
      base_price: unit.base_price,
      discount_percent: unit.discount_percent,
      requested_quantity: qty,
    };
    addItem(item);
    setAddedFlash((prev) => ({ ...prev, [row.product.id]: true }));
    setTimeout(() => {
      setAddedFlash((prev) => ({ ...prev, [row.product.id]: false }));
    }, 1500);
  };

  const adjustQty = (productId: string, delta: number, max: number) => {
    setQuantities((prev) => {
      const current = prev[productId] ?? 1;
      const next = Math.max(1, Math.min(current + delta, max));
      return { ...prev, [productId]: next };
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Spinner size="lg" />
        <p className="mt-3 text-sm text-slate-500">Loading catalogue…</p>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<Package className="h-7 w-7" />}
        title="Couldn't load the catalogue"
        description={error}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + cart badge */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Catalogue</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Browse available products, pricing, and stock.
          </p>
        </div>
        <div className="relative shrink-0">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <ShoppingCart className="h-5 w-5 text-slate-600" />
            <span className="text-sm font-semibold text-slate-900">
              {totalItems}
            </span>
            <span className="text-xs text-slate-500 hidden sm:inline">
              in cart
            </span>
          </div>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search products, brands, or codes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {brands.length > 0 && (
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="h-7 w-7" />}
          title="No products found"
          description={
            rows.length === 0
              ? 'The catalogue hasn\u2019t been populated yet. Products will appear here once the Admin adds them.'
              : 'No products match your search. Try adjusting your filters.'
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((row, idx) => {
            const orderable = isOrderable(row);
            const netStock = getNetStock(row);
            const unit = getSelectedUnit(row);
            const qty = getQuantity(row.product.id);
            const effPrice = unit ? effectivePrice(unit) : 0;
            const lineTotal = effPrice * qty;
            const maxQty = netStock;
            const flashed = addedFlash[row.product.id];

            return (
              <Card key={row.product.id}>
                <CardBody className="space-y-3">
                  {/* Top row: identity + status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-400">
                          {row.product.serial_number ?? idx + 1}
                        </span>
                        <span className="text-xs font-medium text-slate-600">
                          {row.brand.name}
                        </span>
                        {row.category && (
                          <Badge className="bg-blue-50 text-blue-700 border-blue-100">
                            {row.category.name}
                          </Badge>
                        )}
                        {row.product.product_code && (
                          <span className="text-xs text-slate-400">
                            #{row.product.product_code}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 mt-1">
                        {row.product.name}
                      </h3>
                      {row.product.variety && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {row.product.variety}
                        </p>
                      )}
                      {row.product.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {row.product.description}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {orderable ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                          {netStock} in stock
                        </Badge>
                      ) : netStock <= 0 ? (
                        <Badge className="bg-red-100 text-red-800 border-red-200">
                          Out of Stock
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                          Disabled
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Unit selection + pricing + add to cart */}
                  {orderable && unit && (
                    <div className="border-t border-slate-100 pt-3 space-y-3">
                      {/* Unit selector */}
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">
                          Selling Unit
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {row.units.map((u) => (
                            <button
                              key={u.id}
                              onClick={() =>
                                setSelectedUnit((prev) => ({
                                  ...prev,
                                  [row.product.id]: u.id,
                                }))
                              }
                              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                                unit.id === u.id
                                  ? 'border-blue-600 bg-blue-600 text-white'
                                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                              }`}
                            >
                              {u.unit_label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Pricing breakdown */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <p className="text-slate-400">Unit qty</p>
                          <p className="font-semibold text-slate-700">
                            {unit.quantity_per_unit} pcs
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Base price</p>
                          <p className="font-semibold text-slate-700">
                            ${unit.base_price.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Discount</p>
                          <p className="font-semibold text-slate-700">
                            {unit.discount_percent > 0
                              ? `${unit.discount_percent}%`
                              : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Effective price</p>
                          <p className="font-semibold text-blue-700">
                            ${effPrice.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Quantity + add to cart */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-slate-500">
                            Qty
                          </label>
                          <div className="flex items-center rounded-lg border border-slate-300 overflow-hidden">
                            <button
                              onClick={() =>
                                adjustQty(row.product.id, -1, maxQty)
                              }
                              disabled={qty <= 1}
                              className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={maxQty}
                              value={qty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (isNaN(val)) return;
                                setQuantities((prev) => ({
                                  ...prev,
                                  [row.product.id]: Math.max(
                                    1,
                                    Math.min(val, maxQty)
                                  ),
                                }));
                              }}
                              className="w-14 text-center text-sm font-medium text-slate-900 border-x border-slate-300 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              onClick={() =>
                                adjustQty(row.product.id, 1, maxQty)
                              }
                              disabled={qty >= maxQty}
                              className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => handleAddToCart(row)}
                          disabled={qty > maxQty}
                        >
                          {flashed ? (
                            <>
                              <Check className="h-4 w-4" />
                              Added
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="h-4 w-4" />
                              Add to Cart
                            </>
                          )}
                        </Button>

                        <span className="text-sm font-semibold text-slate-900 ml-auto">
                          Subtotal: ${lineTotal.toFixed(2)}
                        </span>
                      </div>

                      {qty >= maxQty && maxQty > 0 && (
                        <p className="text-xs text-amber-600">
                          Maximum available quantity reached ({maxQty} units).
                        </p>
                      )}
                    </div>
                  )}

                  {/* No units available message */}
                  {!orderable && row.units.length === 0 && netStock > 0 && (
                    <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">
                      No selling units configured for this product yet.
                    </p>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
