import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface LeadDetail {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  serviceName: string;
  category: string;
  quotedPrice: number;
  status: string;
  tatDaysMin: number;
  tatDaysMax: number;
  tatIsManual: boolean;
  isGoldTier: boolean;
  notes: string | null;
  createdAt: string;
  customerAddress: string | null;
  customerCity: string | null;
  customerState: string | null;
  customerPincode: string | null;
  convertedOrderId: string | null;
  lifecycleStatus: string;
}

export interface LeadPhoto {
  id: string;
  fileName: string;
  storagePath: string;
  url: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  userName: string | null;
}

// STATUS_FLOW removed — workflow is now linear in LeadDetail

export const useLeadDetail = (leadId: string) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel(`lead-detail-${leadId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `id=eq.${leadId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_photos", filter: `lead_id=eq.${leadId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["lead-photos", leadId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_activity", filter: `lead_id=eq.${leadId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["lead-activity", leadId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [leadId, queryClient]);

  const leadQuery = useQuery({
    queryKey: ["lead", leadId],
    queryFn: async (): Promise<LeadDetail> => {
      const { data, error } = await supabase
        .from("leads")
        .select(`
          id, quoted_price, status, tat_days_min, tat_days_max, tat_is_manual,
          is_gold_tier, created_at, custom_service_name, notes, customer_id,
          converted_order_id, lifecycle_status,
          customers ( name, phone, email, address, city, state, pincode ),
          services ( name, category )
        `)
        .eq("id", leadId)
        .single();

      if (error) throw error;
      const row = data as any;
      return {
        id: row.id,
        customerId: row.customer_id,
        customerName: row.customers?.name ?? "Unknown",
        customerPhone: row.customers?.phone ?? "",
        customerEmail: row.customers?.email ?? null,
        serviceName: row.custom_service_name || row.services?.name || "Unknown",
        category: row.services?.category || "Custom",
        quotedPrice: Number(row.quoted_price),
        status: row.status,
        tatDaysMin: row.tat_days_min,
        tatDaysMax: row.tat_days_max,
        tatIsManual: row.tat_is_manual ?? false,
        isGoldTier: row.is_gold_tier,
        notes: row.notes,
        createdAt: row.created_at,
        customerAddress: row.customers?.address ?? null,
        customerCity: row.customers?.city ?? null,
        customerState: row.customers?.state ?? null,
        customerPincode: row.customers?.pincode ?? null,
        convertedOrderId: row.converted_order_id ?? null,
        lifecycleStatus: row.lifecycle_status ?? "open",
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
          storagePath: p.storage_path,
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
      const { data, error } = await supabase
        .from("leads")
        .update({ status: newStatus } as any)
        .eq("id", leadId)
        .select("status, customer_id")
        .single();
      if (error) throw error;

      await supabase.from("lead_activity").insert({
        lead_id: leadId,
        user_id: user?.id,
        action: "status_change",
        details: `Status changed to ${newStatus}`,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead-activity", leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const updateTat = useMutation({
    mutationFn: async (params: { tat_days_min: number; tat_days_max: number; tat_is_manual: boolean }) => {
      const { error } = await supabase
        .from("leads")
        .update({
          tat_days_min: params.tat_days_min,
          tat_days_max: params.tat_days_max,
          tat_is_manual: params.tat_is_manual,
        } as any)
        .eq("id", leadId);
      if (error) throw error;

      await supabase.from("lead_activity").insert({
        lead_id: leadId,
        user_id: user?.id,
        action: "tat_update",
        details: params.tat_is_manual
          ? `TAT manually set to ${params.tat_days_min}–${params.tat_days_max} days`
          : `TAT reset to auto (${params.tat_days_min}–${params.tat_days_max} days)`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead-activity", leadId] });
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

  const uploadPhotos = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        const path = `${leadId}/${Date.now()}-${file.name}`;
        const { error: storageError } = await supabase.storage
          .from("lead-photos")
          .upload(path, file);
        if (storageError) throw storageError;

        const { error: dbError } = await supabase.from("lead_photos").insert({
          lead_id: leadId,
          storage_path: path,
          file_name: file.name,
        });
        if (dbError) throw dbError;
      }

      await supabase.from("lead_activity").insert({
        lead_id: leadId,
        user_id: user?.id,
        action: "photo_upload",
        details: `Uploaded ${files.length} photo${files.length > 1 ? "s" : ""}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-photos", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead-activity", leadId] });
    },
  });

  const deletePhoto = useMutation({
    mutationFn: async (photo: { id: string; storagePath: string }) => {
      await supabase.storage.from("lead-photos").remove([photo.storagePath]);
      const { error } = await supabase.from("lead_photos").delete().eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-photos", leadId] });
    },
  });

  return {
    lead: leadQuery.data,
    photos: photosQuery.data ?? [],
    activity: activityQuery.data ?? [],
    isLoading: leadQuery.isLoading,
    updateStatus,
    updateTat,
    addNote,
    uploadPhotos,
    deletePhoto,
  };
};
