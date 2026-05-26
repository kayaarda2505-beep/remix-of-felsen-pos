CREATE TABLE public.product_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, ingredient_id)
);

CREATE INDEX idx_product_recipes_product ON public.product_recipes(product_id);
CREATE INDEX idx_product_recipes_ingredient ON public.product_recipes(ingredient_id);

ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read recipes"
  ON public.product_recipes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage recipes"
  ON public.product_recipes FOR ALL
  TO authenticated
  USING (public.is_admin_or_manager(auth.uid()))
  WITH CHECK (public.is_admin_or_manager(auth.uid()));

CREATE OR REPLACE FUNCTION public.apply_recipe_to_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta numeric;
  v_pid text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_delta := -NEW.qty;
    v_pid := NEW.product_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_delta := OLD.qty;
    v_pid := OLD.product_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.product_id <> OLD.product_id THEN
      UPDATE public.ingredients i
        SET stock = i.stock + (OLD.qty * r.amount)
        FROM public.product_recipes r
        WHERE r.product_id = OLD.product_id AND r.ingredient_id = i.id;
      UPDATE public.ingredients i
        SET stock = i.stock - (NEW.qty * r.amount)
        FROM public.product_recipes r
        WHERE r.product_id = NEW.product_id AND r.ingredient_id = i.id;
      RETURN NULL;
    END IF;
    v_delta := OLD.qty - NEW.qty;
    v_pid := NEW.product_id;
    IF v_delta = 0 THEN RETURN NULL; END IF;
  END IF;

  UPDATE public.ingredients i
    SET stock = i.stock + (v_delta * r.amount)
    FROM public.product_recipes r
    WHERE r.product_id = v_pid AND r.ingredient_id = i.id;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_order_items_apply_recipe
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.apply_recipe_to_stock();