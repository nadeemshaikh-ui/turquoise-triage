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
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [ordersRes, tasksRes, photosRes, discoveriesRes, markersRes] = await Promise.all([
        supabase.from("orders").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
        supabase.from("expert_tasks").select("*"),
        supabase.from("order_photos").select("*"),
        supabase.from("order_discoveries").select("*"),
        supabase.from("photo_markers").select("*"),
      ]);

      const orders = ordersRes.data || [];
      const orderIds = orders.map((o: any) => o.id);

      // Filter related data to only this customer's orders
      const tasks = (tasksRes.data || []).filter((t: any) => orderIds.includes(t.order_id));
      const photos = (photosRes.data || []).filter((p: any) => orderIds.includes(p.order_id));
      const discoveries = (discoveriesRes.data || []).filter((d: any) => orderIds.includes(d.order_id));
      const photoIds = photos.map((p: any) => p.id);
      const markers = (markersRes.data || []).filter((m: any) => photoIds.includes(m.photo_id));

      // Generate public URLs for photos
      const photosWithUrls = photos.map((p: any) => {
        const { data } = supabase.storage.from("order-photos").getPublicUrl(p.storage_path);
        return { ...p, url: data.publicUrl };
      });

      // Split orders
      const active = orders.filter((o: any) => o.status !== "delivered");
      const historical = orders.filter((o: any) => o.status === "delivered");

      return new Response(JSON.stringify({
        active,
        historical,
        tasks,
        photos: photosWithUrls,
        discoveries,
        markers,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST actions
    if (req.method === "POST") {
      const body = await req.json();
      const { customerId } = body;

      if (!customerId) {
        return new Response(JSON.stringify({ error: "customerId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "declare_payment") {
        const { orderIds } = body;
        if (!orderIds?.length) {
          return new Response(JSON.stringify({ error: "orderIds required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Validate ownership
        const { data: owned } = await supabase
          .from("orders")
          .select("id")
          .eq("customer_id", customerId)
          .in("id", orderIds);

        const ownedIds = (owned || []).map((o: any) => o.id);
        if (ownedIds.length !== orderIds.length) {
          return new Response(JSON.stringify({ error: "Invalid order IDs" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await supabase
          .from("orders")
          .update({ payment_declared: true })
          .in("id", ownedIds);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, updated: ownedIds.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "approve") {
        const { orderIds } = body;
        const now = new Date().toISOString();
        const { error } = await supabase
          .from("orders")
          .update({ customer_approved_at: now, status: "pending_advance" })
          .eq("customer_id", customerId)
          .in("id", orderIds || []);
        if (error) throw error;

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
          .from("order_discoveries")
          .update({ approved_at: now })
          .eq("id", discoveryId)
          .select("order_id")
          .single();

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
          .from("order_discoveries")
          .select("order_id")
          .eq("id", discoveryId)
          .single();

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
        const { error } = await supabase
          .from("orders")
          .update({ delivery_address_confirmed_at: now })
          .eq("id", orderId)
          .eq("customer_id", customerId);
        if (error) throw error;

        // Also update customer address
        await supabase.from("customers").update({ address }).eq("id", customerId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "submit_rating") {
        const { orderId, rating, feedback } = body;
        // Store as audit log for now
        await supabase.from("audit_logs").insert({
          order_id: orderId,
          admin_id: customerId, // using customerId as proxy
          action: "customer_rating",
          field_name: "Rating",
          old_value: null,
          new_value: String(rating),
          reason: feedback || `Customer rated ${rating}/5`,
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
