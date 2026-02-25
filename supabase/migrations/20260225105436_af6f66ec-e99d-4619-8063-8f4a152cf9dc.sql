
-- Update deduct_inventory_on_ready to respect inventory_automation_enabled toggle
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_ready()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _enabled text;
BEGIN
  -- Only trigger when status changes TO "Ready for Pickup"
  IF NEW.status = 'Ready for Pickup' AND (OLD.status IS NULL OR OLD.status != 'Ready for Pickup') THEN
    -- Check if inventory automation is enabled
    SELECT value INTO _enabled FROM public.app_settings WHERE key = 'inventory_automation_enabled' LIMIT 1;
    IF _enabled = 'false' THEN
      RETURN NEW; -- Skip deduction
    END IF;

    UPDATE public.inventory_items inv
    SET stock_level = GREATEST(inv.stock_level - r.quantity, 0)
    FROM public.service_recipes r
    WHERE r.service_id = NEW.service_id
      AND r.inventory_item_id = inv.id;
  END IF;
  RETURN NEW;
END;
$function$;
