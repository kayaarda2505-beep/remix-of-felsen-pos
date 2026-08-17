UPDATE public.team_members
SET name = 'Pizzastation', role = 'kueche', no_pin = true, active = true, color = '#f59e0b'
WHERE account_number = 3;

INSERT INTO public.team_members (name, role, pin_hash, color, active, account_number, no_pin)
SELECT 'Bar', 'barkeeper', '', '#38bdf8', true, 4, true
WHERE NOT EXISTS (SELECT 1 FROM public.team_members WHERE account_number = 4);

INSERT INTO public.team_members (name, role, pin_hash, color, active, account_number, no_pin)
SELECT 'Küche', 'kueche', '', '#34d399', true, 5, true
WHERE NOT EXISTS (SELECT 1 FROM public.team_members WHERE account_number = 5);