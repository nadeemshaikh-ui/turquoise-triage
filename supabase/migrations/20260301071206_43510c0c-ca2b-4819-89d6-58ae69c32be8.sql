
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

  -- Revenue/sales references to leads
  DELETE FROM public.turns_sales WHERE true;
  DELETE FROM public.revenue_imports WHERE true;

  -- Invoice children
  DELETE FROM public.invoice_line_items WHERE true;
  DELETE FROM public.invoices WHERE true;

  -- Order children
  DELETE FROM public.order_item_photos WHERE true;
  DELETE FROM public.order_items WHERE true;
  DELETE FROM public.order_photos WHERE true;
  DELETE FROM public.photo_markers WHERE true;
  DELETE FROM public.ratings WHERE true;
  DELETE FROM public.disputes WHERE true;
  DELETE FROM public.expert_tasks WHERE true;
  DELETE FROM public.order_discoveries WHERE true;
  DELETE FROM public.order_actions WHERE true;
  DELETE FROM public.audit_logs WHERE true;

  -- Orders
  DELETE FROM public.orders WHERE true;

  -- Lead children
  DELETE FROM public.lead_item_addons WHERE true;
  DELETE FROM public.lead_photos WHERE true;
  DELETE FROM public.lead_activity WHERE true;
  DELETE FROM public.lead_quotes WHERE true;
  DELETE FROM public.lead_items WHERE true;
  DELETE FROM public.automation_logs WHERE true;
  DELETE FROM public.recovery_offers WHERE true;

  -- Leads
  DELETE FROM public.leads WHERE true;

  -- Alerts
  DELETE FROM public.low_stock_alerts WHERE true;
END;
$function$;
