CREATE POLICY pr_insert ON public.payment_requests FOR INSERT WITH CHECK (true);
CREATE POLICY pr_delete ON public.payment_requests FOR DELETE USING (true);