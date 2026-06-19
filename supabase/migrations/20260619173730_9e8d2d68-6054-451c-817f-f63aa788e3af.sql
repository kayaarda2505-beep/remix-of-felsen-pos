CREATE OR REPLACE FUNCTION public.report_orders_summary(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(revenue numeric, order_count bigint, closed_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(total), 0)::numeric AS revenue,
    COUNT(*)::bigint AS order_count,
    COUNT(*) FILTER (WHERE status = 'paid')::bigint AS closed_count
  FROM public.orders
  WHERE created_at >= p_from AND created_at < p_to;
$$;

REVOKE EXECUTE ON FUNCTION public.report_orders_summary(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_orders_summary(timestamptz, timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.report_daily_totals(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(day date, total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (created_at AT TIME ZONE 'Europe/Zurich')::date AS day,
         COALESCE(SUM(total), 0)::numeric AS total
  FROM public.orders
  WHERE created_at >= p_from AND created_at < p_to
  GROUP BY 1
  ORDER BY 1;
$$;

REVOKE EXECUTE ON FUNCTION public.report_daily_totals(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_daily_totals(timestamptz, timestamptz) TO authenticated, service_role;