import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { item_name, stock_level, min_stock_level, unit, category } = await req.json();

    // Get admin emails from profiles + user_roles
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const rolesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_roles?role=eq.admin&select=user_id`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    const adminRoles = await rolesRes.json();
    const adminIds = (adminRoles || []).map((r: any) => r.user_id);

    if (adminIds.length === 0) {
      return new Response(JSON.stringify({ skipped: "no admins" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get admin emails from auth.users via admin API
    const emails: string[] = [];
    for (const uid of adminIds) {
      const userRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users/${uid}`,
        {
          headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
        }
      );
      const user = await userRes.json();
      if (user?.email) emails.push(user.email);
    }

    if (emails.length === 0) {
      return new Response(JSON.stringify({ skipped: "no admin emails" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send email via Resend
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Restoree 360 <onboarding@resend.dev>",
        to: emails,
        subject: `⚠️ Low Stock Alert: ${item_name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #e11d48;">⚠️ Low Stock Alert</h2>
            <p><strong>${item_name}</strong> (${category}) has dropped below the minimum stock level.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr>
                <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Current Stock</strong></td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${stock_level} ${unit}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Minimum Level</strong></td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${min_stock_level} ${unit}</td>
              </tr>
            </table>
            <p style="color: #6b7280; font-size: 14px;">Please restock soon to avoid production delays.</p>
          </div>
        `,
      }),
    });

    const emailData = await emailRes.json();
    console.log("Resend response:", emailData);

    return new Response(JSON.stringify({ success: true, emailData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
