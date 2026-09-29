/*
# Catalogue Enhancement: Categories, Product Fields, Selling Units, Per-Unit Discount, Stock Foundation

## Purpose
Enhances the existing catalogue schema to support the full product catalogue
foundation for the seasonal wholesale firecracker business. Adds product
categories, product code/SKU, image URL, and merges the old
product_packaging + product_prices tables into a unified product_units table
that carries unit quantity, base price, and per-unit wholesale discount
together. Adds reserved_stock to the inventory table.

## New Tables

1. `categories`
   - Product categories (e.g. Sparklers, Flower Pots, Aerial Shots).
   - `id` (uuid PK)
   - `name` (text, unique, required)
   - `description` (text, nullable)
   - `is_active` (boolean, default true)
   - `sort_order` (int, default 0)
   - `created_at` (timestamptz)

2. `product_units`
   - Replaces product_packaging + product_prices with a single unified table.
   - One row per selling unit per product (Piece, Box, Bundle, Carton, etc.)
   - `id` (uuid PK)
   - `product_id` (uuid FK → products, ON DELETE CASCADE)
   - `unit_type` (text) — enum-like: 'PIECE', 'BOX', 'BUNDLE', 'CARTON', 'PACK', 'OTHER'
   - `unit_label` (text) — display label, e.g. "Box of 10"
   - `quantity_per_unit` (int, required) — how many individual pieces this unit contains
   - `base_price` (numeric(12,2), required) — wholesale base price for this unit
   - `discount_percent` (numeric(5,2), default 0) — per-unit wholesale discount
   - `is_active` (boolean, default true) — whether this unit is available for ordering
   - `sort_order` (int, default 0)
   - `created_at` / `updated_at`
   - UNIQUE(product_id, unit_type) — one row per unit type per product

## Modified Tables

1. `products` — adds columns:
   - `category_id` (uuid, nullable, FK → categories)
   - `product_code` (text, nullable) — SKU/product code
   - `image_url` (text, nullable) — optional product image
   Index on category_id.

2. `brands` — adds column:
   - `updated_at` (timestamptz, default now()) + trigger for updated_at

3. `inventory` — adds column:
   - `reserved_stock` (int, default 0, CHECK >= 0) — stock reserved for pending
     order requests (not yet confirmed/allocated). Available stock formula
     becomes: physical_stock - allocated_stock - reserved_stock.
   NOTE: The existing `available_stock` generated column still reflects
   physical - allocated. We add a new generated column `net_available_stock`
   that accounts for reserved as well: physical - allocated - reserved.
   The original `available_stock` column is kept for backward compatibility.

## Functions
- None new. Reuses existing `set_updated_at()` and `is_admin()`.

## Security (RLS)
- `categories`: same pattern as brands — customer read, admin write.
- `product_units`: same pattern as product_packaging/product_prices —
  customer read, admin write.
- All using `public.is_admin()` for authorization checks.

## Important Notes
1. The old `product_packaging` and `product_prices` tables are NOT dropped
   to avoid data loss. They remain but are superseded by `product_units`.
   New code will read from `product_units`.
2. `reserved_stock` is for order requests that have been submitted but not
   yet confirmed. Stock is NOT deducted at request time — this field is
   available for future use. The current `available_stock` still works.
3. No seed data — all entered via Admin panel.
4. Per-unit discount_percent allows different discounts for different
   products/units, as required by the business.
*/

-- ============================================================
-- 1. categories
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_categories" ON public.categories;
CREATE POLICY "select_categories"
  ON public.categories FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_categories_admin" ON public.categories;
CREATE POLICY "insert_categories_admin"
  ON public.categories FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "update_categories_admin" ON public.categories;
CREATE POLICY "update_categories_admin"
  ON public.categories FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "delete_categories_admin" ON public.categories;
CREATE POLICY "delete_categories_admin"
  ON public.categories FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================
-- 2. Add columns to products
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'category_id') THEN
    ALTER TABLE public.products ADD COLUMN category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'product_code') THEN
    ALTER TABLE public.products ADD COLUMN product_code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'image_url') THEN
    ALTER TABLE public.products ADD COLUMN image_url text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_product_code ON public.products(product_code);

-- ============================================================
-- 3. Add updated_at to brands
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brands' AND column_name = 'updated_at') THEN
    ALTER TABLE public.brands ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

DROP TRIGGER IF EXISTS brands_set_updated_at ON public.brands;
CREATE TRIGGER brands_set_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4. product_units (unified packaging + pricing + discount)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_units (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_type        text NOT NULL CHECK (unit_type IN ('PIECE','BOX','BUNDLE','CARTON','PACK','OTHER')),
  unit_label       text NOT NULL,
  quantity_per_unit int NOT NULL CHECK (quantity_per_unit > 0),
  base_price       numeric(12,2) NOT NULL CHECK (base_price >= 0),
  discount_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  is_active        boolean NOT NULL DEFAULT true,
  sort_order       int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, unit_type)
);

ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_product_units" ON public.product_units;
CREATE POLICY "select_product_units"
  ON public.product_units FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_product_units_admin" ON public.product_units;
CREATE POLICY "insert_product_units_admin"
  ON public.product_units FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "update_product_units_admin" ON public.product_units;
CREATE POLICY "update_product_units_admin"
  ON public.product_units FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "delete_product_units_admin" ON public.product_units;
CREATE POLICY "delete_product_units_admin"
  ON public.product_units FOR DELETE
  TO authenticated USING (public.is_admin());

DROP TRIGGER IF EXISTS product_units_set_updated_at ON public.product_units;
CREATE TRIGGER product_units_set_updated_at
  BEFORE UPDATE ON public.product_units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_product_units_product_id ON public.product_units(product_id);
CREATE INDEX IF NOT EXISTS idx_product_units_active ON public.product_units(is_active);

-- ============================================================
-- 5. Add reserved_stock to inventory
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'reserved_stock') THEN
    ALTER TABLE public.inventory ADD COLUMN reserved_stock int NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0);
  END IF;
END $$;

-- Add net_available_stock generated column (physical - allocated - reserved)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'net_available_stock') THEN
    ALTER TABLE public.inventory
      ADD COLUMN net_available_stock int GENERATED ALWAYS AS (physical_stock - allocated_stock - reserved_stock) STORED;
  END IF;
END $$;
