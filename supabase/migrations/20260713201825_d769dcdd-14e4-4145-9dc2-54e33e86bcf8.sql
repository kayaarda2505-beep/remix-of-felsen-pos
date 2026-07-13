UPDATE public.payment_requests
SET tip = CASE id
  WHEN 'c39da2eb-db4d-4405-a548-89fa62b5d669'::uuid THEN 15
  WHEN '1957d3af-9bbd-4535-b072-03a6cf97098a'::uuid THEN 5
  ELSE tip
END
WHERE id IN (
  'c39da2eb-db4d-4405-a548-89fa62b5d669'::uuid,
  '1957d3af-9bbd-4535-b072-03a6cf97098a'::uuid
);

UPDATE public.orders
SET total = CASE id
  WHEN '49c01f24-7be7-40d8-a25e-1c5e854c3ac4'::uuid THEN 60
  WHEN 'f335f20e-999f-4e75-a278-1ae5fda8f749'::uuid THEN 20
  ELSE total
END
WHERE id IN (
  '49c01f24-7be7-40d8-a25e-1c5e854c3ac4'::uuid,
  'f335f20e-999f-4e75-a278-1ae5fda8f749'::uuid
);