CREATE OR REPLACE FUNCTION public.report_category_totals(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(category text, total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(category, 'Sonstiges') AS category,
         SUM(COALESCE(unit_price,0) * COALESCE(qty,0))::numeric AS total
  FROM public.order_items
  WHERE sent_at >= p_from AND sent_at < p_to
  GROUP BY COALESCE(category, 'Sonstiges')
  ORDER BY total DESC;
$$;

GRANT EXECUTE ON FUNCTION public.report_category_totals(timestamptz, timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.report_hourly_totals(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(hour int, total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXTRACT(HOUR FROM sent_at)::int AS hour,
         SUM(COALESCE(unit_price,0) * COALESCE(qty,0))::numeric AS total
  FROM public.order_items
  WHERE sent_at >= p_from AND sent_at < p_to
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.report_hourly_totals(timestamptz, timestamptz) TO authenticated, service_role;