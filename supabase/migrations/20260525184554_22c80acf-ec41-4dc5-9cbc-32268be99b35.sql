ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;