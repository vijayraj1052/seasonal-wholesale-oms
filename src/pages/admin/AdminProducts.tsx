import { useEffect, useState, useCallback } from 'react';
import {
  Package,
  Plus,
  Search,
  Pencil,
  Check,
  X,
  AlertCircle,
  Trash2,
  Boxes,
  ChevronDown,
  ChevronRight,
  ImageIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import type {
  Product,
  Brand,
  Category,
  ProductUnit,
  Inventory,
  UnitType,
} from '@/types/database';
import { UNIT_TYPE_LABELS } from '@/types/database';

interface ProductRow {
  product: Product;
  brand: Brand;
  category: Category | null;
  units: ProductUnit[];
  inventory: Inventory | null;
}

interface ProductFormState {
  name: string;
  product_code: string;
  brand_id: string;
  category_id: string;
  variety: string;
  description: string;
  image_url: string;
  serial_number: string;
  is_active: boolean;
  ordering_enabled: boolean;
}

interface UnitFormState {
  id: string | null;
  unit_type: UnitType;
  unit_label: string;
  quantity_per_unit: string;
  base_price: string;
  discount_percent: string;
  is_active: boolean;
}

const emptyProductForm: ProductFormState = {
  name: '',
  product_code: '',
  brand_id: '',
  category_id: '',
  variety: '',
  description: '',
  image_url: '',
  serial_number: '',
  is_active: true,
  ordering_enabled: true,
};

const emptyUnitForm: UnitFormState = {
  id: null,
  unit_type: 'PIECE',
  unit_label: '',
  quantity_per_unit: '1',
  base_price: '',
  discount_percent: '0',
  is_active: true,
};

const UNIT_TYPES = Object.keys(UNIT_TYPE_LABELS) as UnitType[];

export function AdminProducts() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');

  // Product form state
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [productFormError, setProductFormError] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  // Unit form state
  const [units, setUnits] = useState<UnitFormState[]>([]);
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [unitForm, setUnitForm] = useState<UnitFormState>(emptyUnitForm);
  const [unitFormError, setUnitFormError] = useState<string | null>(null);
  const [savingUnit, setSavingUnit] = useState(false);

  // Inventory form state
  const [physicalStock, setPhysicalStock] = useState('0');
  const [reservedStock, setReservedStock] = useState('0');
  const [allocatedStock, setAllocatedStock] = useState('0');
  const [savingInventory, setSavingInventory] = useState(false);

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [
      { data: products, error: productError },
      { data: brandData },
      { data: categoryData },
    ] = await Promise.all([
      supabase
        .from('products')
        .select('*, brand:brands(*), category:categories(*)')
        .order('created_at', { ascending: false }),
      supabase.from('brands').select('*').order('name'),
      supabase.from('categories').select('*').order('name'),
    ]);

    if (productError) {
      setError(productError.message);
      setLoading(false);
      return;
    }

    setBrands((brandData ?? []) as Brand[]);
    setCategories((categoryData ?? []) as Category[]);

    if (!products || products.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const productIds = products.map((p) => p.id);
    const [{ data: unitData }, { data: invData }] = await Promise.all([
      supabase
        .from('product_units')
        .select('*')
        .in('product_id', productIds)
        .order('sort_order', { ascending: true }),
      supabase.from('inventory').select('*').in('product_id', productIds),
    ]);

    const unitsMap = new Map<string, ProductUnit[]>();
    (unitData ?? []).forEach((u) => {
      const arr = unitsMap.get(u.product_id) ?? [];
      arr.push(u as ProductUnit);
      unitsMap.set(u.product_id, arr);
    });

    const invMap = new Map<string, Inventory>();
    (invData ?? []).forEach((i) =>
      invMap.set(i.product_id, i as Inventory)
    );

    setRows(
      products.map((p) => ({
        product: p as Product,
        brand: (p as { brand: Brand }).brand,
        category: (p as { category: Category | null }).category,
        units: unitsMap.get(p.id) ?? [],
        inventory: invMap.get(p.id) ?? null,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ========== Product form ==========

  const openAddProduct = () => {
    setEditingProductId(null);
    setProductForm(emptyProductForm);
    setProductFormError(null);
    setUnits([]);
    setShowProductForm(true);
    setShowUnitForm(false);
    setPhysicalStock('0');
    setReservedStock('0');
    setAllocatedStock('0');
  };

  const openEditProduct = (row: ProductRow) => {
    setEditingProductId(row.product.id);
    setProductForm({
      name: row.product.name,
      product_code: row.product.product_code ?? '',
      brand_id: row.product.brand_id,
      category_id: row.product.category_id ?? '',
      variety: row.product.variety ?? '',
      description: row.product.description ?? '',
      image_url: row.product.image_url ?? '',
      serial_number: row.product.serial_number?.toString() ?? '',
      is_active: row.product.is_active,
      ordering_enabled: row.product.ordering_enabled,
    });
    setProductFormError(null);
    setUnits(
      row.units.map((u) => ({
        id: u.id,
        unit_type: u.unit_type,
        unit_label: u.unit_label,
        quantity_per_unit: u.quantity_per_unit.toString(),
        base_price: u.base_price.toString(),
        discount_percent: u.discount_percent.toString(),
        is_active: u.is_active,
      }))
    );
    setShowUnitForm(false);
    setPhysicalStock(row.inventory?.physical_stock.toString() ?? '0');
    setReservedStock(row.inventory?.reserved_stock.toString() ?? '0');
    setAllocatedStock(row.inventory?.allocated_stock.toString() ?? '0');
    setShowProductForm(true);
  };

  const cancelProductForm = () => {
    setShowProductForm(false);
    setEditingProductId(null);
    setProductForm(emptyProductForm);
    setProductFormError(null);
    setUnits([]);
    setShowUnitForm(false);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = productForm.name.trim();
    const trimmedCode = productForm.product_code.trim();

    if (!trimmedName) {
      setProductFormError('Product name is required.');
      return;
    }
    if (!trimmedCode) {
      setProductFormError('Product code / SKU is required.');
      return;
    }
    if (!productForm.brand_id) {
      setProductFormError('Brand is required.');
      return;
    }
    if (!productForm.category_id) {
      setProductFormError('Category is required.');
      return;
    }

    setSavingProduct(true);
    setProductFormError(null);

    const payload = {
      name: trimmedName,
      product_code: trimmedCode,
      brand_id: productForm.brand_id,
      category_id: productForm.category_id || null,
      variety: productForm.variety.trim() || null,
      description: productForm.description.trim() || null,
      image_url: productForm.image_url.trim() || null,
      serial_number: productForm.serial_number
        ? parseInt(productForm.serial_number, 10)
        : null,
      is_active: productForm.is_active,
      ordering_enabled: productForm.ordering_enabled,
    };

    let productId = editingProductId;

    if (editingProductId) {
      const { error: updateError } = await supabase
        .from('products')
        .update(payload)
        .eq('id', editingProductId);

      if (updateError) {
        setProductFormError(updateError.message);
        setSavingProduct(false);
        return;
      }
    } else {
      const { data: newProduct, error: insertError } = await supabase
        .from('products')
        .insert(payload)
        .select('id')
        .single();

      if (insertError) {
        setProductFormError(insertError.message);
        setSavingProduct(false);
        return;
      }
      productId = newProduct.id;
    }

    // Save inventory
    if (productId) {
      const physVal = parseInt(physicalStock, 10) || 0;
      const resVal = parseInt(reservedStock, 10) || 0;
      const allocVal = parseInt(allocatedStock, 10) || 0;

      const { error: invError } = await supabase
        .from('inventory')
        .upsert(
          {
            product_id: productId,
            physical_stock: physVal,
            reserved_stock: resVal,
            allocated_stock: allocVal,
            last_updated: new Date().toISOString(),
          },
          { onConflict: 'product_id' }
        );

      if (invError) {
        setProductFormError(
          `Product saved, but inventory failed: ${invError.message}`
        );
        setSavingProduct(false);
        return;
      }
    }

    setSavingProduct(false);
    cancelProductForm();
    await loadAll();
  };

  const toggleProductActive = async (row: ProductRow) => {
    const { error: toggleError } = await supabase
      .from('products')
      .update({ is_active: !row.product.is_active })
      .eq('id', row.product.id);

    if (toggleError) {
      setError(toggleError.message);
      return;
    }
    await loadAll();
  };

  const toggleRowExpand = (productId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  // ========== Unit form ==========

  const openAddUnit = () => {
    const usedTypes = new Set(units.map((u) => u.unit_type));
    const firstAvailable = UNIT_TYPES.find((t) => !usedTypes.has(t));
    setUnitForm({
      ...emptyUnitForm,
      unit_type: firstAvailable ?? 'PIECE',
    });
    setUnitFormError(null);
    setShowUnitForm(true);
  };

  const openEditUnit = (unit: UnitFormState) => {
    setUnitForm({ ...unit });
    setUnitFormError(null);
    setShowUnitForm(true);
  };

  const cancelUnitForm = () => {
    setShowUnitForm(false);
    setUnitForm(emptyUnitForm);
    setUnitFormError(null);
  };

  const handleUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProductId) return;

    const label = unitForm.unit_label.trim();
    if (!label) {
      setUnitFormError('Unit label is required.');
      return;
    }

    const qty = parseInt(unitForm.quantity_per_unit, 10);
    if (isNaN(qty) || qty <= 0) {
      setUnitFormError('Quantity per unit must be a positive number.');
      return;
    }

    const price = parseFloat(unitForm.base_price);
    if (isNaN(price) || price < 0) {
      setUnitFormError('Base price must be a valid non-negative number.');
      return;
    }

    const discount = parseFloat(unitForm.discount_percent) || 0;
    if (discount < 0 || discount > 100) {
      setUnitFormError('Discount must be between 0 and 100.');
      return;
    }

    setSavingUnit(true);
    setUnitFormError(null);

    const payload = {
      product_id: editingProductId,
      unit_type: unitForm.unit_type,
      unit_label: label,
      quantity_per_unit: qty,
      base_price: price,
      discount_percent: discount,
      is_active: unitForm.is_active,
      sort_order: units.length,
    };

    if (unitForm.id) {
      const { error: updateError } = await supabase
        .from('product_units')
        .update({
          unit_type: unitForm.unit_type,
          unit_label: label,
          quantity_per_unit: qty,
          base_price: price,
          discount_percent: discount,
          is_active: unitForm.is_active,
        })
        .eq('id', unitForm.id);

      if (updateError) {
        setUnitFormError(updateError.message);
        setSavingUnit(false);
        return;
      }

      setUnits((prev) =>
        prev.map((u) =>
          u.id === unitForm.id
            ? {
                ...unitForm,
                unit_label: label,
                quantity_per_unit: qty.toString(),
                base_price: price.toString(),
                discount_percent: discount.toString(),
              }
            : u
        )
      );
    } else {
      const { data: newUnit, error: insertError } = await supabase
        .from('product_units')
        .insert(payload)
        .select('id')
        .single();

      if (insertError) {
        setUnitFormError(insertError.message);
        setSavingUnit(false);
        return;
      }

      setUnits((prev) => [
        ...prev,
        {
          ...unitForm,
          id: newUnit.id,
          unit_label: label,
          quantity_per_unit: qty.toString(),
          base_price: price.toString(),
          discount_percent: discount.toString(),
        },
      ]);
    }

    setSavingUnit(false);
    cancelUnitForm();
  };

  const handleDeleteUnit = async (unitId: string) => {
    if (!confirm('Remove this selling unit? This cannot be undone.')) return;

    const { error: deleteError } = await supabase
      .from('product_units')
      .delete()
      .eq('id', unitId);

    if (deleteError) {
      setUnitFormError(deleteError.message);
      return;
    }

    setUnits((prev) => prev.filter((u) => u.id !== unitId));
  };

  const toggleUnitActive = async (unit: UnitFormState) => {
    const { error: toggleError } = await supabase
      .from('product_units')
      .update({ is_active: !unit.is_active })
      .eq('id', unit.id);

    if (toggleError) {
      setUnitFormError(toggleError.message);
      return;
    }

    setUnits((prev) =>
      prev.map((u) =>
        u.id === unit.id ? { ...u, is_active: !u.is_active } : u
      )
    );
  };

  // ========== Filtering ==========

  const filtered = rows.filter((row) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      row.product.name.toLowerCase().includes(q) ||
      row.product.product_code?.toLowerCase().includes(q) ||
      row.brand.name.toLowerCase().includes(q);
    const matchesBrand =
      brandFilter === 'all' || row.brand.id === brandFilter;
    const matchesCategory =
      categoryFilter === 'all' ||
      (row.category !== null && row.category.id === categoryFilter);
    const matchesActive =
      activeFilter === 'all' ||
      (activeFilter === 'active' && row.product.is_active) ||
      (activeFilter === 'inactive' && !row.product.is_active);
    return matchesSearch && matchesBrand && matchesCategory && matchesActive;
  });

  const clearFilters = () => {
    setSearch('');
    setBrandFilter('all');
    setCategoryFilter('all');
    setActiveFilter('all');
  };

  const hasActiveFilters =
    search !== '' ||
    brandFilter !== 'all' ||
    categoryFilter !== 'all' ||
    activeFilter !== 'all';

  const activeBrands = brands.filter((b) => b.is_active);
  const activeCategories = categories.filter((c) => c.is_active);

  const effectivePrice = (unit: UnitFormState) => {
    const base = parseFloat(unit.base_price) || 0;
    const disc = parseFloat(unit.discount_percent) || 0;
    return base - base * (disc / 100);
  };

  // ========== Render ==========

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
        icon={<Package className="h-7 w-7" />}
        title="Couldn't load products"
        description={error}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your catalogue: products, selling units, pricing, and stock.
          </p>
        </div>
        {!showProductForm && (
          <Button
            onClick={openAddProduct}
            disabled={activeBrands.length === 0 || activeCategories.length === 0}
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        )}
      </div>

      {activeBrands.length === 0 && !showProductForm && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          You need at least one active brand before adding products. Go to the
          Brands page to create one.
        </div>
      )}

      {activeCategories.length === 0 && !showProductForm && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          You need at least one active category before adding products. Go to
          the Categories page to create one.
        </div>
      )}

      {/* Product Form Modal */}
      {showProductForm && (
        <Card>
          <form onSubmit={handleProductSubmit} className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {editingProductId ? 'Edit Product' : 'New Product'}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cancelProductForm}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Step 1: Basic info */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                1. Product Information
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Product Name"
                  required
                  value={productForm.name}
                  onChange={(e) =>
                    setProductForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. Sparkler XYZ"
                />
                <Input
                  label="Product Code / SKU"
                  required
                  value={productForm.product_code}
                  onChange={(e) =>
                    setProductForm((f) => ({
                      ...f,
                      product_code: e.target.value,
                    }))
                  }
                  placeholder="e.g. SPK-001"
                />
                <Input
                  label="Variety"
                  value={productForm.variety}
                  onChange={(e) =>
                    setProductForm((f) => ({ ...f, variety: e.target.value }))
                  }
                  placeholder="e.g. 10cm Gold"
                />
                <Input
                  label="Serial Number / S.No"
                  type="number"
                  value={productForm.serial_number}
                  onChange={(e) =>
                    setProductForm((f) => ({
                      ...f,
                      serial_number: e.target.value,
                    }))
                  }
                  placeholder="Display order"
                />
              </div>
              <div className="mt-4">
                <label
                  htmlFor="prod-description"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Description
                </label>
                <textarea
                  id="prod-description"
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm((f) => ({
                      ...f,
                      description: e.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="Optional product description"
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="mt-4">
                <Input
                  label="Image URL"
                  value={productForm.image_url}
                  onChange={(e) =>
                    setProductForm((f) => ({ ...f, image_url: e.target.value }))
                  }
                  placeholder="https://example.com/product-image.jpg"
                />
                {productForm.image_url && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={productForm.image_url}
                      alt="Preview"
                      className="h-16 w-16 rounded-lg object-cover border border-slate-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <span className="text-xs text-slate-400">
                      <ImageIcon className="h-3 w-3 inline mr-1" />
                      Image preview
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Brand + Category */}
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                2. Brand &amp; Category
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Brand <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={productForm.brand_id}
                    onChange={(e) =>
                      setProductForm((f) => ({
                        ...f,
                        brand_id: e.target.value,
                      }))
                    }
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a brand…</option>
                    {activeBrands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={productForm.category_id}
                    onChange={(e) =>
                      setProductForm((f) => ({
                        ...f,
                        category_id: e.target.value,
                      }))
                    }
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a category…</option>
                    {activeCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-6 mt-4">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={productForm.is_active}
                    onChange={(e) =>
                      setProductForm((f) => ({
                        ...f,
                        is_active: e.target.checked,
                      }))
                    }
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={productForm.ordering_enabled}
                    onChange={(e) =>
                      setProductForm((f) => ({
                        ...f,
                        ordering_enabled: e.target.checked,
                      }))
                    }
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Ordering Enabled
                </label>
              </div>
            </div>

            {/* Step 3: Selling Units */}
            {editingProductId && (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  3. Selling Units &amp; Pricing
                </p>

                {units.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {units.map((unit) => (
                      <div
                        key={unit.id}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-900">
                              {unit.unit_label}
                            </span>
                            <Badge className="bg-blue-50 text-blue-700 border-blue-100">
                              {UNIT_TYPE_LABELS[unit.unit_type]}
                            </Badge>
                            {!unit.is_active && (
                              <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {unit.quantity_per_unit} pcs/unit · ${unit.base_price}{' '}
                            {unit.discount_percent !== '0' &&
                              `· ${unit.discount_percent}% off`}
                            · Effective: ${effectivePrice(unit).toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openEditUnit(unit)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleUnitActive(unit)}
                          >
                            {unit.is_active ? 'Hide' : 'Show'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteUnit(unit.id!)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {units.length === 0 && !showUnitForm && (
                  <p className="text-sm text-slate-400 mb-3">
                    No selling units configured yet. Add at least one unit
                    (e.g. Piece) so customers can order this product.
                  </p>
                )}

                {!showUnitForm && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openAddUnit}
                  >
                    <Plus className="h-4 w-4" />
                    Add Selling Unit
                  </Button>
                )}

                {showUnitForm && (
                  <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Unit Type
                        </label>
                        <select
                          value={unitForm.unit_type}
                          onChange={(e) =>
                            setUnitForm((f) => ({
                              ...f,
                              unit_type: e.target.value as UnitType,
                              unit_label:
                                f.unit_label === '' ||
                                UNIT_TYPES.some(
                                  (t) =>
                                    UNIT_TYPE_LABELS[t] === f.unit_label
                                )
                                  ? UNIT_TYPE_LABELS[e.target.value as UnitType]
                                  : f.unit_label,
                            }))
                          }
                          className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {UNIT_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {UNIT_TYPE_LABELS[t]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Input
                          label="Unit Label"
                          required
                          value={unitForm.unit_label}
                          onChange={(e) =>
                            setUnitForm((f) => ({
                              ...f,
                              unit_label: e.target.value,
                            }))
                          }
                          placeholder="e.g. Box of 10"
                        />
                      </div>
                      <div>
                        <Input
                          label="Quantity per Unit"
                          type="number"
                          required
                          value={unitForm.quantity_per_unit}
                          onChange={(e) =>
                            setUnitForm((f) => ({
                              ...f,
                              quantity_per_unit: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Input
                          label="Base Price"
                          type="number"
                          step="0.01"
                          required
                          value={unitForm.base_price}
                          onChange={(e) =>
                            setUnitForm((f) => ({
                              ...f,
                              base_price: e.target.value,
                            }))
                          }
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Input
                          label="Discount %"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={unitForm.discount_percent}
                          onChange={(e) =>
                            setUnitForm((f) => ({
                              ...f,
                              discount_percent: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 text-sm text-slate-700 pb-2.5">
                          <input
                            type="checkbox"
                            checked={unitForm.is_active}
                            onChange={(e) =>
                              setUnitForm((f) => ({
                                ...f,
                                is_active: e.target.checked,
                              }))
                            }
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          Active
                        </label>
                      </div>
                    </div>
                    {unitFormError && (
                      <p className="text-sm text-red-600">{unitFormError}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        loading={savingUnit}
                        onClick={handleUnitSubmit}
                      >
                        <Check className="h-4 w-4" />
                        {unitForm.id ? 'Update Unit' : 'Add Unit'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={cancelUnitForm}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Inventory */}
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                4. Inventory
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Physical Stock"
                  type="number"
                  min="0"
                  value={physicalStock}
                  onChange={(e) => setPhysicalStock(e.target.value)}
                />
                <Input
                  label="Allocated Stock"
                  type="number"
                  min="0"
                  value={allocatedStock}
                  onChange={(e) => setAllocatedStock(e.target.value)}
                  hint="Confirmed to orders"
                />
                <Input
                  label="Reserved Stock"
                  type="number"
                  min="0"
                  value={reservedStock}
                  onChange={(e) => setReservedStock(e.target.value)}
                  hint="Pending order requests"
                />
              </div>
              <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
                <span className="font-medium">Net Available:</span>{' '}
                <span className="font-semibold text-slate-900">
                  {(parseInt(physicalStock, 10) || 0) -
                    (parseInt(allocatedStock, 10) || 0) -
                    (parseInt(reservedStock, 10) || 0)}
                </span>
                <span className="text-slate-400 ml-2">
                  (Physical − Allocated − Reserved)
                </span>
              </div>
            </div>

            {/* Submit */}
            {productFormError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {productFormError}
              </div>
            )}
            <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
              <Button type="submit" loading={savingProduct}>
                <Check className="h-4 w-4" />
                {editingProductId ? 'Save Changes' : 'Create Product'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={cancelProductForm}
              >
                Cancel
              </Button>
              {editingProductId && (
                <span className="text-xs text-slate-400 ml-auto">
                  Selling units and inventory are saved automatically with the
                  product.
                </span>
              )}
            </div>
          </form>
        </Card>
      )}

      {/* Filters + list */}
      {!showProductForm && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, SKU, or brand…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Package className="h-7 w-7" />}
              title={rows.length === 0 ? 'No products yet' : 'No products match your filters'}
              description={
                rows.length === 0
                  ? 'Start building your catalogue by adding your first product.'
                  : 'Try adjusting or clearing your filters.'
              }
              action={
                rows.length === 0 ? (
                  <Button
                    onClick={openAddProduct}
                    disabled={
                      activeBrands.length === 0 || activeCategories.length === 0
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Add Your First Product
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((row) => {
                const expanded = expandedRows.has(row.product.id);
                const netStock = row.inventory?.net_available_stock ?? null;
                return (
                  <Card key={row.product.id}>
                    {/* Product row */}
                    <CardBody className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => toggleRowExpand(row.product.id)}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              {expanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            <span className="text-sm font-semibold text-slate-900">
                              {row.product.name}
                            </span>
                            {row.product.product_code && (
                              <span className="text-xs text-slate-400">
                                #{row.product.product_code}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-1 ml-6">
                            <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                              {row.brand.name}
                            </Badge>
                            {row.category && (
                              <Badge className="bg-blue-50 text-blue-700 border-blue-100">
                                {row.category.name}
                              </Badge>
                            )}
                            {row.product.is_active ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                                Active
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                                Inactive
                              </Badge>
                            )}
                            {row.product.ordering_enabled ? (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                                Orderable
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                                Ordering Disabled
                              </Badge>
                            )}
                          </div>
                          {row.product.variety && (
                            <p className="text-xs text-slate-500 mt-1 ml-6">
                              {row.product.variety}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right hidden sm:block">
                            <p className="text-xs text-slate-400">Net Stock</p>
                            <p
                              className={`text-sm font-semibold ${
                                netStock === null
                                  ? 'text-slate-400'
                                  : netStock <= 0
                                  ? 'text-red-600'
                                  : netStock <= 10
                                  ? 'text-amber-600'
                                  : 'text-slate-900'
                              }`}
                            >
                              {netStock === null ? '—' : netStock}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditProduct(row)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant={row.product.is_active ? 'ghost' : 'primary'}
                            onClick={() => toggleProductActive(row)}
                          >
                            {row.product.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </div>

                      {/* Expanded detail: units + inventory */}
                      {expanded && (
                        <div className="border-t border-slate-100 pt-3 ml-6 space-y-3">
                          {row.units.length > 0 ? (
                            <div>
                              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                                Selling Units
                              </p>
                              <div className="space-y-2">
                                {row.units.map((u) => (
                                  <div
                                    key={u.id}
                                    className="flex items-center gap-3 text-xs rounded-lg bg-slate-50 border border-slate-200 px-3 py-2"
                                  >
                                    <span className="font-medium text-slate-900">
                                      {u.unit_label}
                                    </span>
                                    <span className="text-slate-500">
                                      {u.quantity_per_unit} pcs
                                    </span>
                                    <span className="text-slate-600">
                                      ${u.base_price.toFixed(2)}
                                    </span>
                                    {u.discount_percent > 0 && (
                                      <span className="text-blue-600">
                                        {u.discount_percent}% off → $
                                        {(
                                          u.base_price *
                                          (1 - u.discount_percent / 100)
                                        ).toFixed(2)}
                                      </span>
                                    )}
                                    {!u.is_active && (
                                      <Badge className="bg-slate-100 text-slate-500 border-slate-200">
                                        Inactive
                                      </Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400">
                              No selling units configured.
                            </p>
                          )}

                          {row.inventory && (
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-slate-500">
                                Physical:{' '}
                                <span className="font-medium text-slate-700">
                                  {row.inventory.physical_stock}
                                </span>
                              </span>
                              <span className="text-slate-500">
                                Allocated:{' '}
                                <span className="font-medium text-slate-700">
                                  {row.inventory.allocated_stock}
                                </span>
                              </span>
                              <span className="text-slate-500">
                                Reserved:{' '}
                                <span className="font-medium text-slate-700">
                                  {row.inventory.reserved_stock}
                                </span>
                              </span>
                              <span className="text-slate-500">
                                Net Available:{' '}
                                <span
                                  className={`font-semibold ${
                                    row.inventory.net_available_stock <= 0
                                      ? 'text-red-600'
                                      : row.inventory.net_available_stock <= 10
                                      ? 'text-amber-600'
                                      : 'text-slate-900'
                                  }`}
                                >
                                  {row.inventory.net_available_stock}
                                </span>
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
