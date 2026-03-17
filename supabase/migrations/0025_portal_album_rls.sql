-- RLS defensivo: tokens de portal pueden leer albums publicados y sus media_items
-- Nota: las rutas de portal ya usan supabaseAdmin (bypassa RLS), estas políticas
-- son una segunda línea de defensa en caso de que alguna query llegue sin service_role.

CREATE POLICY "portal_token_view_published_albums"
  ON public.albums FOR SELECT
  USING (
    is_published = TRUE
    AND contact_id IN (
      SELECT contact_id FROM public.client_portal_tokens
      WHERE token = current_setting('app.current_portal_token', TRUE)
        AND is_active = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
    )
  );

CREATE POLICY "portal_token_view_media_items"
  ON public.media_items FOR SELECT
  USING (
    album_id IN (
      SELECT a.id FROM public.albums a
      JOIN public.client_portal_tokens t ON t.contact_id = a.contact_id
      WHERE a.is_published = TRUE
        AND t.token = current_setting('app.current_portal_token', TRUE)
        AND t.is_active = TRUE
        AND (t.expires_at IS NULL OR t.expires_at > NOW())
    )
  );
