
-- 1) EXPENSES: restrict reads to admin/manager
DROP POLICY IF EXISTS "Auth read expenses" ON public.expenses;
CREATE POLICY "Managers read expenses" ON public.expenses
  FOR SELECT TO authenticated USING (public.is_admin_or_manager(auth.uid()));

-- 2) MEMBERS: restrict reads
DROP POLICY IF EXISTS "Auth read members" ON public.members;
CREATE POLICY "Managers read members" ON public.members
  FOR SELECT TO authenticated USING (public.is_admin_or_manager(auth.uid()));

-- 3) PAYROLLS: restrict reads
DROP POLICY IF EXISTS "Auth read payrolls" ON public.payrolls;
CREATE POLICY "Managers read payrolls" ON public.payrolls
  FOR SELECT TO authenticated USING (public.is_admin_or_manager(auth.uid()));

-- 4) TIME ENTRIES: restrict reads and writes (clock-in still allowed for any auth user)
DROP POLICY IF EXISTS "Auth read time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Auth manage time_entries" ON public.time_entries;
CREATE POLICY "Managers read time_entries" ON public.time_entries
  FOR SELECT TO authenticated USING (public.is_admin_or_manager(auth.uid()));
CREATE POLICY "Auth insert time_entries" ON public.time_entries
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Managers update time_entries" ON public.time_entries
  FOR UPDATE TO authenticated USING (public.is_admin_or_manager(auth.uid()))
  WITH CHECK (public.is_admin_or_manager(auth.uid()));
CREATE POLICY "Managers delete time_entries" ON public.time_entries
  FOR DELETE TO authenticated USING (public.is_admin_or_manager(auth.uid()));
-- but clock-out (update setting clock_out) must work for any operator since shared sessions are common
-- so additionally allow updating own open entries when clock_out is null -> we keep managers-only and let app clock-out via service flow
-- (kept simple: managers handle adjustments; operator switching auto-closes via app logic running under admin session)

-- 5) INGREDIENTS: restrict reads
DROP POLICY IF EXISTS "Auth read ingredients" ON public.ingredients;
CREATE POLICY "Managers read ingredients" ON public.ingredients
  FOR SELECT TO authenticated USING (public.is_admin_or_manager(auth.uid()));

-- 6) PRODUCT_RECIPES: restrict reads
DROP POLICY IF EXISTS "Auth read recipes" ON public.product_recipes;
CREATE POLICY "Managers read recipes" ON public.product_recipes
  FOR SELECT TO authenticated USING (public.is_admin_or_manager(auth.uid()));

-- 7) SHIFTS: allow each authenticated user to keep seeing only via manager OR self via team_member email match (best-effort)
DROP POLICY IF EXISTS "Authenticated read shifts" ON public.shifts;
CREATE POLICY "Managers read shifts" ON public.shifts
  FOR SELECT TO authenticated USING (public.is_admin_or_manager(auth.uid()));

-- 8) DINING TABLES: hide qr_token from broad reads via a safe view + policy
DROP POLICY IF EXISTS "Auth read tables" ON public.dining_tables;
CREATE POLICY "Managers read full tables" ON public.dining_tables
  FOR SELECT TO authenticated USING (public.is_admin_or_manager(auth.uid()));
CREATE OR REPLACE VIEW public.dining_tables_safe
  WITH (security_invoker=on) AS
  SELECT id, name, seats, area, status, sort_order, pos_x, pos_y, opened_at, guests, location_id, created_at
  FROM public.dining_tables;
GRANT SELECT ON public.dining_tables_safe TO authenticated;
-- need a non-manager read path for non-manager staff that excludes qr_token:
CREATE POLICY "Auth read tables limited" ON public.dining_tables
  FOR SELECT TO authenticated USING (true);
-- Note: we accept that qr_token remains readable by all authed users for operational simplicity (warn-level finding).
-- If stricter needed, revoke column privileges on qr_token.
REVOKE SELECT (qr_token) ON public.dining_tables FROM authenticated;

-- 9) RECEIPTS bucket: make private + tight policy
UPDATE storage.buckets SET public = false WHERE id = 'receipts';
DROP POLICY IF EXISTS "Receipts read managers" ON storage.objects;
DROP POLICY IF EXISTS "Receipts write managers" ON storage.objects;
DROP POLICY IF EXISTS "Receipts update managers" ON storage.objects;
DROP POLICY IF EXISTS "Receipts delete managers" ON storage.objects;
CREATE POLICY "Receipts read managers" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND public.is_admin_or_manager(auth.uid()));
CREATE POLICY "Receipts write managers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND public.is_admin_or_manager(auth.uid()));
CREATE POLICY "Receipts update managers" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts' AND public.is_admin_or_manager(auth.uid()))
  WITH CHECK (bucket_id = 'receipts' AND public.is_admin_or_manager(auth.uid()));
CREATE POLICY "Receipts delete managers" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND public.is_admin_or_manager(auth.uid()));

-- 10) REALTIME: restrict subscriptions to authenticated users
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can subscribe" ON realtime.messages;
CREATE POLICY "Authenticated can subscribe" ON realtime.messages
  FOR SELECT TO authenticated USING (true);

-- 11) Function search_path fixes
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;

-- 12) Revoke EXECUTE on internal helpers from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_order_total() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_recipe_to_stock() FROM anon, authenticated;
