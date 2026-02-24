
-- Recovery offers table to track second-chance offers sent to stale leads
CREATE TABLE public.recovery_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  offer_type TEXT NOT NULL DEFAULT 'second_chance',
  discount_percent INTEGER NOT NULL DEFAULT 10,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '48 hours'),
  status TEXT NOT NULL DEFAULT 'sent',
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recovery_offers ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can manage recovery offers
CREATE POLICY "Authenticated users can manage recovery offers"
  ON public.recovery_offers
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for quick lookups
CREATE INDEX idx_recovery_offers_lead_id ON public.recovery_offers(lead_id);
CREATE INDEX idx_recovery_offers_status ON public.recovery_offers(status);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.recovery_offers;
