/*
# Update: store real email from user metadata in customer profile

## Purpose
The customer registration form now uses mobile number as the primary login
identifier. Supabase Auth requires an email field, so a synthetic email
(<digits>@customer.local) is used as the auth identifier. The customer's
real email (if provided) is passed in raw_user_meta_data.

The handle_new_user trigger previously stored NEW.email (the synthetic email)
into customer_profiles.email. This migration updates the trigger to prefer
the real email from raw_user_meta_data, falling back to NULL if not provided.

## Changes
- Replaces public.handle_new_user() function body.
- The customer branch now uses:
  COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'email', ''), NULL)
  instead of NEW.email.
- The admin branch is unchanged.

## Security
- No RLS changes.
- Function remains SECURITY DEFINER with search_path = public.
*/

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
      COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'email', ''), NULL),
      NULLIF(NEW.raw_user_meta_data ->> 'licence_number', '')
    );
  END IF;
  RETURN NEW;
END;
$$;
