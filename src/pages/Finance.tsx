import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, DollarSign, TrendingUp, BarChart3, Trash2, RefreshCw, Wifi, Target, Brain, CalendarDays } from "lucide-react";
import AdsIntelligence from "@/components/finance/AdsIntelligence";
import AiAuditor from "@/components/finance/AiAuditor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { format as fnsFormat, endOfMonth, eachMonthOfInterval, subDays, subMonths, startOfMonth } from "date-fns";

const sanitizePhone = (raw: string): string => {
  let p = raw.replace(/[\s\-().+]/g, "");
  if (p.startsWith("91") && p.length > 10) p = p.slice(p.length - 10);
  return p.slice(-10);
};

const tooltipStyle = {
  borderRadius: 16,
  border: "1px solid hsl(186, 60%, 75%, 0.35)",
  background: "hsl(220, 16%, 95%)",
  fontSize: 12,
  boxShadow: "4px 4px 10px hsl(220, 20%, 84%), -4px -4px 10px hsl(0, 0%, 100%)",
};

type DatePreset = "all" | "last_month" | "last_14" | "custom";

const Finance = () => {
  const queryClient = useQueryClient();
  const [uploadingAds, setUploadingAds] = useState(false);
  const [uploadingTurns, setUploadingTurns] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");

  // Compute date range from preset
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (datePreset) {
      case "last_month": {
        const lm = subMonths(now, 1);
        return { start: fnsFormat(startOfMonth(lm), "yyyy-MM-dd"), end: fnsFormat(endOfMonth(lm), "yyyy-MM-dd") };
      }
      case "last_14":
        return { start: fnsFormat(subDays(now, 14), "yyyy-MM-dd"), end: fnsFormat(now, "yyyy-MM-dd") };
      case "all":
      default:
        return { start: "2025-09-01", end: fnsFormat(now, "yyyy-MM-dd") };
    }
  }, [datePreset]);

  const isInRange = (dateStr: string) => {
    const d = dateStr.substring(0, 10);
    return d >= dateRange.start && d <= dateRange.end;
  };

  // Queries
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["finance-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, quoted_price, status, created_at, service_id, customer_id, customers(name)")
        .in("status", ["Ready for Pickup", "Completed"]);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: turnsSales = [] } = useQuery({
    queryKey: ["finance-turns-sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("turns_sales").select("*").order("date");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: recipes = [] } = useQuery({
    queryKey: ["finance-recipes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_recipes").select("service_id, quantity, inventory_items(cost_per_unit)");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: adSpend = [] } = useQuery({
    queryKey: ["finance-ad-spend"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meta_ad_spend").select("*").order("date");
      if (error) throw error;
      return data || [];
    },
  });

  // Filtered data — NO current month filter, uses global date range
  const filteredLeads = useMemo(() => leads.filter((l: any) => isInRange(l.created_at)), [leads, dateRange]);
  const filteredAdSpend = useMemo(() => (adSpend as any[]).filter((a) => isInRange(a.date)), [adSpend, dateRange]);
  const filteredTurnsSales = useMemo(() => (turnsSales as any[]).filter((t) => isInRange(t.date)), [turnsSales, dateRange]);

  // P&L calculations
  const pnl = useMemo(() => {
    const turnsRevenue = filteredTurnsSales.reduce((s, t: any) => s + Number(t.amount), 0);
    const recipeCostByService = new Map<string, number>();
    (recipes as any[]).forEach((r: any) => {
      const cost = Number(r.quantity) * Number(r.inventory_items?.cost_per_unit || 0);
      recipeCostByService.set(r.service_id, (recipeCostByService.get(r.service_id) || 0) + cost);
    });
    let totalMaterialCost = 0;
    filteredLeads.forEach((l: any) => {
      totalMaterialCost += recipeCostByService.get(l.service_id) || 0;
    });
    const totalAdSpend = filteredAdSpend.reduce((s, a: any) => s + Number(a.amount_spent), 0);
    const realProfit = turnsRevenue - totalAdSpend - totalMaterialCost;
    return { turnsRevenue, totalMaterialCost, totalAdSpend, realProfit };
  }, [filteredLeads, filteredTurnsSales, filteredAdSpend, recipes]);

  const profitMargin = pnl.turnsRevenue > 0 ? `${((pnl.realProfit / pnl.turnsRevenue) * 100).toFixed(1)}%` : "N/A";
  const grossRoas = pnl.totalAdSpend > 0 ? pnl.turnsRevenue / pnl.totalAdSpend : 0;

  // MoM chart data — uses ALL data for full historical view
  const momChartData = useMemo(() => {
    const allDates = [
      ...(turnsSales as any[]).map((t) => t.date),
      ...(adSpend as any[]).map((a) => a.date),
    ].filter(Boolean);
    if (allDates.length === 0) return [];

    const minDate = allDates.reduce((a, b) => (a < b ? a : b));
    const maxDate = allDates.reduce((a, b) => (a > b ? a : b));
    const months = eachMonthOfInterval({ start: new Date(minDate), end: new Date(maxDate) });

    return months.map((month) => {
      const monthKey = fnsFormat(month, "yyyy-MM");
      const monthLabel = fnsFormat(month, "MMM yy");
      const monthEndDate = endOfMonth(month);
      const revenue = (turnsSales as any[])
        .filter((t) => { const d = new Date(t.date); return d >= month && d <= monthEndDate; })
        .reduce((s, t: any) => s + Number(t.amount), 0);
      const spend = (adSpend as any[])
        .filter((a) => { const d = new Date(a.date); return d >= month && d <= monthEndDate; })
        .reduce((s, a: any) => s + Number(a.amount_spent), 0);
      const profit = revenue - spend;
      const roas = spend > 0 ? revenue / spend : 0;
      return { month: monthLabel, monthKey, revenue: Math.round(revenue), spend: Math.round(spend), profit: Math.round(profit), roas };
    });
  }, [turnsSales, adSpend]);

  // Daily timeline data (grouped by date)
  const dailyTimelineData = useMemo(() => {
    const dayMap = new Map<string, { revenue: number; spend: number; ads: string[] }>();
    filteredTurnsSales.forEach((t: any) => {
      const existing = dayMap.get(t.date) || { revenue: 0, spend: 0, ads: [] };
      existing.revenue += Number(t.amount);
      dayMap.set(t.date, existing);
    });
    filteredAdSpend.forEach((a: any) => {
      const existing = dayMap.get(a.date) || { revenue: 0, spend: 0, ads: [] };
      existing.spend += Number(a.amount_spent);
      const adName = a.ad_name || a.campaign_name || "Unknown";
      if (!existing.ads.includes(adName)) existing.ads.push(adName);
      dayMap.set(a.date, existing);
    });
    return Array.from(dayMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, data]) => ({
        date,
        dateLabel: new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        revenue: Math.round(data.revenue),
        spend: Math.round(data.spend),
        profit: Math.round(data.revenue - data.spend),
        adCount: data.ads.length,
      }));
  }, [filteredTurnsSales, filteredAdSpend]);

  // Ad stats for AI CFO
  const adStatsForAi = useMemo(() => {
    const map = new Map<string, { ad_name: string; spend: number; clicks: number; impressions: number; engagement: number }>();
    filteredAdSpend.forEach((a: any) => {
      const key = a.ad_name || a.campaign_name || "Unknown";
      const existing = map.get(key);
      if (existing) {
        existing.spend += Number(a.amount_spent);
        existing.clicks += Number(a.clicks || 0);
        existing.impressions += Number(a.impressions || 0);
        existing.engagement += Number(a.engagement || 0);
      } else {
        map.set(key, {
          ad_name: key,
          spend: Number(a.amount_spent),
          clicks: Number(a.clicks || 0),
          impressions: Number(a.impressions || 0),
          engagement: Number(a.engagement || 0),
        });
      }
    });
    return Array.from(map.values()).map((a) => ({
      ...a,
      ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
      cpc: a.clicks > 0 ? a.spend / a.clicks : 0,
    }));
  }, [filteredAdSpend]);

  const topAd = useMemo(() => {
    const withClicks = adStatsForAi.filter((a) => a.clicks >= 5 && a.cpc > 0);
    if (withClicks.length === 0) return null;
    return withClicks.sort((a, b) => a.cpc - b.cpc)[0];
  }, [adStatsForAi]);

  const worstAd = useMemo(() => {
    const highSpend = adStatsForAi.filter((a) => a.spend > 50);
    if (highSpend.length === 0) return null;
    return highSpend.sort((a, b) => {
      const effA = a.clicks > 0 ? a.spend / a.clicks : a.spend * 100;
      const effB = b.clicks > 0 ? b.spend / b.clicks : b.spend * 100;
      return effB - effA;
    })[0];
  }, [adStatsForAi]);

  const refreshFinanceDashboard = async () => {
    const keys = [["finance-turns-sales"], ["finance-ad-spend"], ["finance-leads"], ["finance-recipes"]] as const;
    await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    await Promise.all(keys.map((queryKey) => queryClient.refetchQueries({ queryKey })));
  };

  // LIVE META SYNC
  const handleLiveSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-meta-data");
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === "object" ? JSON.stringify(data.error) : data.error);
      setLastSyncTime(new Date().toLocaleTimeString());
      await refreshFinanceDashboard();
      toast({ title: "✅ Live Meta Sync Complete", description: data?.message || `Synced ${data?.synced || 0} rows` });
    } catch (err: any) {
      toast({ title: "Sync Error", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  // META AD CSV UPLOAD — with stable ad_id generation
  const handleAdCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAds(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length <= 11) throw new Error("Invalid Format: expected tab-delimited file with preamble");

      const rows: { date: string; amount_spent: number; ad_name: string; ad_id: string; campaign_name: string; reach: number; impressions: number; clicks: number; engagement: number }[] = [];

      for (const line of lines.slice(11)) {
        const cells = line.split("\t").map((c) => c.replace(/"/g, "").trim());
        if (cells.length < 3) continue;
        const rawDate = cells[0] || "";
        const dateParts = rawDate.split("-");
        if (dateParts.length !== 3) continue;
        const day = dateParts[0].padStart(2, "0");
        const month = dateParts[1].padStart(2, "0");
        const year = dateParts[2];
        if (!/^\d{4}$/.test(year)) continue;
        const date = `${year}-${month}-${day}`;
        const amount = parseFloat((cells[2] || "").replace(/[^0-9.]/g, ""));
        if (!Number.isFinite(amount) || amount <= 0) continue;

        // Stable unique ID: MANUAL-{date}-{spend_stripped}
        const generatedId = `MANUAL-${cells[0]}-${(cells[2] || "").replace(/[^0-9]/g, "")}`;

        rows.push({
          date,
          amount_spent: amount,
          ad_name: cells[1] || "Manual Ad",
          ad_id: generatedId,
          campaign_name: cells[1] || "Manual Meta CSV",
          reach: 0,
          impressions: 0,
          clicks: 0,
          engagement: 0,
        });
      }

      if (rows.length === 0) throw new Error("No valid data rows found in Meta CSV");

      // Delete-then-Insert strategy for the CSV's date range
      const dates = rows.map((r) => r.date);
      const minDate = dates.reduce((a, b) => (a < b ? a : b));
      const maxDate = dates.reduce((a, b) => (a > b ? a : b));

      // Delete only MANUAL entries in the date range to preserve live-synced data
      const { error: deleteError } = await supabase
        .from("meta_ad_spend")
        .delete()
        .gte("date", minDate)
        .lte("date", maxDate)
        .like("ad_id", "MANUAL-%");
      if (deleteError) console.warn("Delete warning:", deleteError.message);

      // Insert in batches of 100
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error } = await supabase.from("meta_ad_spend").insert(batch);
        if (error) throw error;
      }

      const totalSpend = rows.reduce((s, r) => s + r.amount_spent, 0);
      toast({ title: `✅ Synced ₹${totalSpend.toLocaleString("en-IN", { minimumFractionDigits: 2 })} across ${rows.length} entries` });
      await refreshFinanceDashboard();
    } catch (err: any) {
      toast({ title: "Upload Error", description: err.message, variant: "destructive" });
    } finally {
      setUploadingAds(false);
      e.target.value = "";
    }
  };

  // TURNS SALES CSV UPLOAD
  const handleTurnsCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingTurns(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) throw new Error("CSV is empty");

      const parseBruteforceCells = (line: string) => line.split('","').map((c) => c.replace(/"/g, "").trim());
      const ORDER_REF_INDEX = 0, CUSTOMER_NAME_INDEX = 1, MOBILE_INDEX = 2, ORDER_DATE_INDEX = 6, AMOUNT_INDEX = 25;
      const monthsMap: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

      const parsedRows: { date: string; amount: number; phone: string; sanitized_phone: string; customer_name: string; order_ref: string }[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cells = parseBruteforceCells(line);
        if (cells.length <= AMOUNT_INDEX) continue;
        const rawDate = (cells[ORDER_DATE_INDEX] || "").replace(/"/g, "").trim();
        const parts = rawDate.split("-");
        let date: string | null = null;
        if (parts.length === 3) {
          const dayStr = parts[0].padStart(2, "0");
          const monthKey = parts[1].slice(0, 1).toUpperCase() + parts[1].slice(1).toLowerCase();
          const monthNum = monthsMap[monthKey];
          const yearStr = parts[2];
          if (monthNum && /^\d{4}$/.test(yearStr)) date = `${yearStr}-${monthNum}-${dayStr}`;
        }
        const amount = parseFloat((cells[AMOUNT_INDEX] || "").replace(/[^0-9.]/g, ""));
        if (!date || !Number.isFinite(amount) || amount <= 0) continue;
        const phone = (cells[MOBILE_INDEX] || "").replace(/"/g, "").trim();
        const sanitized_phone = phone.replace(/\D/g, "");
        const customer_name = (cells[CUSTOMER_NAME_INDEX] || "").replace(/"/g, "").trim();
        const order_ref = (cells[ORDER_REF_INDEX] || "").replace(/"/g, "").trim();
        parsedRows.push({ date, amount, phone, sanitized_phone, customer_name, order_ref });
      }

      if (parsedRows.length === 0) throw new Error("No valid data rows found in Turns CSV");

      const { data: customers, error: customersError } = await supabase.from("customers").select("id, phone");
      if (customersError) throw customersError;
      const customerByPhone = new Map<string, string>();
      (customers || []).forEach((c) => { const key = (c.phone || "").replace(/\D/g, ""); if (key) customerByPhone.set(key, c.id); });

      const customerIds = Array.from(new Set(Array.from(customerByPhone.values())));
      const leadsByCustomer = new Map<string, { id: string; created_at: string }[]>();
      const chunkSize = 50;
      if (customerIds.length > 0) {
        for (let i = 0; i < customerIds.length; i += chunkSize) {
          const chunk = customerIds.slice(i, i + chunkSize);
          const { data: leadsChunk, error: leadsError } = await supabase.from("leads").select("id, customer_id, created_at").in("customer_id", chunk);
          if (leadsError) throw new Error(`Lead fetch error: ${leadsError.message}`);
          (leadsChunk || []).forEach((l) => {
            const arr = leadsByCustomer.get(l.customer_id) || [];
            arr.push({ id: l.id, created_at: l.created_at });
            leadsByCustomer.set(l.customer_id, arr);
          });
        }
      }

      const upsertRows = parsedRows.map((r) => {
        const normalizedPhone = r.sanitized_phone.length > 10 ? r.sanitized_phone.slice(-10) : r.sanitized_phone;
        const customerId = customerByPhone.get(normalizedPhone) || customerByPhone.get(r.sanitized_phone) || null;
        let matched_lead_id: string | null = null;
        if (customerId) {
          const customerLeads = leadsByCustomer.get(customerId) || [];
          if (customerLeads.length > 0) {
            const saleDate = new Date(r.date).getTime();
            let closest = customerLeads[0];
            let closestDiff = Math.abs(new Date(closest.created_at).getTime() - saleDate);
            customerLeads.forEach((l) => {
              const diff = Math.abs(new Date(l.created_at).getTime() - saleDate);
              if (diff < closestDiff) { closest = l; closestDiff = diff; }
            });
            matched_lead_id = closest.id;
          }
        }
        return { date: r.date, order_ref: r.order_ref || "", customer_name: r.customer_name || null, phone: r.phone || null, sanitized_phone: r.sanitized_phone || null, amount: r.amount, matched_lead_id, matched_at: matched_lead_id ? new Date().toISOString() : null };
      });

      const orderRefs = upsertRows.map((r) => r.order_ref).filter(Boolean);
      if (orderRefs.length > 0) {
        for (let i = 0; i < orderRefs.length; i += chunkSize) {
          const chunk = orderRefs.slice(i, i + chunkSize);
          await supabase.from("turns_sales").delete().in("order_ref", chunk);
        }
      }

      for (let i = 0; i < upsertRows.length; i += 100) {
        const batch = upsertRows.slice(i, i + 100);
        const { error } = await supabase.from("turns_sales").insert(batch);
        if (error) throw error;
      }

      const totalAmount = parsedRows.reduce((s, r) => s + r.amount, 0);
      toast({ title: `✅ Synced ₹${totalAmount.toLocaleString("en-IN")} from ${parsedRows.length} Turns orders` });
      await refreshFinanceDashboard();
    } catch (err: any) {
      toast({ title: "Upload Error", description: err.message, variant: "destructive" });
    } finally {
      setUploadingTurns(false);
      e.target.value = "";
    }
  };

  const handleResetFinanceData = async () => {
    try {
      await supabase.from("meta_ad_spend").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("revenue_imports").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("turns_sales").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await refreshFinanceDashboard();
      toast({ title: "✅ Finance data has been reset." });
    } catch (err: any) {
      toast({ title: "Reset Error", description: err.message, variant: "destructive" });
    }
  };

  if (leadsLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-foreground">CEO Command Center</h1>
          {lastSyncTime && (
            <Badge variant="outline" className="gap-1.5 text-[10px] border-neon-border/40 text-mint">
              <Wifi className="h-3 w-3" />
              <span className="h-1.5 w-1.5 rounded-full bg-mint animate-pulse" />
              Synced {lastSyncTime}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Global Date Range Presets */}
          <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-0.5">
            {([
              { key: "all" as DatePreset, label: "Sep 25 – Now" },
              { key: "last_month" as DatePreset, label: "Last Month" },
              { key: "last_14" as DatePreset, label: "Last 14d" },
            ]).map((preset) => (
              <Button
                key={preset.key}
                variant={datePreset === preset.key ? "default" : "ghost"}
                size="sm"
                className="h-7 text-[11px] rounded-lg px-3"
                onClick={() => setDatePreset(preset.key)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <Button variant="outline" size="sm" className="gap-2 text-xs border-mint/30 text-mint hover:bg-mint/10" onClick={handleLiveSync} disabled={syncing}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {syncing ? "Syncing..." : "Sync Live"}
          </Button>

          <label className="cursor-pointer">
            <input type="file" accept=".csv" className="hidden" onChange={handleTurnsCsvUpload} disabled={uploadingTurns} />
            <Button variant="outline" size="sm" className="gap-2 text-xs pointer-events-none" asChild>
              <span>{uploadingTurns ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Turns CSV</span>
            </Button>
          </label>

          <label className="cursor-pointer">
            <input type="file" accept=".csv" className="hidden" onChange={handleAdCsvUpload} disabled={uploadingAds} />
            <Button variant="outline" size="sm" className="gap-2 text-xs pointer-events-none" asChild>
              <span>{uploadingAds ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Meta CSV</span>
            </Button>
          </label>
        </div>
      </div>

      {/* Date Range Indicator */}
      <div className="flex items-center gap-2">
        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">
          Showing: {new Date(dateRange.start).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} — {new Date(dateRange.end).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      </div>

      {/* 4-Tab Layout */}
      <Tabs defaultValue="executive" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 h-11 rounded-2xl bg-secondary/50">
          <TabsTrigger value="executive" className="rounded-xl text-xs font-semibold gap-1.5 data-[state=active]:shadow-md">
            <Target className="h-3.5 w-3.5" />
            Executive P&L
          </TabsTrigger>
          <TabsTrigger value="ads" className="rounded-xl text-xs font-semibold gap-1.5 data-[state=active]:shadow-md">
            <BarChart3 className="h-3.5 w-3.5" />
            360° Ad Intel
          </TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-xl text-xs font-semibold gap-1.5 data-[state=active]:shadow-md">
            <CalendarDays className="h-3.5 w-3.5" />
            Daily Cashflow
          </TabsTrigger>
          <TabsTrigger value="ai" className="rounded-xl text-xs font-semibold gap-1.5 data-[state=active]:shadow-md">
            <Brain className="h-3.5 w-3.5" />
            AI CFO
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: EXECUTIVE P&L */}
        <TabsContent value="executive" className="space-y-6">
          {/* P&L Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <div className="neu-raised-neon p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <DollarSign className="h-4 w-4 icon-recessed" />
                <span className="text-[10px] font-medium uppercase tracking-wider">Revenue</span>
                <span className="ml-auto flex items-center gap-1 text-[9px] text-mint font-medium"><span className="h-1.5 w-1.5 rounded-full bg-mint animate-pulse" /> Live</span>
              </div>
              <p className="text-2xl font-bold text-foreground">₹{pnl.turnsRevenue.toLocaleString("en-IN")}</p>
            </div>
            <div className="neu-raised-neon p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <BarChart3 className="h-4 w-4 icon-recessed" />
                <span className="text-[10px] font-medium uppercase tracking-wider">Ad Spend</span>
              </div>
              <p className="text-2xl font-bold text-destructive">₹{pnl.totalAdSpend.toLocaleString("en-IN")}</p>
            </div>
            <div className="neu-raised-yellow p-5">
              <div className="flex items-center gap-2 text-soft-yellow-foreground mb-2">
                <BarChart3 className="h-4 w-4 icon-recessed" />
                <span className="text-[10px] font-medium uppercase tracking-wider">COGS</span>
              </div>
              <p className="text-2xl font-bold text-soft-yellow-foreground">₹{pnl.totalMaterialCost.toLocaleString("en-IN")}</p>
            </div>
            <div className="neu-raised-neon p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingUp className="h-4 w-4 icon-recessed" />
                <span className="text-[10px] font-medium uppercase tracking-wider">Profit</span>
              </div>
              <p className={`text-2xl font-bold ${pnl.realProfit >= 0 ? "text-mint" : "text-destructive"}`}>
                ₹{pnl.realProfit.toLocaleString("en-IN")}
              </p>
              <p className={`text-[10px] font-medium ${pnl.realProfit >= 0 ? "text-mint/70" : "text-destructive/70"}`}>{profitMargin} margin</p>
            </div>
          </div>

          {/* Gross ROAS */}
          <Card className="neu-raised-neon">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">Gross ROAS</p>
                <p className="text-xs text-muted-foreground">Revenue ÷ Ad Spend</p>
              </div>
              <div className="text-right">
                <p className={`text-4xl font-bold ${grossRoas >= 2 ? "text-mint" : grossRoas >= 1 ? "text-foreground" : "text-destructive"}`}>
                  {grossRoas > 0 ? `${grossRoas.toFixed(2)}x` : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {grossRoas >= 3 ? "🔥 Excellent" : grossRoas >= 2 ? "✅ Good" : grossRoas >= 1 ? "⚠️ Break-even" : grossRoas > 0 ? "🚨 Below target" : "No ad data"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* MoM Chart */}
          <Card className="neu-raised-neon">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Month-over-Month Performance</CardTitle>
            </CardHeader>
            <CardContent className="h-72 px-2">
              {momChartData.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-muted-foreground">Upload data to see MoM trends</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={momChartData} barGap={6}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 88%)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(215, 15%, 55%)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(215, 15%, 55%)" />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number, name: string) => [
                        `₹${value.toLocaleString("en-IN")}`,
                        name === "revenue" ? "Revenue" : name === "spend" ? "Ad Spend" : "Profit",
                      ]}
                    />
                    <Bar dataKey="revenue" fill="hsl(170, 50%, 55%)" radius={[10, 10, 0, 0]} name="revenue" />
                    <Bar dataKey="spend" fill="hsl(48, 80%, 78%)" radius={[10, 10, 0, 0]} name="spend" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Monthly Breakdown Table */}
          <Card className="neu-raised-neon">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Monthly Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neon-border/20">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground uppercase tracking-wider text-xs">Month</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">Revenue</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">Ad Spend</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">ROAS</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {momChartData.filter((m) => m.revenue > 0 || m.spend > 0).map((m) => (
                      <tr key={m.month} className="border-b border-neon-border/10 last:border-0">
                        <td className="px-4 py-2.5 font-medium text-foreground">{m.month}</td>
                        <td className="px-4 py-2.5 text-right text-mint font-semibold">₹{m.revenue.toLocaleString("en-IN")}</td>
                        <td className="px-4 py-2.5 text-right text-destructive font-semibold">₹{m.spend.toLocaleString("en-IN")}</td>
                        <td className="px-4 py-2.5 text-right">
                          {m.spend > 0 ? (
                            <Badge variant={m.roas >= 2 ? "default" : m.roas >= 1 ? "secondary" : "destructive"} className="rounded-full text-xs">
                              {m.roas.toFixed(2)}x
                            </Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${m.profit >= 0 ? "text-mint" : "text-destructive"}`}>
                          ₹{m.profit.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: 360° AD INTELLIGENCE */}
        <TabsContent value="ads" className="space-y-6">
          <AdsIntelligence
            adSpend={adSpend as any[]}
            dateFilter={isInRange}
            turnsRevenue={pnl.turnsRevenue}
          />
        </TabsContent>

        {/* TAB 3: DAILY CASHFLOW */}
        <TabsContent value="timeline" className="space-y-6">
          <div className="text-center space-y-1 mb-4">
            <h2 className="text-lg font-bold text-foreground">Daily Cashflow</h2>
            <p className="text-xs text-muted-foreground">Revenue vs Spend — newest first</p>
          </div>

          {dailyTimelineData.length === 0 ? (
            <Card className="neu-raised-neon">
              <CardContent className="flex h-40 items-center justify-center">
                <p className="text-sm text-muted-foreground">No data for selected period</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="neu-raised-neon">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neon-border/20">
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground uppercase tracking-wider text-xs">Date</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">Revenue</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">Ad Spend</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">Profit</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">Active Ads</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyTimelineData.map((d) => (
                        <tr key={d.date} className="border-b border-neon-border/10 last:border-0">
                          <td className="px-4 py-2.5 font-medium text-foreground">{d.dateLabel}</td>
                          <td className="px-4 py-2.5 text-right text-mint font-semibold">
                            {d.revenue > 0 ? `₹${d.revenue.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right text-destructive font-semibold">
                            {d.spend > 0 ? `₹${d.spend.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${d.profit >= 0 ? "text-mint" : "text-destructive"}`}>
                            {(d.revenue > 0 || d.spend > 0) ? `₹${d.profit.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">
                            {d.adCount > 0 ? d.adCount : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB 4: AI CFO */}
        <TabsContent value="ai" className="space-y-6">
          <AiAuditor
            turnsRevenue={pnl.turnsRevenue}
            totalAdSpend={pnl.totalAdSpend}
            materialCogs={pnl.totalMaterialCost}
            realProfit={pnl.realProfit}
            profitMargin={profitMargin}
            topAd={topAd as any}
            worstAd={worstAd as any}
          />
        </TabsContent>
      </Tabs>

      {/* Reset */}
      <div className="flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" />
              Reset All Data
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>This will delete all Meta Spend, Turns Sales, and Revenue data. Cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetFinanceData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Yes, Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default Finance;
