import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OrderDetail {
  id: string;
  leadId: string | null;
  assetId: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  status: string;
  packageTier: string;
  totalPrice: number;
  shippingFee: number;
  cleaningFee: number;
  warrantyMonths: number;
  slaStart: string | null;
  consultationStartTime: string | null;
  healthScore: number | null;
  maintenanceDue: string | null;
  isBundleApplied: boolean;
  discountAmount: number;
  isGstApplicable: boolean;
  discoveryPending: boolean;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  asset?: {
    id: string;
    itemCategory: string;
    brand: string | null;
    model: string | null;
    serialNumber: string | null;
  } | null;
}

export interface ExpertTask {
  id: string;
  orderId: string;
  assignedTo: string | null;
  expertType: string;
  scopeTags: string[];
  scopeDescription: string | null;
  estimatedPrice: number;
  expertNote: string | null;
  isCompleted: boolean;
  assignedAt: string;
  completedAt: string | null;
  assignedName?: string;
}

export interface OrderPhoto {
  id: string;
  fileName: string;
  storagePath: string;
  photoType: string;
  url: string;
  uploadedAt: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string;
  createdAt: string;
  adminName?: string;
}

const ORDER_STATUS_FLOW = ["triage", "consult", "quoted", "workshop", "qc", "delivered"];

