DELETE FROM public.payment_requests
WHERE method = 'cash'
  AND (created_at AT TIME ZONE 'Europe/Zurich')::date <> (now() AT TIME ZONE 'Europe/Zurich')::date;