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
    const { lead_id, customer_phone, customer_name, service_name } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if WhatsApp auto-text is enabled
    const { data: enabledSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "whatsapp_auto_enabled")
      .single();

    if (enabledSetting?.value !== "true") {
      return new Response(
        JSON.stringify({ skipped: "WhatsApp auto-text is disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Interakt API key
    const { data: apiKeySetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "interakt_api_key")
      .single();

    const interaktApiKey = apiKeySetting?.value;
    if (!interaktApiKey) {
      return new Response(
        JSON.stringify({ error: "Interakt API key not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone number (ensure country code)
    let phone = customer_phone.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
    if (!phone.startsWith("+")) {
      phone = "+91" + phone; // Default to India
    }

    // Send via Interakt API
    const interaktRes = await fetch("https://api.interakt.ai/v1/public/message/", {
      method: "POST",
      headers: {
        Authorization: `Basic ${interaktApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        countryCode: phone.slice(0, 3),
        phoneNumber: phone.slice(3),
        callbackData: "ready_pickup",
        type: "Template",
        template: {
          name: "ready_for_pickup",
          languageCode: "en",
          headerValues: [],
          bodyValues: [customer_name, service_name],
        },
      }),
    });

    const interaktData = await interaktRes.json();
    console.log("Interakt response:", JSON.stringify(interaktData));

    // Log activity
    await supabase.from("lead_activity").insert({
      lead_id,
      action: "WhatsApp Sent",
      details: `Ready for Pickup notification sent to ${phone}`,
    });

    return new Response(
      JSON.stringify({ success: true, interaktData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
