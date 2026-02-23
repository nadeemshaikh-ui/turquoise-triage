import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface LeadDetail {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  serviceName: string;
  category: string;
  quotedPrice: number;
  status: string;
  tatDaysMin: number;
  tatDaysMax: number;
  isGoldTier: boolean;
  notes: string | null;
  createdAt: string;
}

export interface LeadPhoto {
  id: string;
  fileName: string;
  url: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  userName: string | null;
}

const STATUS_FLOW = ["New", "In Progress", "Ready for Pickup", "Completed"];

export const useLeadDetail = (leadId: string) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const leadQuery = useQuery({
    queryKey: ["lead", leadId],
    queryFn: async (): Promise<LeadDetail> => {
      const { data, error } = await supabase
        .from("leads")
        .select(`
          id, quoted_price, status, tat_days_min, tat_days_max,
          is_gold_tier, created_at, custom_service_name, notes,
          customers ( name, phone, email ),
          services ( name, category )
        `)
        .eq("id", leadId)
        .single();

      if (error) throw error;
      const row = data as any;
      return {
        id: row.id,
        customerName: row.customers?.name ?? "Unknown",
        customerPhone: row.customers?.phone ?? "",
        customerEmail: row.customers?.email ?? null,
        serviceName: row.custom_service_name || row.services?.name || "Unknown",
        category: row.services?.category || "Custom",
        quotedPrice: Number(row.quoted_price),
        status: row.status,
        tatDaysMin: row.tat_days_min,
        tatDaysMax: row.tat_days_max,
        isGoldTier: row.is_gold_tier,
        notes: row.notes,
        createdAt: row.created_at,
      };
    },
    enabled: !!leadId,
  });

  const photosQuery = useQuery({
    queryKey: ["lead-photos", leadId],
    queryFn: async (): Promise<LeadPhoto[]> => {
      const { data, error } = await supabase
        .from("lead_photos")
        .select("id, file_name, storage_path")
        .eq("lead_id", leadId);

      if (error) throw error;

      return (data || []).map((p) => {
        const { data: urlData } = supabase.storage
          .from("lead-photos")
          .getPublicUrl(p.storage_path);
        return {
          id: p.id,
          fileName: p.file_name,
          url: urlData.publicUrl,
        };
      });
    },
    enabled: !!leadId,
  });

  const activityQuery = useQuery({
    queryKey: ["lead-activity", leadId],
    queryFn: async (): Promise<ActivityItem[]> => {
      const { data, error } = await supabase
        .from("lead_activity")
        .select("id, action, details, created_at, user_id")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profile names for user_ids
      const userIds = [...new Set((data || []).map((a) => a.user_id).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);
        profileMap = Object.fromEntries(
          (profiles || []).map((p) => [p.user_id, p.display_name])
        );
      }

      return (data || []).map((a) => ({
        id: a.id,
        action: a.action,
        details: a.details,
        createdAt: a.created_at,
        userName: a.user_id ? profileMap[a.user_id] || "Staff" : null,
      }));
    },
    enabled: !!leadId,
  });

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus })
        .eq("id", leadId);
      if (error) throw error;

      await supabase.from("lead_activity").insert({
        lead_id: leadId,
        user_id: user?.id,
        action: "status_change",
        details: `Status changed to ${newStatus}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead-activity", leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const addNote = useMutation({
    mutationFn: async (note: string) => {
      await supabase.from("lead_activity").insert({
        lead_id: leadId,
        user_id: user?.id,
        action: "note",
        details: note,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-activity", leadId] });
    },
  });

  return {
    lead: leadQuery.data,
    photos: photosQuery.data ?? [],
    activity: activityQuery.data ?? [],
    isLoading: leadQuery.isLoading,
    updateStatus,
    addNote,
    STATUS_FLOW,
  };
};
