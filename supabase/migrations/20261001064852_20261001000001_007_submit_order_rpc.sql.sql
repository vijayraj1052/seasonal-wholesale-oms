/*
# Submit Order RPC

## Purpose
Creates a SECURITY DEFINER function `submit_order` that allows an
authenticated customer to atomically submit an order request from their
shopping cart. The function creates one row in `orders` (with status
PENDING_REVIEW) and the corresponding `order_items` rows, snapshotting
customer info and product/unit pricing at submission time.

## CRITICAL: No Inventory Changes
This function does NOT modify the `inventory` table in any way — it does
not reserve, allocate, deduct, or adjust stock. Stock allocation will be
handled later during admin order confirmation. The function also does NOT
insert any rows into `inventory_transactions`.

## Security
- SECURITY DEFINER with `search_path = public` to prevent search_path injection.
- Verifies the caller is authenticated via `auth.uid()`.
- Loads the customer's profile from `customer_profiles` (server-side, not
  client-supplied) to snapshot customer info into the order.
- Rejects inactive customer accounts.
- Validates every cart item: product must exist and be active; product_unit
  must exist, be active, and belong to that product; requested_quantity
  must be positive.
- The `customer_id` on the order is always `auth.uid()` — never trusted
  from the client.
- The order status is always `PENDING_REVIEW` — never trusted from the client.
- Does NOT weaken or remove any existing RLS policies.

## Parameters
- `p_items` — JSONB array of objects: { unit_id uuid, requested_quantity int }
  Each item references a product_unit; the product is resolved from the unit.

## Return Value
- A single `json` object: { order_id uuid, order_number text }
- Raises an exception with a user-safe message on any validation failure.
*/

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
      product_name_snapshot, brand_name_snapshot, variety_snapshot
    )
    VALUES (
      v_order_id, v_product.id, v_unit.unit_label,
      v_qty, v_eff_price, v_subtotal,
      v_product.name, v_brand_name, v_product.variety
    );
  END LOOP;

  -- 7. Return the order identity (NO inventory changes, NO transactions, NO notifications)
  RETURN json_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number
  );
END;
$$;

-- Grant execute to authenticated users only (customers)
REVOKE ALL ON FUNCTION public.submit_order(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_order(jsonb) TO authenticated;
