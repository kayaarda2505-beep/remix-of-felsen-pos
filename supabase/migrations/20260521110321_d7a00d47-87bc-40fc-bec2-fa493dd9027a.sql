
-- ============================================================
-- SAINTS POS — Komplettes Schema
-- ============================================================

-- pgcrypto für PIN-Hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===== ROLLEN =====
CREATE TYPE public.app_role AS ENUM ('admin', 'manager');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security-definer function, vermeidet RLS-Rekursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'manager')
  )
$$;

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger: erster Nutzer wird Admin
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Wenn noch kein Admin existiert -> neuer User wird Admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- ===== STANDORTE =====
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  currency TEXT NOT NULL DEFAULT 'CHF',
  timezone TEXT NOT NULL DEFAULT 'Europe/Zurich',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read locations" ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage locations" ON public.locations FOR ALL TO authenticated
  USING (public.is_admin_or_manager(auth.uid())) WITH CHECK (public.is_admin_or_manager(auth.uid()));

-- ===== TEAM-MITGLIEDER (PIN-Login, keine auth.users) =====
CREATE TYPE public.team_role AS ENUM ('manager', 'barkeeper', 'service', 'kueche');

CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role team_role NOT NULL DEFAULT 'service',
  pin_hash TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'oklch(0.7 0.17 250)',
  active BOOLEAN NOT NULL DEFAULT true,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
-- Nur authentifizierte Admins/Manager dürfen Mitarbeiter sehen/verwalten
CREATE POLICY "Admins read team" ON public.team_members FOR SELECT TO authenticated
  USING (public.is_admin_or_manager(auth.uid()));
CREATE POLICY "Admins manage team" ON public.team_members FOR ALL TO authenticated
  USING (public.is_admin_or_manager(auth.uid())) WITH CHECK (public.is_admin_or_manager(auth.uid()));

-- Hilfs-Funktion zur PIN-Validierung (security definer, damit PIN-Hash nie zum Client geht)
CREATE OR REPLACE FUNCTION public.verify_team_pin(_pin TEXT)
RETURNS TABLE(id UUID, name TEXT, role team_role, color TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT tm.id, tm.name, tm.role, tm.color
    FROM public.team_members tm
    WHERE tm.active = true
      AND tm.pin_hash = crypt(_pin, tm.pin_hash)
    LIMIT 1;
END;
$$;

-- ===== TISCHE =====
CREATE TYPE public.table_status AS ENUM ('free', 'occupied', 'bill', 'pending');

CREATE TABLE public.dining_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  seats INTEGER NOT NULL DEFAULT 2,
  status table_status NOT NULL DEFAULT 'free',
  guests INTEGER,
  opened_at TIMESTAMPTZ,
  qr_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dining_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read tables" ON public.dining_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage tables" ON public.dining_tables FOR ALL TO authenticated
  USING (public.is_admin_or_manager(auth.uid())) WITH CHECK (public.is_admin_or_manager(auth.uid()));

-- ===== LAGER / ROHSTOFFE =====
CREATE TABLE public.ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'cl',
  stock NUMERIC NOT NULL DEFAULT 0,
  min_stock NUMERIC NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read ingredients" ON public.ingredients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage ingredients" ON public.ingredients FOR ALL TO authenticated
  USING (public.is_admin_or_manager(auth.uid())) WITH CHECK (public.is_admin_or_manager(auth.uid()));

-- ===== ZAHLUNGSMETHODEN =====
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'twint','card','cash','apple_pay','google_pay'
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  fee_pct NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read payments" ON public.payment_methods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage payments" ON public.payment_methods FOR ALL TO authenticated
  USING (public.is_admin_or_manager(auth.uid())) WITH CHECK (public.is_admin_or_manager(auth.uid()));

-- ===== HAPPY HOUR =====
CREATE TABLE public.happy_hour_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  days_of_week INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}'::INTEGER[],
  start_time TIME NOT NULL DEFAULT '17:00',
  end_time TIME NOT NULL DEFAULT '19:00',
  discount_pct NUMERIC NOT NULL DEFAULT 20,
  category_filter TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.happy_hour_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read happy hour" ON public.happy_hour_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage happy hour" ON public.happy_hour_rules FOR ALL TO authenticated
  USING (public.is_admin_or_manager(auth.uid())) WITH CHECK (public.is_admin_or_manager(auth.uid()));

-- ===== DRUCKER =====
CREATE TABLE public.printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'receipt','kitchen','bar','bill'
  ip_address TEXT,
  port INTEGER DEFAULT 9100,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read printers" ON public.printers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage printers" ON public.printers FOR ALL TO authenticated
  USING (public.is_admin_or_manager(auth.uid())) WITH CHECK (public.is_admin_or_manager(auth.uid()));

-- ===== MITGLIEDERPROGRAMM =====
CREATE TYPE public.member_level AS ENUM ('bronze', 'silver', 'gold', 'platinum');

CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  level member_level NOT NULL DEFAULT 'bronze',
  points INTEGER NOT NULL DEFAULT 0,
  birthday DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read members" ON public.members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage members" ON public.members FOR ALL TO authenticated
  USING (public.is_admin_or_manager(auth.uid())) WITH CHECK (public.is_admin_or_manager(auth.uid()));

-- ===== APP-EINSTELLUNGEN (Singleton-Settings) =====
CREATE TABLE public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  language TEXT NOT NULL DEFAULT 'de-CH',
  currency TEXT NOT NULL DEFAULT 'CHF',
  region TEXT NOT NULL DEFAULT 'CH',
  business_name TEXT NOT NULL DEFAULT 'SAINTS',
  default_tip_percentages INTEGER[] NOT NULL DEFAULT '{0,5,10,15}'::INTEGER[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.app_settings FOR UPDATE TO authenticated
  USING (public.is_admin_or_manager(auth.uid())) WITH CHECK (public.is_admin_or_manager(auth.uid()));

INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Default-Standort
INSERT INTO public.locations (name, address) VALUES ('SAINTS Bar', 'Hauptstandort') ON CONFLICT DO NOTHING;

-- Default-Zahlungsmethoden
INSERT INTO public.payment_methods (name, type, sort_order) VALUES
  ('TWINT', 'twint', 1),
  ('Karte', 'card', 2),
  ('Bar', 'cash', 3),
  ('Apple Pay', 'apple_pay', 4),
  ('Google Pay', 'google_pay', 5);

-- Default Happy Hour
INSERT INTO public.happy_hour_rules (name, days_of_week, start_time, end_time, discount_pct, active)
VALUES ('Standard Happy Hour', '{1,2,3,4,5}', '17:00', '19:00', 20, false);
