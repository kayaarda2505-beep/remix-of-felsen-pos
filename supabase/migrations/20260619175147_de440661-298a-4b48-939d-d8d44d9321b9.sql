CREATE INDEX IF NOT EXISTS idx_orders_created_at_reports ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_sent_at_reports ON public.order_items(sent_at);