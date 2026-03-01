
CREATE OR REPLACE FUNCTION public.reset_test_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  -- Delete in FK-safe order
  DELETE FROM public.invoice_line_items;
  DELETE FROM public.invoices;
  DELETE FROM public.order_item_photos;
  DELETE FROM public.order_items;
  DELETE FROM public.order_photos;
  DELETE FROM public.photo_markers;
  DELETE FROM public.ratings;
  DELETE FROM public.disputes;
  DELETE FROM public.expert_tasks;
  DELETE FROM public.order_discoveries;
  DELETE FROM public.order_actions;
  DELETE FROM public.audit_logs;
  DELETE FROM public.orders;
  DELETE FROM public.lead_item_addons;
  DELETE FROM public.lead_photos;
  DELETE FROM public.lead_activity;
  DELETE FROM public.lead_quotes;
  DELETE FROM public.lead_items;
  DELETE FROM public.automation_logs;
  DELETE FROM public.recovery_offers;
  DELETE FROM public.leads;
  DELETE FROM public.low_stock_alerts;
END;
$function$;
