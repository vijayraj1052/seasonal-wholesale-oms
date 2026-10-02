import { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Minus,
  Plus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { CartItem } from '@/types/database';
import { formatINR } from '@/lib/format';

interface SubmitItemPayload {
  unit_id: string;
  requested_quantity: number;
}

export function CustomerCheckout() {
  const navigate = useNavigate();
  const { items, removeItem, updateQuantity, clearCart, totalItems } =
    useCart();
  const { profile } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<{
    order_number: string;
  } | null>(null);

  const effectivePrice = (item: CartItem) => {
    const discount = item.base_price * (item.discount_percent / 100);
    return item.base_price - discount;
  };

  const lineTotal = (item: CartItem) =>
    effectivePrice(item) * item.requested_quantity;

  const orderTotal = useMemo(
    () => items.reduce((sum, item) => sum + lineTotal(item), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items]
  );

  const handleQtyChange = (
    productId: string,
    unitId: string,
    delta: number
  ) => {
    const item = items.find(
      (i) => i.product_id === productId && i.unit_id === unitId
    );
    if (!item) return;
    const next = item.requested_quantity + delta;
    if (next <= 0) {
      removeItem(productId, unitId);
    } else {
      updateQuantity(productId, unitId, next);
    }
  };

  const handleSubmit = async () => {
    setError(null);

    if (items.length === 0) {
      setError('Your cart is empty. Add products from the catalogue first.');
      return;
    }

    const payload: SubmitItemPayload[] = items.map((item) => ({
      unit_id: item.unit_id,
      requested_quantity: item.requested_quantity,
    }));

    setSubmitting(true);

    try {
      const { data, error: rpcError } = await supabase.rpc('submit_order', {
        p_items: payload,
      });

      if (rpcError) {
        setError(rpcError.message);
        setSubmitting(false);
        return;
      }

      if (!data || !data.order_number) {
        setError(
          'Something went wrong while submitting your order. Please try again.'
        );
        setSubmitting(false);
        return;
      }

      // Only clear the cart AFTER the RPC succeeds
      clearCart();
      setSubmittedOrder({ order_number: data.order_number });
      setSubmitting(false);
    } catch {
      setError(
        'An unexpected error occurred. Please check your connection and try again.'
      );
      setSubmitting(false);
    }
  };

  // ===== Success view =====
  if (submittedOrder) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center py-10">
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 mb-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Order Request Submitted
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-sm">
            Your order request{' '}
            <span className="font-semibold text-slate-900">
              {submittedOrder.order_number}
            </span>{' '}
            has been submitted for review. An administrator will confirm your
            quantities and pricing before it moves to the next stage.
          </p>
        </div>

        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
              <span className="text-sm text-amber-800 font-medium">
                Status: Pending Review
              </span>
              <span className="text-xs text-amber-600">
                No stock has been reserved yet.
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => navigate('/app/orders')}
              >
                View My Orders
              </Button>
              <Button onClick={() => navigate('/app/catalogue')}>
                Continue Browsing
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  // ===== Empty cart view =====
  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/app/catalogue')}
            className="p-2 -ml-2 text-slate-400 hover:text-slate-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold text-slate-900">Checkout</h1>
        </div>
        <EmptyState
          icon={<ShoppingCart className="h-7 w-7" />}
          title="Your cart is empty"
          description="Browse the catalogue and add products to your cart before checking out."
          action={
            <Button onClick={() => navigate('/app/catalogue')}>
              Go to Catalogue
            </Button>
          }
        />
      </div>
    );
  }

  // ===== Checkout review view =====
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/app/catalogue')}
          className="p-2 -ml-2 text-slate-400 hover:text-slate-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Checkout</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Review your order request before submitting. No stock is reserved
            until an admin confirms it.
          </p>
        </div>
      </div>

      {/* Customer info summary */}
      {profile && (
        <Card>
          <CardBody className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-sm">
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Delivering To
              </p>
              <p className="font-medium text-slate-900">{profile.full_name}</p>
              <p className="text-slate-500">{profile.shop_name}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Stall {profile.stall_number} · {profile.stall_location}
                {profile.mobile_number ? ` · ${profile.mobile_number}` : ''}
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Cart items */}
      <div className="space-y-3">
        {items.map((item) => {
          const effPrice = effectivePrice(item);
          const total = lineTotal(item);
          return (
            <Card key={`${item.product_id}-${item.unit_id}`}>
              <CardBody className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">
                      {item.product_name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {item.brand_name}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Unit: {item.unit_label} · {item.quantity_per_unit} pcs/unit
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className="text-slate-400">
                      Base: {formatINR(item.base_price)}
                    </span>
                    {item.discount_percent > 0 && (
                      <span className="text-blue-600">
                        {item.discount_percent}% off
                      </span>
                    )}
                    <span className="font-medium text-slate-700">
                      Effective: {formatINR(effPrice)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center rounded-lg border border-slate-300 overflow-hidden">
                    <button
                      onClick={() =>
                        handleQtyChange(item.product_id, item.unit_id, -1)
                      }
                      className="px-2 py-1.5 text-slate-600 hover:bg-slate-50"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-10 text-center text-sm font-medium text-slate-900 border-x border-slate-300 py-1.5">
                      {item.requested_quantity}
                    </span>
                    <button
                      onClick={() =>
                        handleQtyChange(item.product_id, item.unit_id, 1)
                      }
                      className="px-2 py-1.5 text-slate-600 hover:bg-slate-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatINR(total)}
                  </span>
                  <button
                    onClick={() =>
                      removeItem(item.product_id, item.unit_id)
                    }
                    className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove
                  </button>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Order summary + submit */}
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Items</span>
            <span className="font-medium text-slate-900">{totalItems}</span>
          </div>
          <div className="flex items-center justify-between text-base border-t border-slate-100 pt-3">
            <span className="font-semibold text-slate-900">Order Total</span>
            <span className="font-bold text-slate-900">
              {formatINR(orderTotal)}
            </span>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">
              This is an <span className="font-medium">order request</span>.
              Prices shown are the current catalogue prices and will be
              confirmed by an administrator. Stock is not reserved until
              confirmation.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleSubmit}
              disabled={submitting || items.length === 0}
              className="flex-1"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Submit Order Request
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/app/catalogue')}
              disabled={submitting}
            >
              Back to Catalogue
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
