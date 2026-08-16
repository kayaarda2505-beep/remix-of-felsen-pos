CREATE TABLE IF NOT EXISTS public.sms_events (
  id uuid primary key default gen_random_uuid(),
  msg_id text,
  recipient text,
  reference text,
  status text,
  error_code text,
  error_details text,
  raw jsonb,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.sms_events TO authenticated;
GRANT ALL ON public.sms_events TO service_role;
ALTER TABLE public.sms_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Managers can view sms events" ON public.sms_events;
CREATE POLICY "Managers can view sms events" ON public.sms_events FOR SELECT TO authenticated USING (public.is_admin_or_manager(auth.uid()));