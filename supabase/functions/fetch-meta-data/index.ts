import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Read token/account from app_settings, fall back to env vars
    let metaToken = Deno.env.get("META_ACCESS_TOKEN")?.trim() || "";
    let adAccountId = "717289587216194";

    const { data: settings } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "meta_config")
      .maybeSingle();

    if (settings?.value) {
      try {
        const parsed = JSON.parse(settings.value);
        if (parsed.meta_access_token) metaToken = parsed.meta_access_token.trim();
        if (parsed.meta_ad_account_id) adAccountId = parsed.meta_ad_account_id.trim();
      } catch { /* ignore parse errors */ }
    }

    if (!metaToken) {
      return new Response(JSON.stringify({ error: "META_ACCESS_TOKEN not configured. Set it in Settings or as a secret." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch in 30-day batches from 2025-09-01 to today
    const allRows: {
      date: string; amount_spent: number; campaign_name: string; ad_name: string;
      ad_id: string; impressions: number; clicks: number; reach: number; engagement: number;
    }[] = [];

    const startDate = new Date("2025-09-01");
    const today = new Date();
    let batchStart = new Date(startDate);

    while (batchStart <= today) {
      const batchEnd = new Date(batchStart);
      batchEnd.setDate(batchEnd.getDate() + 29);
      if (batchEnd > today) batchEnd.setTime(today.getTime());

      const since = batchStart.toISOString().split("T")[0];
      const until = batchEnd.toISOString().split("T")[0];

      console.log(`Fetching batch: ${since} to ${until} for account ${adAccountId}`);

      let nextUrl: string | null = `https://graph.facebook.com/v21.0/act_${adAccountId}/insights?fields=ad_id,campaign_name,ad_name,spend,impressions,clicks,reach,inline_post_engagement&time_range={"since":"${since}","until":"${until}"}&time_increment=1&level=ad&limit=500&access_token=${metaToken}`;

      while (nextUrl) {
        const resp = await fetch(nextUrl);
        if (!resp.ok) {
          const rawText = await resp.text();
          console.error("Meta API Error:", resp.status, rawText);
          return new Response(JSON.stringify({ error: `Meta API HTTP ${resp.status}: ${rawText}` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const json = await resp.json();
        if (json.error) {
          return new Response(JSON.stringify({ error: json.error.message }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        for (const row of (json.data || [])) {
          allRows.push({
            date: row.date_start,
            amount_spent: parseFloat(row.spend) || 0,
            campaign_name: row.campaign_name || "Unknown",
            ad_name: row.ad_name || "Unknown Ad",
            ad_id: row.ad_id || `META-${row.date_start}`,
            impressions: parseInt(row.impressions) || 0,
            clicks: parseInt(row.clicks) || 0,
            reach: parseInt(row.reach) || 0,
            engagement: parseInt(row.inline_post_engagement) || 0,
          });
        }

        nextUrl = json.paging?.next || null;
      }

      // Move to next batch
      batchStart = new Date(batchEnd);
      batchStart.setDate(batchStart.getDate() + 1);
    }

    if (allRows.length === 0) {
      return new Response(JSON.stringify({ message: "No data returned from Meta API", synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate by date+ad_id
    const deduped = new Map<string, typeof allRows[0]>();
    for (const row of allRows) { deduped.set(`${row.date}||${row.ad_id}`, row); }
    const uniqueRows = Array.from(deduped.values());
    console.log(`Fetched ${allRows.length} rows, deduplicated to ${uniqueRows.length}`);

    // Delete existing data in full range
    const { error: deleteError } = await supabase
      .from("meta_ad_spend").delete()
      .gte("date", "2025-09-01")
      .lte("date", today.toISOString().split("T")[0]);
    if (deleteError) throw new Error(`Delete failed: ${deleteError.message}`);

    // Insert in batches of 50
    let inserted = 0;
    for (let i = 0; i < uniqueRows.length; i += 50) {
      const batch = uniqueRows.slice(i, i + 50);
      const { error } = await supabase.from("meta_ad_spend").insert(batch);
      if (error) throw new Error(`Insert failed: ${error.message}`);
      inserted += batch.length;
    }

    const totalSpend = uniqueRows.reduce((s, r) => s + r.amount_spent, 0);

    return new Response(
      JSON.stringify({ message: `Synced ${inserted} ad-level rows, ₹${totalSpend.toFixed(2)} total spend`, synced: inserted, totalSpend }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("fetch-meta-data error:", err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
