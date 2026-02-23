
-- Inventory items table
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  stock_level NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pcs',
  min_stock_level NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage inventory"
ON public.inventory_items
FOR ALL
USING (true)
WITH CHECK (true);

-- Seed default inventory items
INSERT INTO public.inventory_items (name, category, stock_level, unit) VALUES
  ('Leather Cleaner', 'Chemicals', 500, 'ml'),
  ('Suede Shampoo', 'Chemicals', 300, 'ml'),
  ('Color Restorer', 'Chemicals', 250, 'ml'),
  ('Fabric Glue', 'Glue', 200, 'ml'),
  ('Sole Cement', 'Glue', 150, 'ml'),
  ('TPR Sheet - Black', 'TPR Sheets', 10, 'pcs'),
  ('TPR Sheet - Brown', 'TPR Sheets', 8, 'pcs'),
  ('TPR Sheet - White', 'TPR Sheets', 5, 'pcs'),
  ('Sanding Disc 80 Grit', 'Sanding Discs', 25, 'pcs'),
  ('Sanding Disc 120 Grit', 'Sanding Discs', 30, 'pcs'),
  ('Sanding Disc 240 Grit', 'Sanding Discs', 20, 'pcs'),
  ('Black Dye', 'Dyes', 200, 'ml'),
  ('Brown Dye', 'Dyes', 180, 'ml'),
  ('Tan Dye', 'Dyes', 150, 'ml'),
  ('Buckle Set - Silver', 'Hardware', 15, 'pcs'),
  ('Buckle Set - Gold', 'Hardware', 10, 'pcs'),
  ('Zipper Pull', 'Hardware', 20, 'pcs'),
  ('D-Ring Set', 'Hardware', 12, 'pcs');

-- Trigger for updated_at
CREATE TRIGGER update_inventory_items_updated_at
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_items;
