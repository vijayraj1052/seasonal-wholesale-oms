/*
# Fix admin trigger and repair existing admin account

## Problem
The `handle_new_user()` trigger checked `auth.jwt() -> 'app_metadata' ->> 'role'`
to decide whether to create an `admin_profiles` or `customer_profiles` row.
When a user is created via the service-role `admin.createUser()` API (as the
create-admin edge function does), the `auth.jwt()` context inside the trigger
does NOT reliably contain the newly-set `app_metadata`. As a result, the
trigger fell through to the ELSE branch and created a `customer_profiles` row
for the admin user — meaning `get_my_profile()` returned `role: 'customer'`
and the admin could not sign in at `/admin/login`.

## Fix
1. Replace `auth.jwt() -> 'app_metadata' ->> 'role'` with
   `NEW.raw_app_meta_data ->> 'role'` in the trigger function. The NEW record's
   `raw_app_meta_data` column is the authoritative source and is always
   available inside the trigger regardless of how the user was created.
2. Repair the existing admin account: delete the erroneous
   `customer_profiles` row and insert the correct `admin_profiles` row.

## Security
No RLS policy changes. The trigger is SECURITY DEFINER and already trusted.
The repair DML uses the service role via the migration tool (bypasses RLS).
*/

-- ============================================================
-- 1. Fix the trigger function to read raw_app_meta_data from NEW
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.raw_app_meta_data ->> 'role') = 'admin' THEN
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

-- ============================================================
-- 2. Repair the existing admin account
--    Delete the erroneous customer_profiles row and insert the
--    correct admin_profiles row for the existing admin user.
-- ============================================================
DELETE FROM public.customer_profiles
WHERE user_id IN (
  SELECT au.id
  FROM auth.users au
  WHERE au.raw_app_meta_data ->> 'role' = 'admin'
    AND au.id IN (SELECT user_id FROM public.customer_profiles)
);

INSERT INTO public.admin_profiles (user_id, email, mobile_number, full_name, role, is_active)
SELECT
  au.id,
  au.email,
  NULL,
  COALESCE(au.raw_user_meta_data ->> 'full_name', au.email),
  'admin',
  true
FROM auth.users au
WHERE au.raw_app_meta_data ->> 'role' = 'admin'
  AND au.id NOT IN (SELECT user_id FROM public.admin_profiles)
ON CONFLICT (user_id) DO NOTHING;
