import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AD_ACCOUNT_ID = "717289587216194";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const metaToken = Deno.env.get("META_ACCESS_TOKEN")?.trim();
    if (!metaToken) {
      return new Response(JSON.stringify({ error: "META_ACCESS_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date();
    const since = "2025-09-01";
    const until = today.toISOString().split("T")[0];

    // Fetch ad-level insights with daily breakdown
    const url = `https://graph.facebook.com/v21.0/act_${AD_ACCOUNT_ID}/insights?fields=campaign_name,ad_name,spend,impressions,clicks,reach,inline_post_engagement&time_range={"since":"${since}","until":"${until}"}&time_increment=1&level=ad&limit=500&access_token=${metaToken}`;

    console.log("Fetching Meta ad-level insights for account:", AD_ACCOUNT_ID, "range:", since, "to", until);

    const allRows: {
      date: string;
      amount_spent: number;
      campaign_name: string;
      ad_name: string;
      impressions: number;
      clicks: number;
      reach: number;
      engagement: number;
    }[] = [];
    let nextUrl: string | null = url;

    while (nextUrl) {
      const resp = await fetch(nextUrl);
      if (!resp.ok) {
        const rawText = await resp.text();
        console.error("Meta API Raw Error (HTTP", resp.status, "):", rawText);
        return new Response(JSON.stringify({ error: `Meta API HTTP ${resp.status}: ${rawText}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const json = await resp.json();

      if (json.error) {
        console.error("Meta API error:", JSON.stringify(json.error));
        return new Response(JSON.stringify({ error: json.error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = json.data || [];
      for (const row of data) {
        allRows.push({
          date: row.date_start,
          amount_spent: parseFloat(row.spend) || 0,
          campaign_name: row.campaign_name || "Unknown",
          ad_name: row.ad_name || "Unknown Ad",
          impressions: parseInt(row.impressions) || 0,
          clicks: parseInt(row.clicks) || 0,
          reach: parseInt(row.reach) || 0,
          engagement: parseInt(row.inline_post_engagement) || 0,
        });
      }

      nextUrl = json.paging?.next || null;
    }

    if (allRows.length === 0) {
      return new Response(JSON.stringify({ message: "No data returned from Meta API", synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate rows by date+ad_name (keep last occurrence)
    const deduped = new Map<string, typeof allRows[0]>();
    for (const row of allRows) {
      deduped.set(`${row.date}||${row.ad_name}`, row);
    }
    const uniqueRows = Array.from(deduped.values());
    console.log(`Fetched ${allRows.length} rows, deduplicated to ${uniqueRows.length}`);

    // Delete ALL existing data in the date range first
    const { error: deleteError } = await supabase
      .from("meta_ad_spend")
      .delete()
      .gte("date", since)
      .lte("date", until);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      throw deleteError;
    }

    // Insert in batches of 100
    const batchSize = 100;
    let inserted = 0;
    for (let i = 0; i < uniqueRows.length; i += batchSize) {
      const batch = uniqueRows.slice(i, i + batchSize);
      const { error } = await supabase.from("meta_ad_spend").insert(batch);
      if (error) {
        console.error("Insert error:", error);
        throw error;
      }
      inserted += batch.length;
    }

    const totalSpend = allRows.reduce((s, r) => s + r.amount_spent, 0);

    return new Response(
      JSON.stringify({
        message: `Synced ${inserted} ad-level rows, ₹${totalSpend.toFixed(2)} total spend`,
        synced: inserted,
        totalSpend,
        dateRange: { since, until },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("fetch-meta-data error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