export const useOrderDetail = (orderId: string) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel(`order-detail-${orderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "expert_tasks", filter: `order_id=eq.${orderId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["expert-tasks", orderId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_photos", filter: `order_id=eq.${orderId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["order-photos", orderId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId, queryClient]);

  const orderQuery = useQuery({
    queryKey: ["order", orderId],
    queryFn: async (): Promise<OrderDetail> => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();
      if (error) throw error;
      const row = data as any;

      // Fetch asset if linked
      let asset = null;
      if (row.asset_id) {
        const { data: assetData } = await supabase
          .from("asset_passport")
          .select("*")
          .eq("id", row.asset_id)
          .single();
        if (assetData) {
          asset = {
            id: assetData.id,
            itemCategory: assetData.item_category,
            brand: assetData.brand,
            model: assetData.model,
            serialNumber: assetData.serial_number,
          };
        }
      }

      return {
        id: row.id,
        leadId: row.lead_id,
        assetId: row.asset_id,
        customerId: row.customer_id,
        customerName: row.customer_name || "Unknown",
        customerPhone: row.customer_phone || "",
        status: row.status,
        packageTier: row.package_tier || "standard",
        totalPrice: Number(row.total_price) || 0,
        shippingFee: Number(row.shipping_fee) || 0,
        cleaningFee: Number(row.cleaning_fee) || 0,
        warrantyMonths: row.warranty_months || 3,
        slaStart: row.sla_start,
        consultationStartTime: row.consultation_start_time,
        healthScore: row.health_score,
        maintenanceDue: row.maintenance_due,
        isBundleApplied: row.is_bundle_applied || false,
        discountAmount: Number(row.discount_amount) || 0,
        isGstApplicable: row.is_gst_applicable || false,
        discoveryPending: row.discovery_pending || false,
        notes: row.notes,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        asset,
      };
    },
    enabled: !!orderId,
  });

  const tasksQuery = useQuery({
    queryKey: ["expert-tasks", orderId],
    queryFn: async (): Promise<ExpertTask[]> => {
      const { data, error } = await supabase
        .from("expert_tasks")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at");
      if (error) throw error;

      const assignedIds = [...new Set((data || []).map(t => t.assigned_to).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (assignedIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", assignedIds as string[]);
        profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p.display_name]));
      }

      return (data || []).map(t => ({
        id: t.id,
        orderId: t.order_id,
        assignedTo: t.assigned_to,
        expertType: t.expert_type,
        scopeTags: (t.scope_tags as string[]) || [],
        scopeDescription: t.scope_description,
        estimatedPrice: Number(t.estimated_price) || 0,
        expertNote: t.expert_note,
        isCompleted: t.is_completed || false,
        assignedAt: t.assigned_at || t.created_at,
        completedAt: t.completed_at,
        assignedName: t.assigned_to ? profileMap[t.assigned_to] || "Staff" : undefined,
      }));
    },
    enabled: !!orderId,
  });

  const photosQuery = useQuery({
    queryKey: ["order-photos", orderId],
    queryFn: async (): Promise<OrderPhoto[]> => {
      const { data, error } = await supabase
        .from("order_photos")
        .select("*")
        .eq("order_id", orderId)
        .order("uploaded_at");
      if (error) throw error;

      return (data || []).map(p => {
        const { data: urlData } = supabase.storage
          .from("order-photos")
          .getPublicUrl(p.storage_path);
        return {
          id: p.id,
          fileName: p.file_name,
          storagePath: p.storage_path,
          photoType: p.photo_type,
          url: urlData.publicUrl,
          uploadedAt: p.uploaded_at,
        };
      });
    },
    enabled: !!orderId,
  });

  const auditQuery = useQuery({
    queryKey: ["audit-logs", orderId],
    queryFn: async (): Promise<AuditLogItem[]> => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const adminIds = [...new Set((data || []).map(a => a.admin_id).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (adminIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", adminIds);
        profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p.display_name]));
      }

      return (data || []).map(a => ({
        id: a.id,
        action: a.action,
        fieldName: a.field_name,
        oldValue: a.old_value,
        newValue: a.new_value,
        reason: a.reason,
        createdAt: a.created_at,
        adminName: profileMap[a.admin_id] || "Admin",
      }));
    },
    enabled: !!orderId,
  });

  // Patch 4: updateStatus sets consultation_start_time when transitioning to consult
  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const updates: any = { status: newStatus };
      // Patch 4: set consultation_start_time when moving to consult
      if (newStatus === "consult") {
        updates.consultation_start_time = new Date().toISOString();
      }
      const { error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const updateOrder = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const addExpertTask = useMutation({
    mutationFn: async (task: { expert_type: string; assigned_to?: string; scope_tags?: string[]; scope_description?: string; estimated_price?: number; expert_note?: string }) => {
      const { error } = await supabase
        .from("expert_tasks")
        .insert({ order_id: orderId, ...task });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expert-tasks", orderId] });
    },
  });

  const updateExpertTask = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Record<string, any> }) => {
      const { error } = await supabase
        .from("expert_tasks")
        .update(updates)
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expert-tasks", orderId] });
    },
  });

  const uploadPhotos = useMutation({
    mutationFn: async ({ files, photoType }: { files: File[]; photoType: string }) => {
      for (const file of files) {
        const path = `${orderId}/${Date.now()}-${file.name}`;
        const { error: storageError } = await supabase.storage
          .from("order-photos")
          .upload(path, file);
        if (storageError) throw storageError;

        const { error: dbError } = await supabase.from("order_photos").insert({
          order_id: orderId,
          storage_path: path,
          file_name: file.name,
          photo_type: photoType,
          uploaded_by: user?.id,
        });
        if (dbError) throw dbError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-photos", orderId] });
    },
  });

  const deletePhoto = useMutation({
    mutationFn: async (photo: { id: string; storagePath: string }) => {
      await supabase.storage.from("order-photos").remove([photo.storagePath]);
      const { error } = await supabase.from("order_photos").delete().eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-photos", orderId] });
    },
  });

  // Pricing formula with discount & GST support
  const recalcTotalPrice = (
    tasks: ExpertTask[],
    tier: string,
    shippingFee: number,
    cleaningFee: number,
    isBundleApplied: boolean,
    discountAmount: number = 0,
    isGstApplicable: boolean = false
  ) => {
    let taskSum: number;
    if (tier === "elite") {
      taskSum = tasks.reduce((sum, t) => sum + t.estimatedPrice, 0);
    } else {
      taskSum = tasks
        .filter(t => !(isBundleApplied && t.expertType === "cleaning"))
        .reduce((sum, t) => sum + t.estimatedPrice, 0);
    }
    const subtotal = tier === "elite" ? taskSum : taskSum + shippingFee + cleaningFee;
    const discounted = subtotal - discountAmount;
    return isGstApplicable ? Math.round(discounted * 1.18 * 100) / 100 : discounted;
  };

  return {
    order: orderQuery.data,
    tasks: tasksQuery.data ?? [],
    photos: photosQuery.data ?? [],
    auditLogs: auditQuery.data ?? [],
    isLoading: orderQuery.isLoading,
    updateStatus,
    updateOrder,
    addExpertTask,
    updateExpertTask,
    uploadPhotos,
    deletePhoto,
    recalcTotalPrice,
    ORDER_STATUS_FLOW,
  };
};
