/*
# Catalogue, Packaging, Pricing, and Inventory Foundation

## Purpose
Creates the product catalogue structure (brands, products, packaging
configurations, prices), the inventory tracking system, and the inventory
transaction history. No real brands, products, or prices are seeded — all
data is entered later through the Admin panel.

## New Tables

1. `brands`
   - `id` (uuid PK)
   - `name` (text, unique, required)
   - `is_active` (boolean, default true)
   - `sort_order` (int, default 0)
   - `created_at` (timestamptz)

2. `products`
   - `id` (uuid PK)
   - `brand_id` (uuid FK → brands, ON DELETE RESTRICT)
   - `name` (text, required) — product name
   - `variety` (text, nullable) — variety/size descriptor
   - `serial_number` (int, nullable) — display ordering / S.No
   - `description` (text, nullable)
   - `ordering_enabled` (boolean, default true) — admin manual toggle
   - `is_active` (boolean, default true) — soft delete
   - `created_at` / `updated_at`

3. `product_packaging`
   - Defines packaging units per product (Pack, Bundle, Carton, Box, etc.)
   - `id` (uuid PK)
   - `product_id` (uuid FK → products, ON DELETE CASCADE)
   - `unit_name` (text, required) — e.g. "Pack", "Bundle", "Carton"
   - `unit_level` (int, required) — 1 = smallest, 2 = next, etc.
   - `pieces_per_unit` (int, required) — how many pieces of the level-1 unit
     this unit contains (cumulative). E.g. if Pack=12 pieces, Bundle=6 packs,
     then bundle pieces_per_unit = 72.
   - `is_orderable` (boolean, default true) — whether customers can order in this unit
   - UNIQUE(product_id, unit_name)

4. `product_prices`
   - Price overrides per product per packaging unit. Admin manually sets these.
   - `id` (uuid PK)
   - `product_id` (uuid FK → products, ON DELETE CASCADE)
   - `unit_name` (text, required) — matches a product_packaging.unit_name or "piece"
   - `price` (numeric(12,2), required) — unit price
   - `effective_from` (timestamptz, default now())
   - `created_at` (timestamptz)
   - UNIQUE(product_id, unit_name) — one current price per product per unit

5. `inventory`
   - One row per product tracking stock levels.
   - `product_id` (uuid PK FK → products, ON DELETE CASCADE)
   - `physical_stock` (int, default 0) — total stock on hand
   - `allocated_stock` (int, default 0) — confirmed to orders, not yet released
   - `available_stock` is a GENERATED COLUMN: physical_stock - allocated_stock
   - `last_updated` (timestamptz)

6. `inventory_transactions`
   - Append-only history of every stock change.
   - `id` (uuid PK)
   - `product_id` (uuid FK → products, ON DELETE RESTRICT)
   - `transaction_type` (text) — STOCK_ADJUST, ALLOCATE, RELEASE, RELEASE_COMPLETED
   - `quantity_change` (int) — positive/negative delta on allocated or physical
   - `balance_after` (jsonb) — snapshot {physical, allocated, available}
   - `reference_type` (text, nullable) — 'order', 'manual_adjustment'
   - `reference_id` (uuid, nullable) — order_id or null
   - `note` (text, nullable)
   - `created_by` (uuid, nullable) — auth user who triggered it
   - `created_at` (timestamptz, default now())

## Security (RLS)
- All catalogue tables are admin-write, customer-read.
  - Customers (authenticated) can SELECT products, brands, packaging, prices,
    and inventory available_stock/ordering status.
  - Only admins can INSERT/UPDATE/DELETE.
- Admin authorization is enforced via the `public.is_admin()` SECURITY DEFINER
  function, so RLS checks the database-level admin status, not client claims.
- `inventory_transactions`: admin SELECT/INSERT; customers cannot read
  transaction history directly (admin-only operational data).

## Important Notes
1. `available_stock` is a GENERATED ALWAYS column — it cannot be written
   directly; it always reflects physical - allocated. This enforces the
   inventory invariant at the database level.
2. No seed data — all brands/products/prices/stock entered via Admin panel.
3. Out-of-stock logic (available_stock = 0 → not orderable) will be enforced
   in the order submission layer and edge functions, not via a DB column,
   to keep the auto/manual distinction clean.
*/

