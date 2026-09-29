/*
# Orders, Notifications, Settings, and Audit Log Foundation

## Purpose
Creates the order request workflow (orders + order items with price snapshots
and customer info snapshots), the persistent in-app notification system, the
application settings table (payment deadline, default discount), and a generic
audit log for traceability.

## New Tables

1. `orders`
   - `id` (uuid PK)
   - `order_number` (text, unique) — human-readable, auto-generated (ORD-000001)
   - `customer_id` (uuid FK → auth.users, ON DELETE CASCADE)
   - `status` (text, default 'PENDING_REVIEW') — one of:
     PENDING_REVIEW, CONFIRMED, PAYMENT_PENDING, PAID,
     READY_FOR_RELEASE, COMPLETED, CANCELLED
   - Customer snapshot (preserved at submission time):
     customer_name, customer_mobile, customer_shop,
     customer_stall_number, customer_stall_location, customer_licence
   - `discount_percent` (numeric, default 0) — order-specific discount override
   - `payment_due_date` (date, nullable) — set when confirmed
   - `payment_marked_at` (timestamptz, nullable)
   - `confirmed_at` (timestamptz, nullable)
   - `cancelled_at` (timestamptz, nullable)
   - `notes` (text, nullable)
   - `created_at` / `updated_at`

2. `order_items`
   - `id` (uuid PK)
   - `order_id` (uuid FK → orders, ON DELETE CASCADE)
   - `product_id` (uuid FK → products, ON DELETE RESTRICT)
   - `unit_name` (text) — e.g. "Pack", "Carton"
   - `requested_quantity` (int) — customer's original request
   - `confirmed_quantity` (int, nullable) — admin-approved quantity
   - `unit_price` (numeric) — price snapshot at confirmation time
   - `product_subtotal` (numeric) — confirmed_quantity * unit_price
   - `product_name_snapshot` (text)
   - `brand_name_snapshot` (text)
   - `variety_snapshot` (text, nullable)

3. `notifications`
   - `id` (uuid PK)
   - `user_id` (uuid FK → auth.users, ON DELETE CASCADE)
   - `type` (text), `title` (text), `message` (text)
   - `order_id` (uuid, nullable)
   - `is_read` (boolean, default false)
   - `created_at` (timestamptz)

4. `app_settings` (single-row, CHECK id = 1)
   - `payment_deadline_days` (int, default 5)
   - `default_discount_percent` (numeric, default 0)
   - `updated_at`, `updated_by`

5. `audit_log` (append-only)
   - `entity_type`, `entity_id`, `action`, `change_summary`
   - `old_values` (jsonb), `new_values` (jsonb)
   - `actor_id`, `created_at`

## Functions
- `public.generate_order_number()` — returns next sequential ORD-000001 number.

## Security (RLS)
- `orders`: customers SELECT/INSERT only own; admin SELECT/UPDATE all.
- `order_items`: customers SELECT own (via join); INSERT own when PENDING_REVIEW;
  admin SELECT/UPDATE/DELETE all.
- `notifications`: each user SELECT/UPDATE own; admin INSERT (to notify users).
- `app_settings`: admin-only all operations.
- `audit_log`: admin-only SELECT and INSERT. No UPDATE/DELETE (append-only).

## Important Notes
1. Price snapshots in order_items ensure historical orders never change.
2. Customer info snapshots on orders preserve details at submission time.
3. Order status transitions + inventory allocation logic → Phase 2 (edge functions/RPC).
4. No seed data; app_settings row created by frontend on first load.
*/

-- ============================================================
-- 1. Helper: generate order number
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_serial int;
  next_serial int;
BEGIN
  SELECT COALESCE(max(serial_num), 0) INTO max_serial
  FROM (
    SELECT substring(order_number FROM '[0-9]+$')::int AS serial_num
    FROM public.orders
    WHERE order_number ~ '^ORD-[0-9]+$'
  ) sub;
  next_serial := max_serial + 1;
  RETURN 'ORD-' || lpad(next_serial::text, 6, '0');
