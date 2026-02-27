import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let body: any = {};
    try { body = await req.json(); } catch { /* empty body ok */ }
    const runType = body?.source === "manual" ? "manual" : "nightly";

    let errorsFound = 0;
    let fixesApplied = 0;
    const details: Record<string, any> = {};

    // ── A. Math Integrity ──
    const { data: activeOrders } = await supabase
      .from("orders")
      .select("id, total_price, shipping_fee, cleaning_fee, package_tier, is_bundle_applied, discount_amount, is_gst_applicable")
      .neq("status", "delivered");

    const mathFixes: string[] = [];
    if (activeOrders && activeOrders.length > 0) {
      const orderIds = activeOrders.map((o: any) => o.id);
      const { data: allTasks } = await supabase
        .from("expert_tasks")
        .select("order_id, expert_type, estimated_price")
        .in("order_id", orderIds);

      for (const order of activeOrders) {
        const tasks = (allTasks || []).filter((t: any) => t.order_id === order.id);
        const isElite = order.package_tier === "elite";
        const isBundleApplied = order.is_bundle_applied ?? false;
        const discountAmount = Number(order.discount_amount) || 0;
        const isGst = order.is_gst_applicable ?? false;

        let taskSum: number;
        if (isElite) {
          taskSum = tasks.reduce((s: number, t: any) => s + (Number(t.estimated_price) || 0), 0);
        } else {
          taskSum = tasks
            .filter((t: any) => !(isBundleApplied && t.expert_type === "cleaning"))
            .reduce((s: number, t: any) => s + (Number(t.estimated_price) || 0), 0);
        }

        const subtotal = isElite
          ? taskSum
          : taskSum + (Number(order.shipping_fee) || 0) + (Number(order.cleaning_fee) || 0);

        const discounted = subtotal - discountAmount;
        const calculated = isGst
          ? Math.round(discounted * 1.18 * 100) / 100
          : discounted;

        const dbPrice = Number(order.total_price) || 0;
        if (Math.abs(dbPrice - calculated) > 0.01) {
          errorsFound++;
          await supabase.from("orders").update({ total_price: calculated }).eq("id", order.id);
          fixesApplied++;
          mathFixes.push(order.id);
        }
      }
    }
    details.math = { fixed: mathFixes.length, orderIds: mathFixes };

    // ── B. Orphan Healing ──
    const { data: orphanedOrders } = await supabase
      .from("orders")
      .select("id, customer_id")
      .is("asset_id", null);

    const orphanOrderFixes: string[] = [];
    for (const order of orphanedOrders || []) {
      errorsFound++;
      const { data: newAsset } = await supabase
        .from("asset_passport")
        .insert({ customer_id: order.customer_id, item_category: "Unknown" })
        .select("id")
        .single();
      if (newAsset) {
        await supabase.from("orders").update({ asset_id: newAsset.id }).eq("id", order.id);
        fixesApplied++;
        orphanOrderFixes.push(order.id);
      }
    }

    // Orphaned tasks
    const { data: allTasks2 } = await supabase.from("expert_tasks").select("id, order_id");
    const { data: allOrderIds } = await supabase.from("orders").select("id");
    const orderIdSet = new Set((allOrderIds || []).map((o: any) => o.id));
    const orphanTaskIds = (allTasks2 || []).filter((t: any) => !orderIdSet.has(t.order_id)).map((t: any) => t.id);

    if (orphanTaskIds.length > 0) {
      errorsFound += orphanTaskIds.length;
      for (const tid of orphanTaskIds) {
        await supabase.from("expert_tasks").delete().eq("id", tid);
        fixesApplied++;
      }
    }
    details.orphans = { ordersFixed: orphanOrderFixes.length, tasksDeleted: orphanTaskIds.length };

    // ── C. SLA Healing (Discovery Pause aware) ──
    const { data: slaOrders } = await supabase
      .from("orders")
      .select("id, updated_at, discovery_pending")
      .eq("status", "consult")
      .is("consultation_start_time", null);

    const slaFixes: string[] = [];
    for (const order of slaOrders || []) {
      // Skip orders with discovery_pending = true
      if (order.discovery_pending === true) continue;
      errorsFound++;
      await supabase
        .from("orders")
        .update({ consultation_start_time: order.updated_at })
        .eq("id", order.id);
      fixesApplied++;
      slaFixes.push(order.id);
    }
    details.sla = { fixed: slaFixes.length, skippedDiscovery: (slaOrders || []).filter((o: any) => o.discovery_pending === true).length };

    // ── D. Phone Mismatch Detection (log only) ──
    const { data: allOrders3 } = await supabase
      .from("orders")
      .select("customer_id, customer_name, customer_phone");

    const phoneMap: Record<string, { name: string; phones: Set<string> }> = {};
    for (const o of allOrders3 || []) {
      if (!o.customer_phone) continue;
      if (!phoneMap[o.customer_id]) {
        phoneMap[o.customer_id] = { name: o.customer_name || "Unknown", phones: new Set() };
      }
      phoneMap[o.customer_id].phones.add(o.customer_phone);
    }
    const mismatches = Object.entries(phoneMap)
      .filter(([, v]) => v.phones.size > 1)
      .map(([customerId, v]) => ({ customerId, name: v.name, phones: [...v.phones] }));

    if (mismatches.length > 0) errorsFound += mismatches.length;
    details.phoneMismatches = mismatches;

    // ── Log results ──
    const notes = `Math: ${details.math.fixed}, Orphans: ${details.orphans.ordersFixed}o/${details.orphans.tasksDeleted}t, SLA: ${details.sla.fixed}, Phone: ${mismatches.length} mismatches`;

    await supabase.from("system_health_logs").insert({
      run_type: runType,
      errors_found: errorsFound,
      fixes_applied: fixesApplied,
      notes,
      details,
    });

    return new Response(
      JSON.stringify({ success: true, errorsFound, fixesApplied, details }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
