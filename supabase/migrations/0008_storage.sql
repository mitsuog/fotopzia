-- Crear buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('media-private', 'media-private', FALSE, 524288000,  -- 500MB
   ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']),
  ('contracts-signed', 'contracts-signed', FALSE, 52428800,  -- 50MB
   ARRAY['application/pdf']),
  ('quotes-pdf', 'quotes-pdf', FALSE, 10485760,  -- 10MB
   ARRAY['application/pdf']),
  ('avatars', 'avatars', TRUE, 5242880,  -- 5MB
   ARRAY['image/jpeg','image/png','image/webp']),
  ('brand-assets', 'brand-assets', TRUE, 10485760,
   ARRAY['image/jpeg','image/png','image/webp','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage: media-private (solo staff sube, acceso via signed URL)
CREATE POLICY "staff_upload_media" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'media-private'
    AND public.is_internal_staff()
  );

CREATE POLICY "staff_view_media" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'media-private'
    AND public.is_internal_staff()
  );

CREATE POLICY "staff_delete_media" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'media-private'
    AND public.get_current_user_role() IN ('admin', 'project_manager')
  );

-- Avatars: público para ver, solo propietario para subir
CREATE POLICY "avatar_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatar_owner_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

-- Contratos y cotizaciones PDF: solo staff
CREATE POLICY "staff_manage_contracts_pdf" ON storage.objects
  FOR ALL USING (
    bucket_id IN ('contracts-signed', 'quotes-pdf')
    AND public.is_internal_staff()
  );
