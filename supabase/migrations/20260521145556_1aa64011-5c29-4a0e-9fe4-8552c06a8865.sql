
ALTER TABLE public.dining_tables
  ADD COLUMN IF NOT EXISTS pos_x numeric,
  ADD COLUMN IF NOT EXISTS pos_y numeric;

-- Seed Startpositionen für bestehende Tische (Raster)
WITH ranked AS (
  SELECT id, area,
         row_number() OVER (PARTITION BY area ORDER BY sort_order, name) - 1 AS idx
  FROM public.dining_tables
  WHERE pos_x IS NULL OR pos_y IS NULL
)
UPDATE public.dining_tables d
SET pos_x = CASE WHEN r.area = 'bar' THEN 10 + (r.idx % 8) * 10 ELSE 15 + (r.idx % 6) * 14 END,
    pos_y = CASE WHEN r.area = 'bar' THEN 12 ELSE 35 + (r.idx / 6) * 22 END
FROM ranked r
WHERE d.id = r.id;
