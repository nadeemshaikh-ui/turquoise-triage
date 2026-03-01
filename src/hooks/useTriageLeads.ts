import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TriageLeadItem {
  id: string;
  category_id: string;
  custom_category_label: string | null;
  service_type: string;
  manual_price: number;
  suggestive_price: number;
  lead_item_addons: { price_at_time: number }[];
  service_categories: { name: string } | null;
}

export interface TriageLead {
  id: string;
  status: string;
  portal_stage: string;
  created_at: string;
  customers: { name: string } | null;
  lead_items: TriageLeadItem[];
}

const fetchTriageLeads = async (): Promise<TriageLead[]> => {
  const { data, error } = await supabase
    .from("leads")
    .select(`
      id,
      status,
      portal_stage,
      created_at,
      customers ( name ),
      lead_items (
        id,
        category_id,
        custom_category_label,
        service_type,
        manual_price,
        suggestive_price,
        lead_item_addons ( price_at_time ),
        service_categories ( name )
      )
    `)
    .eq("lifecycle_status", "open")
    .is("converted_order_id", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as TriageLead[];
};

export const getItemTotal = (item: TriageLeadItem): number => {
  const base = item.manual_price || item.suggestive_price || 0;
  const addons = (item.lead_item_addons ?? []).reduce(
    (s, a) => s + (a.price_at_time ?? 0),
    0
  );
  return base + addons;
};

export const getLeadTotal = (items: TriageLeadItem[]): number =>
  items.reduce((sum, item) => sum + getItemTotal(item), 0);

export const useTriageLeads = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["triage-leads"],
    queryFn: fetchTriageLeads,
  });

  useEffect(() => {
    const channel = supabase
      .channel("triage-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => queryClient.invalidateQueries({ queryKey: ["triage-leads"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const leads = query.data ?? [];

  const grouped = useMemo(() => {
    const intake: TriageLead[] = [];
    const negotiation: TriageLead[] = [];
    const handover: TriageLead[] = [];

    for (const lead of leads) {
      const s = lead.status.toLowerCase();
      const ps = lead.portal_stage.toLowerCase();

      if (s === "new") intake.push(lead);
      else if (s === "quoted") negotiation.push(lead);
      else if (s === "approved" || ps === "approved") handover.push(lead);
    }

    return { intake, negotiation, handover };
  }, [leads]);

  return { ...grouped, allLeads: leads, ...query };
};
