
-- Service-to-inventory recipe linking
CREATE TABLE public.service_recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(service_id, inventory_item_id)
);

ALTER TABLE public.service_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage recipes"
ON public.service_recipes
FOR ALL
USING (true)
WITH CHECK (true);

-- Seed some default recipes
-- We'll insert based on service names matching, using a CTE
INSERT INTO public.service_recipes (service_id, inventory_item_id, quantity)
SELECT s.id, i.id, 50
FROM public.services s, public.inventory_items i
WHERE s.name = 'Sole Pasting' AND i.name = 'Sole Cement'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_recipes (service_id, inventory_item_id, quantity)
SELECT s.id, i.id, 30
FROM public.services s, public.inventory_items i
WHERE s.name = 'Deep Clean' AND i.name = 'Leather Cleaner'
ON CONFLICT DO NOTHING;

INSERT INTO public.service_recipes (service_id, inventory_item_id, quantity)
SELECT s.id, i.id, 25
FROM public.services s, public.inventory_items i
WHERE s.name = 'Color Restoration' AND i.name = 'Color Restorer'
ON CONFLICT DO NOTHING;

-- Function to deduct inventory when lead moves to "Ready for Pickup"
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_ready()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger when status changes TO "Ready for Pickup"
  IF NEW.status = 'Ready for Pickup' AND (OLD.status IS NULL OR OLD.status != 'Ready for Pickup') THEN
    UPDATE public.inventory_items inv
    SET stock_level = GREATEST(inv.stock_level - r.quantity, 0)
    FROM public.service_recipes r
    WHERE r.service_id = NEW.service_id
      AND r.inventory_item_id = inv.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER deduct_inventory_on_ready_trigger
AFTER UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.deduct_inventory_on_ready();
