ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS vat_lines jsonb;
COMMENT ON COLUMN public.expenses.vat_lines IS 'Swiss VAT breakdown per rate: [{rate, gross, vat}]; vat_amount holds the sum';