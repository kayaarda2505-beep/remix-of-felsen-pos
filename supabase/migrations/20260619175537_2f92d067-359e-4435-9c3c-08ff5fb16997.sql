
DELETE FROM public.floor_elements WHERE kind = 'terrace';

UPDATE public.floor_elements
SET shape = 'rounded', x = 60, y = 42, width = 50, height = 42, rotation = 0, label = 'Bar', color = '#f5c46b', points = NULL
WHERE kind = 'bar';

UPDATE public.dining_tables SET name = 'Tisch 1', seats = 4, area = 'indoor', pos_x = 15, pos_y = 72, sort_order = 1 WHERE id = '77f9c3f8-205a-4ce6-b406-bc8dbd3782e0';
UPDATE public.dining_tables SET name = 'Tisch 2', seats = 4, area = 'indoor', pos_x = 30, pos_y = 82, sort_order = 2 WHERE id = '59404c26-c99a-4b58-82ac-75d2bb81945e';
UPDATE public.dining_tables SET name = 'Bar 1', seats = 1, area = 'bar', pos_x = 37, pos_y = 30, sort_order = 10 WHERE id = 'ccf6ae25-3892-41c1-aca6-a402a0537ffa';
UPDATE public.dining_tables SET name = 'Bar 2', seats = 1, area = 'bar', pos_x = 35, pos_y = 45, sort_order = 11 WHERE id = 'ab50f164-3bf8-48ce-a627-dbc7142444c6';
UPDATE public.dining_tables SET name = 'Terrasse 1', seats = 4, area = 'outdoor', pos_x = 90, pos_y = 12, sort_order = 20 WHERE id = '0b43ab21-d965-4edc-94f0-44086406a297';

INSERT INTO public.dining_tables (location_id, name, seats, area, pos_x, pos_y, sort_order) VALUES
  ('a8ac6e1d-6da4-4dca-8148-1a13eb2b2b7d', 'Tisch 3', 4, 'indoor', 15, 50, 3),
  ('a8ac6e1d-6da4-4dca-8148-1a13eb2b2b7d', 'Tisch 4', 2, 'indoor', 10, 25, 4),
  ('a8ac6e1d-6da4-4dca-8148-1a13eb2b2b7d', 'Tisch 5', 4, 'indoor', 42, 88, 5),
  ('a8ac6e1d-6da4-4dca-8148-1a13eb2b2b7d', 'Bar 3', 1, 'bar', 38, 58, 12),
  ('a8ac6e1d-6da4-4dca-8148-1a13eb2b2b7d', 'Bar 4', 1, 'bar', 46, 68, 13),
  ('a8ac6e1d-6da4-4dca-8148-1a13eb2b2b7d', 'Bar 5', 1, 'bar', 60, 70, 14),
  ('a8ac6e1d-6da4-4dca-8148-1a13eb2b2b7d', 'Bar 6', 1, 'bar', 75, 67, 15),
  ('a8ac6e1d-6da4-4dca-8148-1a13eb2b2b7d', 'Terrasse 2', 4, 'outdoor', 90, 92, 21);
