ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS courier_name text,
  ADD COLUMN IF NOT EXISTS courier_assigned_at timestamptz;

CREATE INDEX IF NOT EXISTS orders_courier_id_idx ON public.orders (courier_id);