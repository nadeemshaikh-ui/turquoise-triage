import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/components/dashboard/GoldTierLeads";

const fetchLeads = async (): Promise<Lead[]> => {
  const { data, error } = await supabase
    .from("leads")
    .select(`
      id,
      quoted_price,
      status,
      tat_days_min,
      tat_days_max,
      is_gold_tier,
      created_at,
      custom_service_name,
      customers ( name ),
      services ( name, category )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    customerName: row.customers?.name ?? "Unknown",
    serviceName: row.custom_service_name || row.services?.name || "Unknown",
    category: row.services?.category || "Custom",
    quotedPrice: Number(row.quoted_price),
    status: row.status,
    tatDaysMin: row.tat_days_min,
    tatDaysMax: row.tat_days_max,
    isGoldTier: row.is_gold_tier,
    createdAt: row.created_at,
  }));
};

type Stats = {
  todayOrders: number;
  activeLeads: number;
  revenue: number;
  pendingPickup: number;
};

export const useLeads = () => {
  const query = useQuery({
    queryKey: ["leads"],
    queryFn: fetchLeads,
  });

  const leads = query.data ?? [];
  const goldTierLeads = leads.filter((l) => l.isGoldTier);
  const recentLeads = leads.filter((l) => !l.isGoldTier);

  const today = new Date().toISOString().slice(0, 10);
  const stats: Stats = {
    todayOrders: leads.filter((l) => l.createdAt.slice(0, 10) === today).length,
    activeLeads: leads.filter((l) => l.status !== "Completed").length,
    revenue: leads.reduce((sum, l) => sum + l.quotedPrice, 0),
    pendingPickup: leads.filter((l) => l.status === "Ready for Pickup").length,
  };

  return { leads, goldTierLeads, recentLeads, stats, ...query };
};
