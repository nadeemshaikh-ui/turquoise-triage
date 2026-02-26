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

    const systemPrompt = `You are a ruthless, no-BS CFO for a luxury restoration business (Restoree). You analyze financial data and output ONLY in the strict format below. No paragraphs. No introductions. No fluff. Be brutally specific with numbers.

OUTPUT FORMAT (use exactly these 3 headers):

📊 **The Hard Numbers**
- (bullet 1)
- (bullet 2)  
- (bullet 3)

🔍 **What's Broken / What's Working**
- (bullet 1)
- (bullet 2)

🎯 **Next Move**
- (single decisive action, e.g. "Kill Ad X", "Scale Ad Y by 2x", "Pause all spend until ROAS > 2")`;

    const userPrompt = `Revenue: ₹${totalRevenue?.toLocaleString("en-IN") || 0}
Ad Spend: ₹${totalAdSpend?.toLocaleString("en-IN") || 0}
Material COGS: ₹${materialCogs?.toLocaleString("en-IN") || 0}
Profit: ₹${realProfit?.toLocaleString("en-IN") || 0}
Margin: ${profitMargin || "N/A"}
ROAS: ${totalAdSpend > 0 ? (totalRevenue / totalAdSpend).toFixed(2) + "x" : "No ad spend"}
${topAd ? `Best Performing Ad: "${topAd.name}" (CPC: ₹${topAd.cpc}, CTR: ${topAd.ctr}%)` : ""}
${worstAd ? `Worst Ad: "${worstAd.name}" (Spend: ₹${worstAd.spend}, Clicks: ${worstAd.clicks})` : ""}

Analyze. Be ruthless. Follow the exact output format.`;

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
