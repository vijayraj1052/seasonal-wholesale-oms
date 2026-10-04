/*
# Order Item Price Snapshots for Two-Level Discount Billing

## Purpose
Adds two nullable columns to `order_items` so the full bill breakdown
(MRP/base price, product-level discount %, product-level discount amount,
product net line total) can be displayed from saved snapshots without
recalculating from current catalogue prices.

Also updates the `submit_order` RPC to populate these new columns for
all new orders. The existing `orders.discount_percent` column is reused
as the admin-adjustable order-level discount (already defaults to 0,
already saved alongside the order).

## Changes
1. `order_items.base_price` (numeric(12,2), nullable) — the original
   MRP/base price of the selling unit at submission time, before any
   product-level discount.
2. `order_items.product_discount_percent` (numeric(5,2), nullable) —
   the product-level discount percentage that was applied to this unit
   at submission time.
3. `submit_order` RPC updated to save both new columns.
   - `base_price` := `v_unit.base_price` (the raw catalogue base price)
   - `product_discount_percent` := `v_unit.discount_percent`
   - `unit_price` remains the effective price (base × (1 - discount/100))
   - `product_subtotal` remains effective_price × qty

## Backward Compatibility
- Both new columns are nullable. Existing order_items rows will have
  NULL for both. The UI falls back to `unit_price` as the base price
  and 0% discount when these are NULL, so existing confirmed orders
  continue to display correctly with the same line totals as before.
- The `orders.discount_percent` column already exists with default 0
  and is already saved with each order. For existing orders it stays 0,
  meaning no order-level discount — the bill shows the same total.
- No changes to confirm_order RPC, inventory allocation, RLS policies,
  authentication, or payment workflow.

## Security
- No new tables, no RLS policy changes.
- submit_order remains SECURITY DEFINER with search_path = public.
- No grants or revokes changed.
*/

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS base_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS product_discount_percent numeric(5,2);

CREATE OR REPLACE FUNCTION public.submit_order(p_items jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid := auth.uid();
  v_profile       public.customer_profiles;
  v_order_id      uuid;
  v_order_number  text;
  v_item          jsonb;
  v_unit_id       uuid;
  v_qty           int;
  v_unit          public.product_units;
  v_product       public.products;
  v_brand_name    text;
  v_eff_price     numeric(12,2);
  v_subtotal      numeric(12,2);
BEGIN
  -- 1. Authentication check
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to submit an order.';
  END IF;

  -- 2. Load the caller's customer profile (server-side, not client-supplied)
  SELECT * INTO v_profile
  FROM public.customer_profiles
  WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer profile not found. Please complete your profile before placing an order.';
  END IF;

  IF NOT v_profile.is_active THEN
    RAISE EXCEPTION 'Your account is currently inactive. Please contact support.';
  END IF;

  -- 3. Validate the items payload
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Your cart is empty. Add at least one product before submitting an order.';
  END IF;

  -- 4. Create the order row (status is always PENDING_REVIEW, customer_id is always auth.uid())
  v_order_number := public.generate_order_number();

  INSERT INTO public.orders (
    order_number, customer_id, status,
    customer_name, customer_mobile, customer_shop,
    customer_stall_number, customer_stall_location, customer_licence,
    discount_percent
  )
  VALUES (
    v_order_number, v_user_id, 'PENDING_REVIEW',
    v_profile.full_name, v_profile.mobile_number, v_profile.shop_name,
    v_profile.stall_number, v_profile.stall_location, v_profile.licence_number,
    0
  )
  RETURNING id INTO v_order_id;

  -- 5. Process each cart item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_unit_id := v_item ->> 'unit_id';
    v_qty := (v_item ->> 'requested_quantity')::int;

    -- Validate quantity
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'One or more items has an invalid quantity. Please review your cart.';
    END IF;

    -- Load the unit, verify it exists and is active
    SELECT * INTO v_unit
    FROM public.product_units
    WHERE id = v_unit_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A selected selling unit is no longer available. Please refresh your catalogue and try again.';
    END IF;

    IF NOT v_unit.is_active THEN
      RAISE EXCEPTION 'A selected selling unit (%s) is no longer active. Please review your cart.', v_unit.unit_label;
    END IF;

    -- Load the product, verify it exists, is active, and ordering is enabled
    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_unit.product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A product in your cart is no longer available. Please refresh your catalogue.';
    END IF;

    IF NOT v_product.is_active THEN
      RAISE EXCEPTION 'The product "%s" is no longer active.', v_product.name;
    END IF;

    IF NOT v_product.ordering_enabled THEN
      RAISE EXCEPTION 'Ordering is currently disabled for "%s".', v_product.name;
    END IF;

    -- Resolve brand name for the snapshot
    SELECT b.name INTO v_brand_name
    FROM public.brands b
    WHERE b.id = v_product.brand_id;

    IF v_brand_name IS NULL THEN
      v_brand_name := '';
    END IF;

    -- Calculate effective price (base - discount) as the price snapshot
    v_eff_price := ROUND(v_unit.base_price * (1 - v_unit.discount_percent / 100.0), 2);
    v_subtotal := ROUND(v_eff_price * v_qty, 2);

    -- 6. Insert the order_item with full snapshots
    INSERT INTO public.order_items (
      order_id, product_id, unit_name,
      requested_quantity, unit_price, product_subtotal,
      product_name_snapshot, brand_name_snapshot, variety_snapshot,
      base_price, product_discount_percent
    )
    VALUES (
      v_order_id, v_product.id, v_unit.unit_label,
      v_qty, v_eff_price, v_subtotal,
      v_product.name, v_brand_name, v_product.variety,
      v_unit.base_price, v_unit.discount_percent
    );
  END LOOP;

  -- 7. Return the order identity (NO inventory changes, NO transactions, NO notifications)
  RETURN json_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number
  );
END;
$$;

-- Re-grant (CREATE OR REPLACE drops existing grants)
REVOKE ALL ON FUNCTION public.submit_order(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_order(jsonb) TO authenticated;
