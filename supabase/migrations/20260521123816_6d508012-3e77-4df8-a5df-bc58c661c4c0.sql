ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS barcode text;
CREATE UNIQUE INDEX IF NOT EXISTS ingredients_barcode_unique ON public.ingredients (barcode) WHERE barcode IS NOT NULL;