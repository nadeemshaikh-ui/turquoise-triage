import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";

    // GET: load portal data
    if (req.method === "GET" && action === "load") {
      const customerId = url.searchParams.get("customerId");
      if (!customerId) {
        return new Response(JSON.stringify({ error: "customerId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [ordersRes, tasksRes, photosRes, discoveriesRes, markersRes, settingsRes, auditRes] = await Promise.all([
        supabase.from("orders").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
        supabase.from("expert_tasks").select("*"),
        supabase.from("order_photos").select("*"),
        supabase.from("order_discoveries").select("*"),
        supabase.from("photo_markers").select("*"),
        supabase.from("system_settings").select("company_upi_id, pickup_slots, dropoff_slots").limit(1).single(),
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200),
      ]);

      const orders = ordersRes.data || [];
      const orderIds = orders.map((o: any) => o.id);
      const tasks = (tasksRes.data || []).filter((t: any) => orderIds.includes(t.order_id));
      const photos = (photosRes.data || []).filter((p: any) => orderIds.includes(p.order_id));
      const discoveries = (discoveriesRes.data || []).filter((d: any) => orderIds.includes(d.order_id));
      const photoIds = photos.map((p: any) => p.id);
      const markers = (markersRes.data || []).filter((m: any) => photoIds.includes(m.photo_id));
      const auditLogs = (auditRes.data || []).filter((a: any) => orderIds.includes(a.order_id));

      const photosWithUrls = photos.map((p: any) => {
        const { data } = supabase.storage.from("order-photos").getPublicUrl(p.storage_path);
        return { ...p, url: data.publicUrl };
      });

      const active = orders.filter((o: any) => o.status !== "delivered");
      const historical = orders.filter((o: any) => o.status === "delivered");

      const systemSettings = settingsRes.data || {};

      return new Response(JSON.stringify({ active, historical, tasks, photos: photosWithUrls, discoveries, markers, auditLogs, systemSettings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST actions
    if (req.method === "POST") {
      const body = await req.json();
      const { customerId } = body;

      if (!customerId) {
        return new Response(JSON.stringify({ error: "customerId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "declare_payment") {
        const { orderIds } = body;
        if (!orderIds?.length) {
          return new Response(JSON.stringify({ error: "orderIds required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: owned } = await supabase.from("orders").select("id").eq("customer_id", customerId).in("id", orderIds);
        const ownedIds = (owned || []).map((o: any) => o.id);
        if (ownedIds.length !== orderIds.length) {
          return new Response(JSON.stringify({ error: "Invalid order IDs" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await supabase.from("orders").update({ payment_declared: true }).in("id", ownedIds);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, updated: ownedIds.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "approve") {
        const { orderIds, tiers, excludedTaskIds: excludedMap } = body;
        const now = new Date().toISOString();

        for (const orderId of (orderIds || [])) {
          const selectedTier = tiers?.[orderId] || "standard";
          const excludedIds: string[] = excludedMap?.[orderId] || [];

          // Update order — approved goes to pickup_scheduled
          await supabase
            .from("orders")
            .update({
              customer_approved_at: now,
              status: "pickup_scheduled",
              package_tier: selectedTier,
            })
            .eq("id", orderId)
            .eq("customer_id", customerId);

          if (excludedIds.length > 0) {
            await supabase
              .from("expert_tasks")
              .update({ is_completed: true, expert_note: "Excluded by customer on portal" })
              .in("id", excludedIds)
              .eq("order_id", orderId);
          }

          // Recalculate pricing
          const { data: orderTasks } = await supabase
            .from("expert_tasks").select("*").eq("order_id", orderId).eq("is_completed", false);
          const { data: orderData } = await supabase
            .from("orders").select("shipping_fee, cleaning_fee, discount_amount, is_gst_applicable, is_bundle_applied")
            .eq("id", orderId).single();

          if (orderData && orderTasks) {
            const isElite = selectedTier === "elite";
            const isBundled = orderData.is_bundle_applied && !isElite;
            let taskSum: number;
            if (isElite) {
              taskSum = orderTasks.reduce((s: number, t: any) => s + Number(t.estimated_price || 0), 0) * 1.4;
            } else {
              taskSum = orderTasks
                .filter((t: any) => !(isBundled && t.expert_type === "cleaning"))
                .reduce((s: number, t: any) => s + Number(t.estimated_price || 0), 0);
            }
            const shipping = isElite ? 0 : Number(orderData.shipping_fee || 0);
            const cleaning = isElite ? 0 : (isBundled ? 299 : 0);
            const subtotal = taskSum + shipping + cleaning;
            const discount = Number(orderData.discount_amount || 0);
            const taxable = Math.max(0, subtotal - discount);
            const gst = orderData.is_gst_applicable ? Math.round(taxable * 0.18 * 100) / 100 : 0;
            const total = Math.round((taxable + gst) * 100) / 100;

            await supabase.from("orders").update({
              total_price: total,
              tax_amount: gst,
              total_amount_due: total,
              shipping_fee: shipping,
              cleaning_fee: cleaning,
              warranty_months: isElite ? 6 : 3,
            }).eq("id", orderId);
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "decline") {
        const { orderIds, reason } = body;
        const now = new Date().toISOString();
        const { error } = await supabase
          .from("orders")
          .update({ customer_declined_at: now, decline_reason: reason || "No reason given", status: "declined" })
          .eq("customer_id", customerId)
          .in("id", orderIds || []);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "approve_discovery") {
        const { discoveryId } = body;
        const now = new Date().toISOString();
        const { data: disc } = await supabase
          .from("order_discoveries").update({ approved_at: now }).eq("id", discoveryId).select("order_id").single();
        if (disc) {
          await supabase.from("orders").update({ discovery_pending: false }).eq("id", disc.order_id);
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "decline_discovery") {
        const { discoveryId } = body;
        const { data: disc } = await supabase
          .from("order_discoveries").select("order_id").eq("id", discoveryId).single();
        if (disc) {
          await supabase.from("orders").update({ discovery_pending: false }).eq("id", disc.order_id);
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "confirm_address") {
        const { orderId, address } = body;
        const now = new Date().toISOString();
        const { error } = await supabase.from("orders").update({ delivery_address_confirmed_at: now }).eq("id", orderId).eq("customer_id", customerId);
        if (error) throw error;
        await supabase.from("customers").update({ address }).eq("id", customerId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "submit_rating") {
        const { orderId, rating, feedback } = body;
        await supabase.from("audit_logs").insert({
          order_id: orderId,
          admin_id: customerId,
          action: "customer_rating",
          field_name: "Rating",
          old_value: null,
          new_value: String(rating),
          reason: feedback || `Customer rated ${rating}/5`,
        });
        // Atomic Google review dedup
        if (rating >= 4) {
          await supabase.from("orders")
            .update({ google_review_prompted_at: new Date().toISOString() })
            .eq("id", orderId)
            .is("google_review_prompted_at", null);
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "select_slot") {
        const { orderId, slotType, slot } = body;
        const field = slotType === "pickup" ? "pickup_slot" : "dropoff_slot";
        const { error } = await supabase.from("orders").update({ [field]: slot }).eq("id", orderId).eq("customer_id", customerId);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "request_rework") {
        const { orderId, reason } = body;
        const { data: reworkLeadId, error: reworkErr } = await supabase.rpc('request_rework', {
          p_order_id: orderId,
          p_reason: reason || 'Customer requested rework',
          p_photos_pending: true,
        });
        if (reworkErr) throw reworkErr;
        return new Response(JSON.stringify({ success: true, leadId: reworkLeadId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
