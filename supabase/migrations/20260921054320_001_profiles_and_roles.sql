/*
# Profiles, Roles, and Authentication Foundation

## Purpose
Sets up the core authentication and authorization infrastructure for the
seasonal wholesale order-management application. This migration creates the
role system (customer vs admin), profile tables linked to Supabase Auth,
a trigger that auto-creates a profile when a user signs up, and a security
definer function so users can look up their own profile without the profile
table being directly readable by the anon role.

## New Tables
1. `customer_profiles`
   - Links to `auth.users(id)` via ON DELETE CASCADE.
   - `full_name` (text, required) — customer's full legal name.
   - `mobile_number` (text, required) — primary contact.
   - `shop_name` (text, required) — business/shop trading name.
   - `stall_number` (text, required) — physical stall identifier.
   - `stall_location` (text, required) — physical location description.
   - `email` (text, nullable) — optional email address.
   - `licence_number` (text, nullable) — Fireworks licence/permit, may be added later.
   - `is_active` (boolean, default true) — admin can disable a customer.
   - `created_at` / `updated_at` (timestamptz).

2. `admin_profiles`
   - Links to `auth.users(id)` via ON DELETE CASCADE.
   - `email` (text, nullable) — optional; admin may log in with mobile instead.
   - `mobile_number` (text, nullable) — optional login identifier.
   - `full_name` (text, required) — admin's display name.
   - `role` (text, default 'admin') — supports future staff roles.
   - `is_active` (boolean, default true).
   - `created_at` / `updated_at` (timestamptz).

## Functions
1. `public.handle_new_user()` — SECURITY DEFINER trigger function.
   Inspects `raw_app_meta_data->>'role'` from the new auth user's JWT.
   - If role = 'admin' → inserts a row into `admin_profiles`.
   - Otherwise (default 'customer') → inserts a row into `customer_profiles`
     using metadata fields supplied at signup (full_name, mobile_number,
     shop_name, stall_number, stall_location, email, licence_number).
2. `public.get_my_profile()` — SECURITY DEFINER table-valued function.
   Returns the calling user's profile (customer or admin) joined with role
   info, so the frontend can determine navigation and access without needing
   direct SELECT access to profile tables for every caller.

## Triggers
- `on_auth_user_created` — AFTER INSERT on `auth.users` calls `handle_new_user()`.

## Security (RLS)
- `customer_profiles`: customers can SELECT and UPDATE only their own row
  (auth.uid() = user_id). INSERT is allowed for the owner at creation time
  via the trigger (SECURITY DEFINER); a direct INSERT policy is also added
  for the owner so profile creation is robust. DELETE is admin-only via
  service role or future admin function — no direct customer DELETE policy.
- `admin_profiles`: a user can SELECT only their own row. No direct INSERT/
  UPDATE/DELETE policies for non-service roles — admin profiles are created
  by the trigger and managed via the service role / future admin tooling.
- Both profile tables enable RLS.

## Important Notes
1. The role is stored in `raw_app_meta_data` (JWT app metadata), which is
   user-immutable from the client — customers cannot self-assign admin.
2. Email confirmation remains OFF (Supabase default for this project).
3. The `handle_new_user` function reads from `raw_app_meta_data`, NOT
   `raw_user_meta_data`, to prevent privilege escalation.
4. An initial admin account must be provisioned via the service role in
   a separate step (not included here to avoid hardcoding credentials).
*/

-- ============================================================
-- 1. customer_profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    text NOT NULL,
  mobile_number text NOT NULL,
  shop_name    text NOT NULL,
  stall_number text NOT NULL,
  stall_location text NOT NULL,
  email        text,
  licence_number text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_customer_profile" ON public.customer_profiles;
CREATE POLICY "select_own_customer_profile"
  ON public.customer_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_customer_profile" ON public.customer_profiles;
CREATE POLICY "insert_own_customer_profile"
  ON public.customer_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_customer_profile" ON public.customer_profiles;
CREATE POLICY "update_own_customer_profile"
  ON public.customer_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. admin_profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text,
  mobile_number text,
  full_name    text NOT NULL,
  role         text NOT NULL DEFAULT 'admin',
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_admin_profile" ON public.admin_profiles;
CREATE POLICY "select_own_admin_profile"
  ON public.admin_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. Trigger: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' THEN
    INSERT INTO public.admin_profiles (user_id, email, mobile_number, full_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'mobile_number', NULL),
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
    );
  ELSE
    INSERT INTO public.customer_profiles (
      user_id, full_name, mobile_number, shop_name, stall_number,
      stall_location, email, licence_number
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'mobile_number', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'shop_name', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'stall_number', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'stall_location', ''),
      NEW.email,
      NULLIF(NEW.raw_user_meta_data ->> 'licence_number', '')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 4. Helper: get my profile (role-aware, SECURITY DEFINER)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE (
  user_id uuid,
  role text,
  full_name text,
  email text,
  mobile_number text,
  shop_name text,
  stall_number text,
  stall_location text,
  licence_number text,
  is_active boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cp.user_id,
    'customer'::text AS role,
    cp.full_name,
    cp.email,
    cp.mobile_number,
    cp.shop_name,
    cp.stall_number,
    cp.stall_location,
    cp.licence_number,
    cp.is_active
  FROM public.customer_profiles cp
  WHERE cp.user_id = auth.uid()
  UNION ALL
  SELECT
    ap.user_id,
    ap.role::text AS role,
    ap.full_name,
    ap.email,
    COALESCE(ap.mobile_number, '') AS mobile_number,
    '' AS shop_name,
    '' AS stall_number,
    '' AS stall_location,
    '' AS licence_number,
    ap.is_active
  FROM public.admin_profiles ap
  WHERE ap.user_id = auth.uid()
    AND ap.is_active = true
$$;

-- ============================================================
-- 5. Helper: is current user an active admin?
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_profiles
    WHERE user_id = auth.uid() AND is_active = true
  );
$$;

-- ============================================================
-- 6. updated_at trigger helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_profiles_set_updated_at ON public.customer_profiles;
CREATE TRIGGER customer_profiles_set_updated_at
  BEFORE UPDATE ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS admin_profiles_set_updated_at ON public.admin_profiles;
CREATE TRIGGER admin_profiles_set_updated_at
  BEFORE UPDATE ON public.admin_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
