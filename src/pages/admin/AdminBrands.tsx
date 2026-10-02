import { useEffect, useState, useCallback } from 'react';
import { Tag, Plus, Pencil, Check, X, AlertCircle, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import type { Brand } from '@/types/database';

interface BrandFormState {
  name: string;
  sort_order: number;
}

const emptyForm: BrandFormState = { name: '', sort_order: 0 };

export function AdminBrands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BrandFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('brands')
      .select('*')
      .order('sort_order', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setBrands((data ?? []) as Brand[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (brand: Brand) => {
    setEditingId(brand.id);
    setForm({ name: brand.name, sort_order: brand.sort_order });
    setFormError(null);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setFormError('Brand name is required.');
      return;
    }

    setSaving(true);
    setFormError(null);

    if (editingId) {
      const { error: updateError } = await supabase
        .from('brands')
        .update({ name: trimmedName, sort_order: form.sort_order })
        .eq('id', editingId);

      if (updateError) {
        setFormError(updateError.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from('brands')
        .insert({ name: trimmedName, sort_order: form.sort_order });

      if (insertError) {
        setFormError(insertError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    cancelForm();
    await load();
  };

  const toggleActive = async (brand: Brand) => {
    const { error: toggleError } = await supabase
      .from('brands')
      .update({ is_active: !brand.is_active })
      .eq('id', brand.id);

    if (toggleError) {
      setError(toggleError.message);
      return;
    }
    await load();
  };

  const handleDelete = async (brand: Brand) => {
    setDeleteError(null);
    const proceed = confirm(
      `Delete brand "${brand.name}"? This permanently removes the brand.`
    );
    if (!proceed) return;

    setDeletingId(brand.id);

    const { count: productCount } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brand.id);

    if ((productCount ?? 0) > 0) {
      setDeleteError(
        `"${brand.name}" cannot be deleted because it is linked to ${productCount} product(s). Deactivate it instead to hide it from the product form while preserving existing products.`
      );
      setDeletingId(null);
      return;
    }

    const { error: deleteErr } = await supabase
      .from('brands')
      .delete()
      .eq('id', brand.id);

    if (deleteErr) {
      setDeleteError(deleteErr.message);
      setDeletingId(null);
      return;
    }

    setDeletingId(null);
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && brands.length === 0) {
    return (
      <EmptyState
        icon={<Tag className="h-7 w-7" />}
        title="Couldn't load brands"
        description={error}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Brands</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage the brands available in your catalogue.
          </p>
        </div>
        {!showForm && (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Brand
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              {editingId ? 'Edit Brand' : 'Add Brand'}
            </h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  label="Brand Name"
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. Standard Fireworks"
                  error={formError ?? undefined}
                />
              </div>
              <div className="w-full sm:w-32">
                <Input
                  label="Sort Order"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      sort_order: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" loading={saving}>
                <Check className="h-4 w-4" />
                {editingId ? 'Save Changes' : 'Add Brand'}
              </Button>
              <Button variant="outline" onClick={cancelForm}>
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {deleteError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{deleteError}</span>
          <button
            onClick={() => setDeleteError(null)}
            className="ml-auto shrink-0 text-red-400 hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {brands.length === 0 && !showForm ? (
        <EmptyState
          icon={<Tag className="h-7 w-7" />}
          title="No brands yet"
          description="Add your first brand to start building the product catalogue."
          action={
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" />
              Add Your First Brand
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Brand Name
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 hidden sm:table-cell">
                    Sort Order
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700 hidden sm:table-cell">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {brands.map((brand) => (
                  <tr key={brand.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {brand.name}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 hidden sm:table-cell">
                      {brand.sort_order}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {brand.is_active ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                          Inactive
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500 hidden sm:table-cell">
                      {new Date(brand.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(brand)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={brand.is_active ? 'ghost' : 'primary'}
                          onClick={() => toggleActive(brand)}
                        >
                          {brand.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={deletingId === brand.id}
                          onClick={() => handleDelete(brand)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
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
