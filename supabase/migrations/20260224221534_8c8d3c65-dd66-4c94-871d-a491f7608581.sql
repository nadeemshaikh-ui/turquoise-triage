
-- Create automation_logs table
CREATE TABLE public.automation_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_type text NOT NULL,
  lead_id uuid,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read logs
CREATE POLICY "Authenticated users can read automation logs"
  ON public.automation_logs FOR SELECT
  USING (true);

-- System (service role) can insert logs
CREATE POLICY "System can insert automation logs"
  ON public.automation_logs FOR INSERT
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_logs;
