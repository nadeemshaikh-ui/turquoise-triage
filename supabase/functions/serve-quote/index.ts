import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, action, tier } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch quote by token
    const { data: quote, error: quoteErr } = await supabase
      .from("lead_quotes")
      .select("*")
      .eq("quote_token", token)
      .single();

    if (quoteErr || !quote) {
      return new Response(JSON.stringify({ error: "Quote not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle actions
    if (action === "view") {
      await supabase
        .from("lead_quotes")
        .update({ viewed_at: new Date().toISOString() })
        .eq("id", quote.id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "accept" && tier) {
      await supabase
        .from("lead_quotes")
        .update({ accepted_tier: tier, accepted_at: new Date().toISOString() })
        .eq("id", quote.id);

      // Update lead tier + status
      await supabase
        .from("leads")
        .update({ tier, status: "Assigned" })
        .eq("id", quote.lead_id);

      // Log activity
      await supabase.from("lead_activity").insert({
        lead_id: quote.lead_id,
        action: `Customer accepted ${tier}`,
        details: `Customer selected ${tier} tier via digital quote`,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: fetch full quote data for display
    const { data: lead } = await supabase
      .from("leads")
      .select("*, customers(name, phone), services(name, category)")
      .eq("id", quote.lead_id)
      .single();

    // Fetch photos
    const { data: photoRecords } = await supabase
      .from("lead_photos")
      .select("storage_path")
      .eq("lead_id", quote.lead_id);

    const photos = (photoRecords || []).map((p: any) => {
      const { data: urlData } = supabase.storage
        .from("lead-photos")
        .getPublicUrl(p.storage_path);
      return { url: urlData.publicUrl };
    });

    return new Response(
      JSON.stringify({ quote, lead, photos }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
