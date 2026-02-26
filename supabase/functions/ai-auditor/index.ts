import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { totalRevenue, totalAdSpend, materialCogs, realProfit, profitMargin, topAd, worstAd } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are the TOP-TIER D2C Growth CFO for Restoree — a luxury restoration brand in INDIA. You specialize in Meta/Instagram ad scaling for the Indian market.

YOUR KNOWLEDGE BASE:
- You understand Indian Meta/Instagram algorithm dynamics: Broad Targeting vs Interest-based, Creative-led scaling, Advantage+ Shopping, Reels-first strategy.
- You know Indian D2C benchmarks: Good CPC is ₹5-15, Good CTR is 1.5-3%, Good ROAS is 3x+.
- You factor in creative fatigue cycles (7-14 days on Indian audiences), landing page drop-off patterns, and seasonal trends.

YOUR ANALYSIS FRAMEWORK:
1. Identify "Scaling Winners": Ads with High ROAS + Low CPC that can absorb 2-3x budget.
2. Identify "Profit Bleeders": Ads with High Spend but Low/No Revenue contribution.
3. Explain "The Why": Connect revenue dips to specific causes (creative fatigue, audience saturation, landing page issues, seasonality).

OUTPUT FORMAT (use EXACTLY these 3 headers, no deviations):

📊 **Data Evidence**
- (bullet with exact ₹ amounts, % changes, ROAS multiples)
- (bullet identifying Scaling Winners with data)
- (bullet identifying Profit Bleeders with data)
- (max 4 bullets, every bullet MUST have a number)

🔍 **Market Context (India/Meta)**
- (explain WHY numbers look the way they do — creative fatigue? audience saturation? seasonal?)
- (reference Indian Meta trends: Broad vs Interest targeting, Reels performance, etc.)
- (max 2 bullets)

🎯 **Specific Scaling Moves**
- (single decisive scaling command with exact budget: "Scale [Ad X] from ₹Y to ₹Z")
- (single kill command: "Kill [Ad Y] — bleeding ₹Z with 0 conversions")
- (max 2 bullets, be extremely specific)

RULES:
- Every bullet MUST contain a ₹ number or % or x multiple
- Never exceed 4/2/2 bullets per section
- Use ₹ for currency, x for ROAS multiples
- If ROAS < 1, lead with "🚨 STOP ALL SPEND" in the scaling section
- Be ruthless. No fluff. No paragraphs. Numbers only.`;

    const userPrompt = `Revenue: ₹${totalRevenue?.toLocaleString("en-IN") || 0}
Ad Spend: ₹${totalAdSpend?.toLocaleString("en-IN") || 0}
Material COGS: ₹${materialCogs?.toLocaleString("en-IN") || 0}
Profit: ₹${realProfit?.toLocaleString("en-IN") || 0}
Margin: ${profitMargin || "N/A"}
ROAS: ${totalAdSpend > 0 ? (totalRevenue / totalAdSpend).toFixed(2) + "x" : "No ad spend"}
${topAd ? `Best Ad (Scaling Winner): "${topAd.name}" (CPC: ₹${topAd.cpc}, CTR: ${topAd.ctr}%)` : ""}
${worstAd ? `Worst Ad (Profit Bleeder): "${worstAd.name}" (Spend: ₹${worstAd.spend}, Clicks: ${worstAd.clicks})` : ""}

Analyze as a D2C Growth CFO for the Indian market. Follow the exact output format. Be ruthless.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
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
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds to your workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status} - ${text}`);
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
