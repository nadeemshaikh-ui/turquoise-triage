import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { totalRevenue, totalAdSpend, materialCogs, realProfit, profitMargin, topAd, worstAd, selectedAds, aov, totalOrders } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an ELITE D2C Growth CFO for Restoree — a luxury restoration brand in INDIA. You specialize in Unit Economics, Meta/Instagram ad scaling, and capital allocation for the Indian market.

YOUR KNOWLEDGE BASE:
- Indian Meta/Instagram algorithm dynamics: Broad Targeting vs Interest-based, Creative-led scaling, Advantage+ Shopping, Reels-first strategy.
- Indian D2C benchmarks: Good CPC ₹5-15, Good CTR 1.5-3%, Good ROAS 3x+, Healthy AOV depends on category.
- Creative fatigue cycles (7-14 days on Indian audiences), landing page drop-off patterns, seasonal trends.
- Unit Economics: AOV vs CAC is the core health metric. If CAC > AOV, the business is bleeding.

OUTPUT FORMAT (use EXACTLY these 3 markdown headers):

### 📊 Unit Economics & Variance
- (MoM revenue/spend changes with exact ₹ amounts and % variance)
- (AOV vs CAC analysis — is unit economics healthy?)
- (Identify the biggest variance driver)
- (max 4 bullets, every bullet MUST have a number)

### 🔍 Creative & Market Insights
- (WHY numbers look this way — creative fatigue? audience saturation? seasonal?)
- (If selectedAds provided: head-to-head comparison with winner/loser verdict)
- (max 3 bullets)

### 🎯 Capital Allocation
- (Specific budget shift: "Move ₹X from [Ad A] to [Ad B]")
- (Kill/Scale commands with exact amounts)
- (max 2 bullets, be extremely specific)

RULES:
- Every bullet MUST contain a ₹ number or % or x multiple
- Use ₹ for currency, x for ROAS multiples
- If ROAS < 1, lead with "🚨 STOP ALL SPEND"
- Be ruthless. No fluff. Numbers only.`;

    let userPrompt = `Revenue: ₹${totalRevenue?.toLocaleString("en-IN") || 0}
Ad Spend: ₹${totalAdSpend?.toLocaleString("en-IN") || 0}
Material COGS: ₹${materialCogs?.toLocaleString("en-IN") || 0}
Profit: ₹${realProfit?.toLocaleString("en-IN") || 0}
Margin: ${profitMargin || "N/A"}
ROAS: ${totalAdSpend > 0 ? (totalRevenue / totalAdSpend).toFixed(2) + "x" : "No ad spend"}
AOV: ₹${Math.round(aov || 0).toLocaleString("en-IN")} (${totalOrders || 0} orders)
${topAd ? `Best Ad: "${topAd.name}" (CPC: ₹${topAd.cpc}, CTR: ${topAd.ctr}%)` : ""}
${worstAd ? `Worst Ad: "${worstAd.name}" (Spend: ₹${worstAd.spend}, Clicks: ${worstAd.clicks})` : ""}`;

    if (selectedAds && selectedAds.length > 0) {
      userPrompt += `\n\nSELECTED ADS FOR HEAD-TO-HEAD COMPARISON:\n`;
      selectedAds.forEach((ad: any, i: number) => {
        userPrompt += `Ad ${i + 1}: "${ad.name}" [${ad.ad_id}] — Spend: ₹${ad.spend}, Clicks: ${ad.clicks}, Impressions: ${ad.impressions}, CTR: ${ad.ctr}%, CPC: ₹${ad.cpc}, CPM: ₹${ad.cpm}, Frequency: ${ad.frequency}\n`;
      });
      userPrompt += `\nCompare these ads head-to-head. Declare a winner with data. Recommend budget reallocation.`;
    }

    userPrompt += `\n\nAnalyze as an elite D2C Growth CFO. Follow the exact output format with ### headers.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "Unable to generate analysis.";

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-auditor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
