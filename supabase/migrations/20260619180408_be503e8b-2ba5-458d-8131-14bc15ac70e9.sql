DELETE FROM public.floor_elements WHERE kind = 'terrace';

UPDATE public.floor_elements
SET kind = 'bar', shape = 'rounded', x = 58, y = 42, width = 58, height = 48, rotation = 0, label = 'Bar', color = '#f5c46b', z_index = 0, points = NULL
WHERE kind = 'bar';

UPDATE public.dining_tables SET name = 'Tisch 1', seats = 4, area = 'indoor', pos_x = 14, pos_y = 72, sort_order = 1 WHERE id = '77f9c3f8-205a-4ce6-b406-bc8dbd3782e0';
UPDATE public.dining_tables SET name = 'Tisch 2', seats = 4, area = 'indoor', pos_x = 30, pos_y = 82, sort_order = 2 WHERE id = '59404c26-c99a-4b58-82ac-75d2bb81945e';
UPDATE public.dining_tables SET name = 'Tisch 3', seats = 4, area = 'indoor', pos_x = 14, pos_y = 50, sort_order = 3 WHERE id = '10620e52-5ad1-4078-b125-090453f24cdb';
UPDATE public.dining_tables SET name = 'Tisch 4', seats = 2, area = 'indoor', pos_x = 11, pos_y = 27, sort_order = 4 WHERE id = '02946cd3-cb88-44f6-9925-1c9f238214cd';
UPDATE public.dining_tables SET name = 'Tisch 5', seats = 4, area = 'indoor', pos_x = 42, pos_y = 88, sort_order = 5 WHERE id = 'efc23cba-e283-40e4-a616-9349c223db81';

INSERT INTO public.dining_tables (location_id, name, seats, area, pos_x, pos_y, sort_order)
SELECT 'a8ac6e1d-6da4-4dca-8148-1a13eb2b2b7d', 'Tisch 6', 2, 'indoor', 34, 60, 6
WHERE NOT EXISTS (SELECT 1 FROM public.dining_tables WHERE name = 'Tisch 6' AND area = 'indoor');

UPDATE public.dining_tables SET name = 'Bar 1', seats = 1, area = 'bar', pos_x = 34, pos_y = 24, sort_order = 10 WHERE id = 'ccf6ae25-3892-41c1-aca6-a402a0537ffa';
UPDATE public.dining_tables SET name = 'Bar 2', seats = 1, area = 'bar', pos_x = 32, pos_y = 36, sort_order = 11 WHERE id = 'ab50f164-3bf8-48ce-a627-dbc7142444c6';
UPDATE public.dining_tables SET name = 'Bar 3', seats = 1, area = 'bar', pos_x = 33, pos_y = 49, sort_order = 12 WHERE id = '4ea7007a-753f-4f5f-a0f6-61ddf541f448';
UPDATE public.dining_tables SET name = 'Bar 4', seats = 1, area = 'bar', pos_x = 39, pos_y = 61, sort_order = 13 WHERE id = '001b8a2b-e743-4dbe-b497-d7a154551409';
UPDATE public.dining_tables SET name = 'Bar 5', seats = 1, area = 'bar', pos_x = 51, pos_y = 68, sort_order = 14 WHERE id = '3b0d1390-924d-4eed-8d6d-33c7a7f0b078';
UPDATE public.dining_tables SET name = 'Bar 6', seats = 1, area = 'bar', pos_x = 64, pos_y = 68, sort_order = 15 WHERE id = '12078fee-35dd-4cac-ba1e-08c45d0c6f32';

INSERT INTO public.dining_tables (location_id, name, seats, area, pos_x, pos_y, sort_order)
SELECT 'a8ac6e1d-6da4-4dca-8148-1a13eb2b2b7d', 'Bar 7', 1, 'bar', 77, 63, 16
WHERE NOT EXISTS (SELECT 1 FROM public.dining_tables WHERE name = 'Bar 7' AND area = 'bar');

UPDATE public.dining_tables SET name = 'Terrasse 1', seats = 4, area = 'outdoor', pos_x = 90, pos_y = 14, sort_order = 20 WHERE id = '0b43ab21-d965-4edc-94f0-44086406a297';
UPDATE public.dining_tables SET name = 'Terrasse 2', seats = 4, area = 'outdoor', pos_x = 90, pos_y = 90, sort_order = 21 WHERE id = 'b43dcde0-d2c3-4991-87d2-83feaab51d95';