
-- Table for in-app low-stock alerts
CREATE TABLE public.low_stock_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  stock_level NUMERIC NOT NULL,
  min_stock_level NUMERIC NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.low_stock_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read alerts"
ON public.low_stock_alerts FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can update alerts"
ON public.low_stock_alerts FOR UPDATE
USING (true);

CREATE POLICY "System can insert alerts"
ON public.low_stock_alerts FOR INSERT
WITH CHECK (true);

-- Enable realtime for alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.low_stock_alerts;

-- Trigger function: create alert + call edge function when stock goes below minimum
CREATE OR REPLACE FUNCTION public.check_low_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only fire when stock_level changes and is at or below min_stock_level (and min > 0)
  IF NEW.stock_level <= NEW.min_stock_level AND NEW.min_stock_level > 0
     AND (OLD.stock_level IS NULL OR OLD.stock_level > NEW.min_stock_level OR OLD.stock_level != NEW.stock_level) THEN
    
    -- Insert in-app alert (avoid duplicates within 24h)
    INSERT INTO public.low_stock_alerts (inventory_item_id, item_name, stock_level, min_stock_level)
    SELECT NEW.id, NEW.name, NEW.stock_level, NEW.min_stock_level
    WHERE NOT EXISTS (
      SELECT 1 FROM public.low_stock_alerts
      WHERE inventory_item_id = NEW.id
        AND created_at > now() - interval '24 hours'
    );

    -- Call edge function for email (fire-and-forget via pg_net)
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/low-stock-alert',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'item_name', NEW.name,
        'stock_level', NEW.stock_level,
        'min_stock_level', NEW.min_stock_level,
        'unit', NEW.unit,
        'category', NEW.category
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_check_low_stock
AFTER UPDATE ON public.inventory_items
FOR EACH ROW
EXECUTE FUNCTION public.check_low_stock();
