import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Read token from app_settings (key-value pattern)
    let metaToken: string | null = null;
    let adAccountId = '717289587216194';

    const { data: settings } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'meta_config')
      .maybeSingle();

    if (settings?.value) {
      try {
        const parsed = JSON.parse(settings.value);
        metaToken = parsed.meta_access_token || null;
        if (parsed.meta_ad_account_id) adAccountId = parsed.meta_ad_account_id;
      } catch {
        // JSON parse failed, ignore
      }
    }

    // Fallback to env var
    if (!metaToken) {
      metaToken = Deno.env.get('META_ACCESS_TOKEN') || null;
    }

    if (!metaToken) {
      throw new Error("Meta Access Token is missing. Please save it in Settings.");
    }

    // Fetch Meta Graph API in 30-day batches from 2025-09-01 to today
    const startDate = new Date('2025-09-01');
    const today = new Date();
    let totalSynced = 0;

    let batchStart = new Date(startDate);
    while (batchStart <= today) {
      const batchEnd = new Date(batchStart);
      batchEnd.setDate(batchEnd.getDate() + 29);
      if (batchEnd > today) batchEnd.setTime(today.getTime());

      const since = batchStart.toISOString().split('T')[0];
      const until = batchEnd.toISOString().split('T')[0];

      const url = `https://graph.facebook.com/v21.0/act_${adAccountId}/insights?fields=ad_id,ad_name,campaign_name,spend,impressions,clicks,reach,actions&level=ad&time_range={"since":"${since}","until":"${until}"}&time_increment=1&limit=500&access_token=${metaToken}`;

      let nextUrl: string | null = url;
      const batchRows: any[] = [];

      while (nextUrl) {
        const resp = await fetch(nextUrl);
        if (!resp.ok) {
          const errText = await resp.text();
          console.error(`Meta API error (${resp.status}):`, errText);
          throw new Error(`Meta API error: ${resp.status} — ${errText.substring(0, 200)}`);
        }

        const json = await resp.json();
        const data = json.data || [];

        for (const row of data) {
          const engagement = (row.actions || []).reduce((s: number, a: any) => {
            if (['post_engagement', 'page_engagement', 'link_click'].includes(a.action_type)) {
              return s + Number(a.value || 0);
            }
            return s;
          }, 0);

          batchRows.push({
            date: row.date_start,
            ad_id: row.ad_id || null,
            ad_name: row.ad_name || null,
            campaign_name: row.campaign_name || null,
            amount_spent: parseFloat(row.spend || '0'),
            impressions: parseInt(row.impressions || '0'),
            clicks: parseInt(row.clicks || '0'),
            reach: parseInt(row.reach || '0'),
            engagement,
          });
        }

        nextUrl = json.paging?.next || null;
      }

      if (batchRows.length > 0) {
        // Delete existing records for this batch date range
        await supabase
          .from('meta_ad_spend')
          .delete()
          .gte('date', since)
          .lte('date', until)
          .not('ad_name', 'eq', 'Manual Meta CSV');

        // Insert in chunks of 50
        for (let i = 0; i < batchRows.length; i += 50) {
          const chunk = batchRows.slice(i, i + 50);
          const { error } = await supabase.from('meta_ad_spend').upsert(chunk, { onConflict: 'date,ad_name' });
          if (error) {
            console.error('Insert error:', error);
            throw error;
          }
        }

        totalSynced += batchRows.length;
      }

      // Move to next batch
      batchStart = new Date(batchEnd);
      batchStart.setDate(batchStart.getDate() + 1);
    }

    return new Response(JSON.stringify({
      message: `Meta sync complete. ${totalSynced} rows synced.`,
      synced: totalSynced,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('fetch-meta-data error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