END;
$$;

-- ============================================================
-- 2. orders
-- ============================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number            text NOT NULL UNIQUE DEFAULT public.generate_order_number(),
  customer_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status                  text NOT NULL DEFAULT 'PENDING_REVIEW'
    CHECK (status IN ('PENDING_REVIEW','CONFIRMED','PAYMENT_PENDING','PAID','READY_FOR_RELEASE','COMPLETED','CANCELLED')),
  customer_name           text NOT NULL,
  customer_mobile         text NOT NULL,
  customer_shop           text NOT NULL,
  customer_stall_number   text NOT NULL,
  customer_stall_location text NOT NULL,
  customer_licence        text,
  discount_percent        numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  payment_due_date        date,
  payment_marked_at       timestamptz,
  confirmed_at            timestamptz,
  cancelled_at            timestamptz,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_orders" ON public.orders;
CREATE POLICY "select_own_orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "insert_own_orders" ON public.orders;
CREATE POLICY "insert_own_orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "select_all_orders_admin" ON public.orders;
CREATE POLICY "select_all_orders_admin"
  ON public.orders FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "update_orders_admin" ON public.orders;
CREATE POLICY "update_orders_admin"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS orders_set_updated_at ON public.orders;
CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);

-- ============================================================
-- 3. order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_items (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id               uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id             uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  unit_name              text NOT NULL,
  requested_quantity     int NOT NULL CHECK (requested_quantity > 0),
  confirmed_quantity     int,
  unit_price             numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  product_subtotal       numeric(12,2) NOT NULL DEFAULT 0,
  product_name_snapshot  text NOT NULL,
  brand_name_snapshot    text NOT NULL DEFAULT '',
  variety_snapshot       text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_order_items" ON public.order_items;
CREATE POLICY "select_own_order_items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_order_items" ON public.order_items;
CREATE POLICY "insert_own_order_items"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.customer_id = auth.uid()
        AND o.status = 'PENDING_REVIEW'
    )
  );

DROP POLICY IF EXISTS "select_all_order_items_admin" ON public.order_items;
CREATE POLICY "select_all_order_items_admin"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "update_order_items_admin" ON public.order_items;
CREATE POLICY "update_order_items_admin"
  ON public.order_items FOR UPDATE
  TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "delete_order_items_admin" ON public.order_items;
CREATE POLICY "delete_order_items_admin"
  ON public.order_items FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);

-- ============================================================
-- 4. notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text NOT NULL,
  title      text NOT NULL,
  message    text NOT NULL,
  order_id   uuid,
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON public.notifications;
CREATE POLICY "select_own_notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON public.notifications;
CREATE POLICY "update_own_notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_notifications_admin" ON public.notifications;
CREATE POLICY "insert_notifications_admin"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read);

-- ============================================================
-- 5. app_settings (single-row)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id                       int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  payment_deadline_days    int NOT NULL DEFAULT 5 CHECK (payment_deadline_days >= 0),
  default_discount_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (default_discount_percent >= 0 AND default_discount_percent <= 100),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by               uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_app_settings_admin" ON public.app_settings;
CREATE POLICY "select_app_settings_admin"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "insert_app_settings_admin" ON public.app_settings;
CREATE POLICY "insert_app_settings_admin"
  ON public.app_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "update_app_settings_admin" ON public.app_settings;
CREATE POLICY "update_app_settings_admin"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 6. audit_log (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type    text NOT NULL,
  entity_id      uuid,
  action         text NOT NULL,
  change_summary text NOT NULL,
  old_values     jsonb,
  new_values     jsonb,
  actor_id       uuid,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_audit_log_admin" ON public.audit_log;
CREATE POLICY "select_audit_log_admin"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "insert_audit_log_admin" ON public.audit_log;
CREATE POLICY "insert_audit_log_admin"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.audit_log(created_at);
