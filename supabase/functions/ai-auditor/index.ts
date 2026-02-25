import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { totalRevenue, totalAdSpend, materialCogs, realProfit, profitMargin } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const systemPrompt = `You are a luxury business growth strategist specializing in premium restoration services (sneakers, handbags, leather goods). You analyze financial data and provide actionable, specific growth recommendations. Be concise, data-driven, and speak in a confident advisory tone. Format each bullet with an emoji prefix.`;

    const userPrompt = `Analyze this data for Restoree (Luxury Restoration Business):

Revenue (from Turns Sales): ₹${totalRevenue?.toLocaleString("en-IN") || 0}
Meta Ad Spend: ₹${totalAdSpend?.toLocaleString("en-IN") || 0}
Material COGS: ₹${materialCogs?.toLocaleString("en-IN") || 0}
Real Profit: ₹${realProfit?.toLocaleString("en-IN") || 0}
Profit Margin: ${profitMargin || "N/A"}

Give me exactly 3 bullet points for growth. Each bullet should be specific, actionable, and tied to the numbers above. If revenue is 0, suggest strategies to get first revenue. If ad spend is 0, suggest marketing strategies.`;

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("Gemini API error:", status, text);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Gemini API error: ${status} - ${text}`);
    }

    const data = await response.json();
    const analysis = data.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to generate analysis.";

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
