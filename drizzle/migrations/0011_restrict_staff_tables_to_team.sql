CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.team_members WHERE user_id = _user_id AND active = true)
  )
$$;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

-- review_requests
DROP POLICY IF EXISTS "Staff can manage review requests" ON public.review_requests;
DROP POLICY IF EXISTS "Staff can view review requests" ON public.review_requests;
CREATE POLICY "Staff can view review requests" ON public.review_requests FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can manage review requests" ON public.review_requests FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- order_items
DROP POLICY IF EXISTS "Auth manage order_items" ON public.order_items;
DROP POLICY IF EXISTS "Auth read order_items" ON public.order_items;
CREATE POLICY "Staff manage order_items" ON public.order_items FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- orders
DROP POLICY IF EXISTS "Auth manage orders" ON public.orders;
DROP POLICY IF EXISTS "Auth read orders" ON public.orders;
CREATE POLICY "Staff manage orders" ON public.orders FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- printers
DROP POLICY IF EXISTS "Auth read printers" ON public.printers;
CREATE POLICY "Staff read printers" ON public.printers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- marketing_campaigns
DROP POLICY IF EXISTS "Staff can view campaigns" ON public.marketing_campaigns;
CREATE POLICY "Staff can view campaigns" ON public.marketing_campaigns FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- song_requests
DROP POLICY IF EXISTS "Staff manage song requests" ON public.song_requests;
DROP POLICY IF EXISTS "Auth read song requests" ON public.song_requests;
CREATE POLICY "Staff manage song requests" ON public.song_requests FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- courier_locations
DROP POLICY IF EXISTS "staff can read courier locations" ON public.courier_locations;
DROP POLICY IF EXISTS "staff can update courier locations" ON public.courier_locations;
DROP POLICY IF EXISTS "staff can write courier locations" ON public.courier_locations;
CREATE POLICY "staff can read courier locations" ON public.courier_locations FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff can update courier locations" ON public.courier_locations FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff can write courier locations" ON public.courier_locations FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- day_closings
DROP POLICY IF EXISTS "staff insert closings" ON public.day_closings;
DROP POLICY IF EXISTS "staff read closings" ON public.day_closings;
CREATE POLICY "staff insert closings" ON public.day_closings FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff read closings" ON public.day_closings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- customers
DROP POLICY IF EXISTS "customers readable" ON public.customers;
DROP POLICY IF EXISTS "customers update" ON public.customers;
DROP POLICY IF EXISTS "customers insert" ON public.customers;
CREATE POLICY "customers readable" ON public.customers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "customers update" ON public.customers FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "customers insert" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- ingredients / suppliers / locations
DROP POLICY IF EXISTS "Auth read ingredients" ON public.ingredients;
CREATE POLICY "Staff read ingredients" ON public.ingredients FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Auth read ingredient_suppliers" ON public.ingredient_suppliers;
CREATE POLICY "Staff read ingredient_suppliers" ON public.ingredient_suppliers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Staff read locations" ON public.locations;
CREATE POLICY "Staff read locations" ON public.locations FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- payment_requests
DROP POLICY IF EXISTS "pr_delete" ON public.payment_requests;
DROP POLICY IF EXISTS "pr_update" ON public.payment_requests;
DROP POLICY IF EXISTS "pr_insert" ON public.payment_requests;
DROP POLICY IF EXISTS "pr_select" ON public.payment_requests;
CREATE POLICY "pr_select" ON public.payment_requests FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "pr_insert" ON public.payment_requests FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "pr_update" ON public.payment_requests FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "pr_delete" ON public.payment_requests FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

-- incoming_calls
DROP POLICY IF EXISTS "Staff handle calls" ON public.incoming_calls;
DROP POLICY IF EXISTS "Staff read calls" ON public.incoming_calls;
CREATE POLICY "Staff read calls" ON public.incoming_calls FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff handle calls" ON public.incoming_calls FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- reservation_requests
DROP POLICY IF EXISTS "Staff read reservation requests" ON public.reservation_requests;
DROP POLICY IF EXISTS "Staff update reservation requests" ON public.reservation_requests;
CREATE POLICY "Staff read reservation requests" ON public.reservation_requests FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff update reservation requests" ON public.reservation_requests FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- cash
DROP POLICY IF EXISTS "cm_all" ON public.cash_movements;
CREATE POLICY "cm_all" ON public.cash_movements FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "cc_all" ON public.cash_counts;
CREATE POLICY "cc_all" ON public.cash_counts FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- service_calls
DROP POLICY IF EXISTS "sc_update" ON public.service_calls;
DROP POLICY IF EXISTS "sc_select" ON public.service_calls;
CREATE POLICY "sc_select" ON public.service_calls FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "sc_update" ON public.service_calls FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- storage: receipts readable only through the manager policy
DROP POLICY IF EXISTS "Auth read receipts" ON storage.objects;