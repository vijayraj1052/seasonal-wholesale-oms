/*
# Product Images Storage Bucket

## Purpose
Creates a public Supabase Storage bucket for product images and the
minimum required RLS policies to keep uploads admin-only while allowing
public reads.

## Changes
1. Creates the `product-images` bucket (public = true so images can be
   displayed in the customer catalogue without authenticated requests).
2. Adds storage.objects policies scoped to the bucket:
   - SELECT: public (anyone, anon + authenticated) — catalogue images
     must load for unauthenticated visitors.
   - INSERT: admin only (via public.is_admin()).
   - UPDATE: admin only.
   - DELETE: admin only.

## Security
- Public reads are intentional: product images are catalogue content.
- Writes are restricted to admins via the existing public.is_admin()
  helper used throughout the app's RLS policies.
- No service-role keys are exposed; the frontend uses the anon key
  with the user's JWT, and the storage policies enforce admin-only writes.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for product images
DROP POLICY IF EXISTS "public_read_product_images" ON storage.objects;
CREATE POLICY "public_read_product_images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');

-- Admin-only upload
DROP POLICY IF EXISTS "admin_insert_product_images" ON storage.objects;
CREATE POLICY "admin_insert_product_images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

-- Admin-only update (replace image)
DROP POLICY IF EXISTS "admin_update_product_images" ON storage.objects;
CREATE POLICY "admin_update_product_images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

-- Admin-only delete
DROP POLICY IF EXISTS "admin_delete_product_images" ON storage.objects;
CREATE POLICY "admin_delete_product_images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());
