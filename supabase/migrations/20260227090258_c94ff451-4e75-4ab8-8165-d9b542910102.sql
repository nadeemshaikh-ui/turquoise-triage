
-- Add new columns to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_gst_applicable boolean DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discovery_pending boolean DEFAULT false;

-- Create system_health_logs table
CREATE TABLE public.system_health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  run_type text NOT NULL DEFAULT 'nightly',
  errors_found integer NOT NULL DEFAULT 0,
  fixes_applied integer NOT NULL DEFAULT 0,
  ghost_test_passed boolean DEFAULT null,
  rls_test_passed boolean DEFAULT null,
  notes text,
  details jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.system_health_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read health logs"
  ON public.system_health_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert health logs"
  ON public.system_health_logs FOR INSERT TO authenticated WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.system_health_logs;
