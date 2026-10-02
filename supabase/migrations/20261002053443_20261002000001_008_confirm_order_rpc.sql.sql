/*
# Confirm Order RPC

## Purpose
Creates a SECURITY DEFINER function `confirm_order` that allows an
administrator to atomically confirm a PENDING_REVIEW order. Confirmation:
  - Validates the order is in PENDING_REVIEW status (idempotency guard).
  - Validates every order item has a non-null, non-negative confirmed_quantity.
  - Aggregates confirmed quantities by product_id (multiple selling units
    of the same product are summed).
  - Locks inventory rows and rechecks available stock inside the transaction.
  - Atomically allocates stock (increments allocated_stock), inserts ALLOCATE
    inventory_transactions linked to the order, and transitions the order
    status to CONFIRMED with confirmed_at = now().

## Security
- SECURITY DEFINER with search_path = public.
- Verifies caller is an admin via public.is_admin() inside the function body.
- Revoked from PUBLIC and anon; granted to authenticated only.
- Does NOT weaken or remove any existing RLS policies.
- Does NOT expose privileged functionality to customers.

## Inventory Safety
- Uses SELECT ... FOR UPDATE to lock inventory rows before checking stock,
  preventing concurrent confirmations from over-allocating.
- Rechecks available_stock (physical_stock - allocated_stock) after locking.
- If any product has insufficient stock, raises an error and the entire
  transaction rolls back — no inventory or order changes are committed.
- Inserts one ALLOCATE inventory_transaction per product with balance_after
  snapshot, reference_type='order', reference_id=order_id.

## Parameters
- p_order_id uuid — the order to confirm.

## Return Value
- json: { order_id, order_number, status }

## Important Notes
1. Customer order submission and admin quantity review are NOT affected.
2. No new tables or columns are created.
3. The function uses the existing confirmed_quantity column on order_items.
4. Items with confirmed_quantity = 0 are skipped (no stock allocated for them).
*/

CREATE OR REPLACE FUNCTION public.confirm_order(p_order_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin     boolean;
  v_order        public.orders;
  v_item         public.order_items;
  v_product_id   uuid;
  v_total_qty    int;
  v_inv          public.inventory;
  v_new_alloc    int;
  v_product_name text;
  v_short_products text[] := ARRAY[]::text[];
BEGIN
  -- 1. Authorization: only admins may confirm orders
  SELECT public.is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only administrators can confirm orders.';
  END IF;

  -- 2. Load and lock the order row
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  -- 3. Idempotency: only PENDING_REVIEW orders can be confirmed
  IF v_order.status <> 'PENDING_REVIEW' THEN
    RAISE EXCEPTION 'This order is not pending review (current status: %). Only pending-review orders can be confirmed.', v_order.status;
  END IF;

  -- 4. Validate that every item has a non-null, non-negative confirmed_quantity
  FOR v_item IN
    SELECT * FROM public.order_items
    WHERE order_id = p_order_id
    ORDER BY created_at
  LOOP
    IF v_item.confirmed_quantity IS NULL THEN
      RAISE EXCEPTION 'One or more items has no confirmed quantity. Please review and save confirmed quantities before confirming the order.';
    END IF;
    IF v_item.confirmed_quantity < 0 THEN
      RAISE EXCEPTION 'Confirmed quantities must be non-negative. Please correct item "%" before confirming.', v_item.product_name_snapshot;
    END IF;
  END LOOP;

  -- 5. Aggregate confirmed quantities by product_id and allocate stock
  --    We iterate over the aggregated cursor, locking each inventory row.
  FOR v_product_id, v_total_qty IN
    SELECT oi.product_id, COALESCE(SUM(oi.confirmed_quantity), 0) AS total_qty
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
      AND oi.confirmed_quantity > 0
    GROUP BY oi.product_id
  LOOP
    -- Lock the inventory row for this product
    SELECT * INTO v_inv
    FROM public.inventory
    WHERE product_id = v_product_id
    FOR UPDATE;

    -- If no inventory row exists, there is zero stock available
    IF NOT FOUND THEN
      SELECT p.name INTO v_product_name
      FROM public.products p
      WHERE p.id = v_product_id;
      RAISE EXCEPTION 'Insufficient stock for "%": no inventory record exists. Please add stock before confirming.', COALESCE(v_product_name, 'Unknown product');
    END IF;

    -- Recheck available stock inside the locked transaction
    IF (v_inv.physical_stock - v_inv.allocated_stock) < v_total_qty THEN
      SELECT p.name INTO v_product_name
      FROM public.products p
      WHERE p.id = v_product_id;
      v_short_products := array_append(v_short_products,
        COALESCE(v_product_name, 'Unknown') ||
        ' (need ' || v_total_qty || ', available ' ||
        (v_inv.physical_stock - v_inv.allocated_stock) || ')');
    ELSE
      -- Allocate: increment allocated_stock
      v_new_alloc := v_inv.allocated_stock + v_total_qty;

      UPDATE public.inventory
      SET allocated_stock = v_new_alloc,
          last_updated = now()
      WHERE product_id = v_product_id;

      -- Insert ALLOCATE inventory transaction
      INSERT INTO public.inventory_transactions (
        product_id, transaction_type, quantity_change,
        balance_after, reference_type, reference_id,
        note, created_by
      )
      VALUES (
        v_product_id, 'ALLOCATE', v_total_qty,
        jsonb_build_object(
          'physical', v_inv.physical_stock,
          'allocated', v_new_alloc,
          'available', v_inv.physical_stock - v_new_alloc
        ),
        'order', p_order_id,
        'Order confirmation: ' || v_order.order_number,
        auth.uid()
      );
    END IF;
  END LOOP;

  -- 6. If any products had insufficient stock, abort with details
  IF array_length(v_short_products, 1) > 0 THEN
    RAISE EXCEPTION 'Insufficient stock for the following products. Order and inventory were not changed: %',
      array_to_string(v_short_products, '; ');
  END IF;

  -- 7. Transition order to CONFIRMED
  UPDATE public.orders
  SET status = 'CONFIRMED',
      confirmed_at = now()
  WHERE id = p_order_id;

  -- 8. Return success
  RETURN json_build_object(
    'order_id', p_order_id,
    'order_number', v_order.order_number,
    'status', 'CONFIRMED'
  );
END;
$$;

-- Grant execute to authenticated users only (admin check is inside the function)
REVOKE ALL ON FUNCTION public.confirm_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_order(uuid) TO authenticated;
