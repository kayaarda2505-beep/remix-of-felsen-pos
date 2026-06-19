CREATE OR REPLACE FUNCTION public.report_expenses_summary(p_from date, p_to date)
RETURNS TABLE(total numeric, expense_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(amount), 0)::numeric AS total,
    COUNT(*)::bigint AS expense_count
  FROM public.expenses
  WHERE expense_date >= p_from AND expense_date <= p_to;
$$;

REVOKE EXECUTE ON FUNCTION public.report_expenses_summary(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_expenses_summary(date, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.report_expenses_by_category(p_from date, p_to date)
RETURNS TABLE(category text, total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(NULLIF(category, ''), 'Sonstiges')::text AS category,
    COALESCE(SUM(amount), 0)::numeric AS total
  FROM public.expenses
  WHERE expense_date >= p_from AND expense_date <= p_to
  GROUP BY COALESCE(NULLIF(category, ''), 'Sonstiges')
  ORDER BY total DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.report_expenses_by_category(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_expenses_by_category(date, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.report_payment_method_totals(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(method text, payment_count bigint, volume numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    method::text,
    COUNT(*)::bigint AS payment_count,
    COALESCE(SUM(amount), 0)::numeric AS volume
  FROM public.payment_requests
  WHERE status = 'paid'
    AND created_at >= p_from
    AND created_at < p_to
  GROUP BY method
  ORDER BY volume DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.report_payment_method_totals(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_payment_method_totals(timestamptz, timestamptz) TO authenticated, service_role;