
-- Fix heutigen Umsatz: Bestellung 45 CHF + 15 CHF Trinkgeld
UPDATE public.payment_requests
  SET amount = 45, tip = 15, note = 'Theke · Karte (korrigiert doppelt erfasste TG)'
  WHERE id = 'c39da2eb-db4d-4405-a548-89fa62b5d669';

UPDATE public.orders
  SET total = 60
  WHERE id = '49c01f24-7be7-40d8-a25e-1c5e854c3ac4';

-- Schutz: verhindere identische doppelte Zahlungen auf dieselbe Bestellung
CREATE UNIQUE INDEX IF NOT EXISTS payment_requests_no_dup_paid
  ON public.payment_requests (order_id, amount, tip, method)
  WHERE status = 'paid';
