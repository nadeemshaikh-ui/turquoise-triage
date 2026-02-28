import { useEffect, useCallback } from "react";
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
  totalAmountDue: number;
  advancePaid: number;
  discountReason: string | null;
  taxAmount: number;
  autoSweetenerType: string | null;
  autoSweetenerValue: string | null;
  quoteSentAt: string | null;
  quoteValidUntil: string | null;
  reminderCount: number;
  uniqueAssetSignature: string | null;
  customerApprovedAt: string | null;
  customerDeclinedAt: string | null;
  declineReason: string | null;
  deliveryAddressConfirmedAt: string | null;
  sliderBeforePhotoId: string | null;
  sliderAfterPhotoId: string | null;
  finalQcVideoUrl: string | null;
  paymentDeclared: boolean;
  packingPhotoUrl: string | null;
  isLoyaltyVip: boolean;
  // v3.4 fields
  deliveredAt: string | null;
  createdByUserId: string | null;
  packageId: string | null;
  warrantyDaysSnapshot: number;
  // Existing fields
  expectedItemCount: number;
  checkedInItems: any[];
  checkinConfirmed: boolean;
  pickupSlot: string | null;
  dropoffSlot: string | null;
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
  isOptional: boolean;
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

const ORDER_STATUS_FLOW = ["pickup_scheduled", "received", "inspection", "in_progress", "qc", "ready", "delivered"];

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
        totalAmountDue: Number(row.total_amount_due) || 0,
        advancePaid: Number(row.advance_paid) || 0,
        discountReason: row.discount_reason,
        taxAmount: Number(row.tax_amount) || 0,
        autoSweetenerType: row.auto_sweetener_type,
        autoSweetenerValue: row.auto_sweetener_value,
        quoteSentAt: row.quote_sent_at,
        quoteValidUntil: row.quote_valid_until,
        reminderCount: row.reminder_count || 0,
        uniqueAssetSignature: row.unique_asset_signature,
        customerApprovedAt: row.customer_approved_at,
        customerDeclinedAt: row.customer_declined_at,
        declineReason: row.decline_reason,
        deliveryAddressConfirmedAt: row.delivery_address_confirmed_at,
        sliderBeforePhotoId: row.slider_before_photo_id,
        sliderAfterPhotoId: row.slider_after_photo_id,
        finalQcVideoUrl: row.final_qc_video_url,
        paymentDeclared: row.payment_declared || false,
        packingPhotoUrl: row.packing_photo_url || null,
        isLoyaltyVip: row.is_loyalty_vip || false,
        // v3.4 fields
        deliveredAt: row.delivered_at || null,
        createdByUserId: row.created_by_user_id || null,
        packageId: row.package_id || null,
        warrantyDaysSnapshot: row.warranty_days_snapshot || 0,
        // Existing fields
        expectedItemCount: row.expected_item_count || 1,
        checkedInItems: (row.checked_in_items as any[]) || [],
        checkinConfirmed: row.checkin_confirmed || false,
        pickupSlot: row.pickup_slot || null,
        dropoffSlot: row.dropoff_slot || null,
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
        isOptional: (t as any).is_optional || false,
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

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase.rpc('transition_order_status', {
        p_order_id: orderId,
        p_to_status: newStatus,
      });
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

  const addDiscovery = useMutation({
    mutationFn: async ({ description, extraPrice, discoveryPhotoUrl }: { description: string; extraPrice: number; discoveryPhotoUrl?: string }) => {
      const insertData: any = { order_id: orderId, description, extra_price: extraPrice };
      if (discoveryPhotoUrl) insertData.discovery_photo_url = discoveryPhotoUrl;
      const { error: discError } = await supabase
        .from("order_discoveries")
        .insert(insertData);
      if (discError) throw discError;
      const { error: orderError } = await supabase
        .from("orders")
        .update({ discovery_pending: true })
        .eq("id", orderId);
      if (orderError) throw orderError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
  });

  // Mark Unfixable (DOA)
  const markUnfixable = useMutation({
    mutationFn: async () => {
      const currentStatus = orderQuery.data?.status || "unknown";

      const { error: updateError } = await supabase
        .from("orders")
        .update({ status: "declined" })
        .eq("id", orderId);
      if (updateError) throw updateError;

      const { error: auditError } = await supabase.from("audit_logs").insert({
        order_id: orderId,
        admin_id: user!.id,
        action: "system_note",
        field_name: "Status",
        old_value: currentStatus,
        new_value: "declined",
        reason: "Item marked unfixable.",
      });
      if (auditError) throw auditError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs", orderId] });
    },
  });

  // Mark Refund Issued
  const markRefundIssued = useMutation({
    mutationFn: async () => {
      const { error: auditError } = await supabase.from("audit_logs").insert({
        order_id: orderId,
        admin_id: user!.id,
        action: "system_note",
        field_name: "Refund",
        old_value: null,
        new_value: "Issued",
        reason: "Refund marked as issued by admin.",
      });
      if (auditError) throw auditError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs", orderId] });
    },
  });

  // Reject Payment Declaration
  const rejectPaymentDeclaration = useMutation({
    mutationFn: async () => {
      const { error: updateError } = await supabase
        .from("orders")
        .update({ payment_declared: false })
        .eq("id", orderId);
      if (updateError) throw updateError;

      const { error: auditError } = await supabase.from("audit_logs").insert({
        order_id: orderId,
        admin_id: user!.id,
        action: "system_note",
        field_name: "Payment",
        old_value: "declared",
        new_value: "rejected",
        reason: "Payment declaration rejected. Portal button re-enabled.",
      });
      if (auditError) throw auditError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs", orderId] });
    },
  });

  // Force Cancel
  const forceCancel = useMutation({
    mutationFn: async () => {
      const currentStatus = orderQuery.data?.status || "unknown";

      const { error: updateError } = await supabase
        .from("orders")
        .update({ status: "cancelled", sla_start: null })
        .eq("id", orderId);
      if (updateError) throw updateError;

      const { error: auditError } = await supabase.from("audit_logs").insert({
        order_id: orderId,
        admin_id: user!.id,
        action: "system_note",
        field_name: "Status",
        old_value: currentStatus,
        new_value: "cancelled",
        reason: "Order force cancelled by admin.",
      });
      if (auditError) throw auditError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs", orderId] });
    },
  });

  // Strict pricing formula (stable ref via useCallback)
  const recalcTotalPrice = useCallback((
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
      taskSum = tasks.reduce((sum, t) => sum + t.estimatedPrice, 0) * 1.4;
    } else {
      taskSum = tasks
        .filter(t => !(isBundleApplied && t.expertType === "cleaning"))
        .reduce((sum, t) => sum + t.estimatedPrice, 0);
    }
    const subtotal = taskSum + shippingFee + cleaningFee;
    const discounted = Math.max(0, subtotal - discountAmount);
    const taxAmount = isGstApplicable ? Math.round(discounted * 0.18 * 100) / 100 : 0;
    const total = Math.round((discounted + taxAmount) * 100) / 100;
    return { subtotal, discounted, taxAmount, total };
  }, []);

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
    addDiscovery,
    markUnfixable,
    markRefundIssued,
    rejectPaymentDeclaration,
    forceCancel,
    recalcTotalPrice,
    ORDER_STATUS_FLOW,
  };
};
