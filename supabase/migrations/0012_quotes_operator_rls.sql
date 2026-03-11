-- Enable operators to create/manage their own quotes and related line items.
-- Admin and project_manager policies remain in place.

-- Quotes: operator can insert own rows (created_by must be auth.uid())
DROP POLICY IF EXISTS "operator_insert_own_quotes" ON public.quotes;
CREATE POLICY "operator_insert_own_quotes" ON public.quotes
  FOR INSERT
  WITH CHECK (
    public.get_current_user_role() = 'operator'
    AND created_by = auth.uid()
  );

-- Quotes: operator can update only their own quotes
DROP POLICY IF EXISTS "operator_update_own_quotes" ON public.quotes;
CREATE POLICY "operator_update_own_quotes" ON public.quotes
  FOR UPDATE
  USING (
    public.get_current_user_role() = 'operator'
    AND created_by = auth.uid()
  )
  WITH CHECK (
    public.get_current_user_role() = 'operator'
    AND created_by = auth.uid()
  );

-- Quotes: operator can delete only their own quotes
DROP POLICY IF EXISTS "operator_delete_own_quotes" ON public.quotes;
CREATE POLICY "operator_delete_own_quotes" ON public.quotes
  FOR DELETE
  USING (
    public.get_current_user_role() = 'operator'
    AND created_by = auth.uid()
  );

-- Line items: operator can insert/update/delete only if quote belongs to them.
DROP POLICY IF EXISTS "operator_insert_line_items_owned_quotes" ON public.quote_line_items;
CREATE POLICY "operator_insert_line_items_owned_quotes" ON public.quote_line_items
  FOR INSERT
  WITH CHECK (
    public.get_current_user_role() = 'operator'
    AND EXISTS (
      SELECT 1
      FROM public.quotes q
      WHERE q.id = public.quote_line_items.quote_id
        AND q.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "operator_update_line_items_owned_quotes" ON public.quote_line_items;
CREATE POLICY "operator_update_line_items_owned_quotes" ON public.quote_line_items
  FOR UPDATE
  USING (
    public.get_current_user_role() = 'operator'
    AND EXISTS (
      SELECT 1
      FROM public.quotes q
      WHERE q.id = public.quote_line_items.quote_id
        AND q.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.get_current_user_role() = 'operator'
    AND EXISTS (
      SELECT 1
      FROM public.quotes q
      WHERE q.id = public.quote_line_items.quote_id
        AND q.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "operator_delete_line_items_owned_quotes" ON public.quote_line_items;
CREATE POLICY "operator_delete_line_items_owned_quotes" ON public.quote_line_items
  FOR DELETE
  USING (
    public.get_current_user_role() = 'operator'
    AND EXISTS (
      SELECT 1
      FROM public.quotes q
      WHERE q.id = public.quote_line_items.quote_id
        AND q.created_by = auth.uid()
    )
  );