-- ============================================================
-- 1. brands
-- ============================================================
CREATE TABLE IF NOT EXISTS public.brands (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  is_active  boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_brands" ON public.brands;
CREATE POLICY "select_brands"
  ON public.brands FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_brands_admin" ON public.brands;
CREATE POLICY "insert_brands_admin"
  ON public.brands FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "update_brands_admin" ON public.brands;
CREATE POLICY "update_brands_admin"
  ON public.brands FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "delete_brands_admin" ON public.brands;
CREATE POLICY "delete_brands_admin"
  ON public.brands FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================
-- 2. products
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         uuid NOT NULL REFERENCES public.brands(id) ON DELETE RESTRICT,
  name             text NOT NULL,
  variety          text,
  serial_number    int,
  description      text,
  ordering_enabled boolean NOT NULL DEFAULT true,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_products" ON public.products;
CREATE POLICY "select_products"
  ON public.products FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_products_admin" ON public.products;
CREATE POLICY "insert_products_admin"
  ON public.products FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "update_products_admin" ON public.products;
CREATE POLICY "update_products_admin"
  ON public.products FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "delete_products_admin" ON public.products;
CREATE POLICY "delete_products_admin"
  ON public.products FOR DELETE
  TO authenticated USING (public.is_admin());

DROP TRIGGER IF EXISTS products_set_updated_at ON public.products;
CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_products_brand_id ON public.products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);

-- ============================================================
-- 3. product_packaging
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_packaging (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_name       text NOT NULL,
  unit_level      int NOT NULL,
  pieces_per_unit int NOT NULL CHECK (pieces_per_unit > 0),
  is_orderable    boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, unit_name)
);

ALTER TABLE public.product_packaging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_product_packaging" ON public.product_packaging;
CREATE POLICY "select_product_packaging"
  ON public.product_packaging FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_product_packaging_admin" ON public.product_packaging;
CREATE POLICY "insert_product_packaging_admin"
  ON public.product_packaging FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "update_product_packaging_admin" ON public.product_packaging;
CREATE POLICY "update_product_packaging_admin"
  ON public.product_packaging FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "delete_product_packaging_admin" ON public.product_packaging;
CREATE POLICY "delete_product_packaging_admin"
  ON public.product_packaging FOR DELETE
  TO authenticated USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_packaging_product_id ON public.product_packaging(product_id);

-- ============================================================
-- 4. product_prices
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_prices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_name      text NOT NULL,
  price          numeric(12,2) NOT NULL CHECK (price >= 0),
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, unit_name)
);

ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_product_prices" ON public.product_prices;
CREATE POLICY "select_product_prices"
  ON public.product_prices FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_product_prices_admin" ON public.product_prices;
CREATE POLICY "insert_product_prices_admin"
  ON public.product_prices FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "update_product_prices_admin" ON public.product_prices;
CREATE POLICY "update_product_prices_admin"
  ON public.product_prices FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "delete_product_prices_admin" ON public.product_prices;
CREATE POLICY "delete_product_prices_admin"
  ON public.product_prices FOR DELETE
  TO authenticated USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_prices_product_id ON public.product_prices(product_id);

-- ============================================================
-- 5. inventory
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory (
  product_id      uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  physical_stock  int NOT NULL DEFAULT 0 CHECK (physical_stock >= 0),
  allocated_stock int NOT NULL DEFAULT 0 CHECK (allocated_stock >= 0),
  available_stock int GENERATED ALWAYS AS (physical_stock - allocated_stock) STORED,
  last_updated    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Customers can see inventory status (available stock + ordering) for the catalogue
DROP POLICY IF EXISTS "select_inventory" ON public.inventory;
CREATE POLICY "select_inventory"
  ON public.inventory FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_inventory_admin" ON public.inventory;
CREATE POLICY "insert_inventory_admin"
  ON public.inventory FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "update_inventory_admin" ON public.inventory;
CREATE POLICY "update_inventory_admin"
  ON public.inventory FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 6. inventory_transactions (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  transaction_type text NOT NULL CHECK (transaction_type IN ('STOCK_ADJUST','ALLOCATE','RELEASE','RELEASE_COMPLETED')),
  quantity_change  int NOT NULL,
  balance_after    jsonb NOT NULL,
  reference_type   text,
  reference_id     uuid,
  note             text,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Admin-only: operational history
DROP POLICY IF EXISTS "select_inventory_transactions_admin" ON public.inventory_transactions;
CREATE POLICY "select_inventory_transactions_admin"
  ON public.inventory_transactions FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "insert_inventory_transactions_admin" ON public.inventory_transactions;
CREATE POLICY "insert_inventory_transactions_admin"
  ON public.inventory_transactions FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_invtxn_product_id ON public.inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_invtxn_created_at ON public.inventory_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_invtxn_reference ON public.inventory_transactions(reference_id);
