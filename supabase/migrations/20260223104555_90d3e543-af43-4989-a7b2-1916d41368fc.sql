
-- Activity log for tracking lead status changes and notes
CREATE TABLE public.lead_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage lead activity"
ON public.lead_activity
FOR ALL
USING (true)
WITH CHECK (true);

-- Enable realtime for lead_activity
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_activity;
