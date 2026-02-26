import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, DollarSign, TrendingUp, BarChart3, Trash2, RefreshCw, Wifi, Target, Brain, CalendarDays, Settings, ShoppingCart, Users, Repeat } from "lucide-react";
import AdsIntelligence, { AdStat } from "@/components/finance/AdsIntelligence";
import AiAuditor from "@/components/finance/AiAuditor";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
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

const monthMap: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

const CHUNK_SIZE = 50;

type DatePreset = "all" | "last_month" | "last_14" | "last_7" | "last_30" | "custom";

const Finance = () => {
  const queryClient = useQueryClient();
  const [uploadingAds, setUploadingAds] = useState(false);
  const [uploadingTurns, setUploadingTurns] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [selectedAds, setSelectedAds] = useState<AdStat[]>([]);

  // Settings dialog state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [metaToken, setMetaToken] = useState("");
  const [metaAdAccountId, setMetaAdAccountId] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Compute date range from preset
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (datePreset) {
      case "last_7":
        return { start: fnsFormat(subDays(now, 7), "yyyy-MM-dd"), end: fnsFormat(now, "yyyy-MM-dd") };
      case "last_14":
        return { start: fnsFormat(subDays(now, 14), "yyyy-MM-dd"), end: fnsFormat(now, "yyyy-MM-dd") };
      case "last_30":
        return { start: fnsFormat(subDays(now, 30), "yyyy-MM-dd"), end: fnsFormat(now, "yyyy-MM-dd") };
      case "last_month": {
        const lm = subMonths(now, 1);
        return { start: fnsFormat(startOfMonth(lm), "yyyy-MM-dd"), end: fnsFormat(endOfMonth(lm), "yyyy-MM-dd") };
      }
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

  // Filtered data
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
    filteredLeads.forEach((l: any) => { totalMaterialCost += recipeCostByService.get(l.service_id) || 0; });
    const totalAdSpend = filteredAdSpend.reduce((s, a: any) => s + Number(a.amount_spent), 0);
    const realProfit = turnsRevenue - totalAdSpend - totalMaterialCost;
    return { turnsRevenue, totalMaterialCost, totalAdSpend, realProfit };
  }, [filteredLeads, filteredTurnsSales, filteredAdSpend, recipes]);

  const profitMargin = pnl.turnsRevenue > 0 ? `${((pnl.realProfit / pnl.turnsRevenue) * 100).toFixed(1)}%` : "N/A";
  const grossRoas = pnl.totalAdSpend > 0 ? pnl.turnsRevenue / pnl.totalAdSpend : 0;

  // Operations metrics
  const opsMetrics = useMemo(() => {
    const totalRevenue = filteredTurnsSales.reduce((s, t: any) => s + Number(t.amount), 0);
    const totalOrders = filteredTurnsSales.length;
    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalQty = filteredTurnsSales.reduce((s, t: any) => s + Number((t as any).qty || 1), 0);

    // Repeat customer rate
    const phoneMap = new Map<string, number>();
    filteredTurnsSales.forEach((t: any) => {
      const phone = t.sanitized_phone || t.phone || "";
      if (phone) phoneMap.set(phone, (phoneMap.get(phone) || 0) + 1);
    });
    const uniquePhones = phoneMap.size;
    const repeatPhones = Array.from(phoneMap.values()).filter((c) => c > 1).length;
    const repeatRate = uniquePhones > 0 ? (repeatPhones / uniquePhones) * 100 : 0;

    // Top customers
    const customerMap = new Map<string, number>();
    filteredTurnsSales.forEach((t: any) => {
      const name = t.customer_name || "Unknown";
      customerMap.set(name, (customerMap.get(name) || 0) + Number(t.amount));
    });
    const topCustomers = Array.from(customerMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, amount]) => ({ name, amount }));

    return { aov, totalQty, totalOrders, repeatRate, uniquePhones, repeatPhones, topCustomers };
  }, [filteredTurnsSales]);

  // MoM chart data
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
      const monthEndDate = endOfMonth(month);
      const revenue = (turnsSales as any[])
        .filter((t) => { const d = new Date(t.date); return d >= month && d <= monthEndDate; })
        .reduce((s, t: any) => s + Number(t.amount), 0);
      const spend = (adSpend as any[])
        .filter((a) => { const d = new Date(a.date); return d >= month && d <= monthEndDate; })
        .reduce((s, a: any) => s + Number(a.amount_spent), 0);
      const profit = revenue - spend;
      const roas = spend > 0 ? revenue / spend : 0;
      return { month: fnsFormat(month, "MMM yy"), monthKey: fnsFormat(month, "yyyy-MM"), revenue: Math.round(revenue), spend: Math.round(spend), profit: Math.round(profit), roas };
    });
  }, [turnsSales, adSpend]);

  // Daily timeline data
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
        map.set(key, { ad_name: key, spend: Number(a.amount_spent), clicks: Number(a.clicks || 0), impressions: Number(a.impressions || 0), engagement: Number(a.engagement || 0) });
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
    return withClicks.length === 0 ? null : withClicks.sort((a, b) => a.cpc - b.cpc)[0];
  }, [adStatsForAi]);

  const worstAd = useMemo(() => {
    const highSpend = adStatsForAi.filter((a) => a.spend > 50);
    return highSpend.length === 0 ? null : highSpend.sort((a, b) => {
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

  // Save settings
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const value = JSON.stringify({ meta_access_token: metaToken, meta_ad_account_id: metaAdAccountId });
      const { error } = await supabase.from("app_settings").upsert({ key: "meta_config", value }, { onConflict: "key" });
      if (error) throw error;
      toast({ title: "✅ Settings saved" });
      setSettingsOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
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

  // META AD CSV UPLOAD — multi-file, strict parser, chunked
  const handleAdCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingAds(true);
    try {
      for (const file of Array.from(files)) {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        const rows: { date: string; amount_spent: number; ad_name: string; ad_id: string; campaign_name: string; reach: number; impressions: number; clicks: number; engagement: number }[] = [];

        for (const line of lines.slice(1)) {
          const cells = line.split(/[\t,]/).map((c) => c.replace(/"/g, "").trim());
          if (cells.length < 3) continue;
          const rawDate = cells[0] || "";
          const dateParts = rawDate.split("-");
          let formattedDate: string | null = null;

          if (dateParts.length === 3) {
            // Handle DD-Mon-YY or YYYY-MM-DD
            const monthKey = dateParts[1].slice(0, 1).toUpperCase() + dateParts[1].slice(1).toLowerCase();
            if (monthMap[monthKey]) {
              // DD-Mon-YY format
              formattedDate = `20${dateParts[2]}-${monthMap[monthKey]}-${dateParts[0].padStart(2, "0")}`;
            } else if (/^\d{4}$/.test(dateParts[0])) {
              // YYYY-MM-DD format
              formattedDate = rawDate;
            }
          }
          if (!formattedDate) continue;

          const amount = parseFloat((cells[2] || "").replace(/[^0-9.]/g, "")) || 0;
          if (amount <= 0) continue;

          const generatedId = `CSV-${formattedDate}-${amount}`;

          rows.push({
            date: formattedDate,
            amount_spent: amount,
            ad_name: cells[1] || "Manual Meta CSV",
            ad_id: generatedId,
            campaign_name: cells[1] || "Manual Meta CSV",
            reach: 0, impressions: 0, clicks: 0, engagement: 0,
          });
        }

        if (rows.length === 0) { toast({ title: `No valid rows in ${file.name}`, variant: "destructive" }); continue; }

        // Chunked idempotency: delete by unique dates
        const uniqueDates = [...new Set(rows.map((r) => r.date))];
        for (let i = 0; i < uniqueDates.length; i += CHUNK_SIZE) {
          const chunk = uniqueDates.slice(i, i + CHUNK_SIZE);
          await supabase.from("meta_ad_spend").delete().in("date", chunk).eq("ad_name", "Manual Meta CSV");
        }

        // Insert in chunks of 50
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const batch = rows.slice(i, i + CHUNK_SIZE);
          const { error } = await supabase.from("meta_ad_spend").insert(batch);
          if (error) throw error;
        }

        const totalSpend = rows.reduce((s, r) => s + r.amount_spent, 0);
        toast({ title: `✅ ${file.name}: ₹${totalSpend.toLocaleString("en-IN")} across ${rows.length} entries` });
      }
      await refreshFinanceDashboard();
    } catch (err: any) {
      toast({ title: "Upload Error", description: err.message, variant: "destructive" });
    } finally {
      setUploadingAds(false);
      e.target.value = "";
    }
  };

  // TURNS SALES CSV UPLOAD — multi-file, strict parser, chunked
  const handleTurnsCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingTurns(true);
    try {
      for (const file of Array.from(files)) {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) { toast({ title: `${file.name} is empty`, variant: "destructive" }); continue; }

        // Detect headers
        const headerLine = lines[0];
        const headers = headerLine.split(/[\t,]/).map((h) => h.replace(/"/g, "").trim().toLowerCase());
        const colIdx = {
          date: headers.findIndex((h) => h.includes("order creation date") || h.includes("date")),
          order_ref: headers.findIndex((h) => h === "order" || h.includes("order ref") || h.includes("order_ref")),
          phone: headers.findIndex((h) => h.includes("mobile") || h.includes("phone")),
          amount: headers.findIndex((h) => h === "amount" || h.includes("amount")),
          qty: headers.findIndex((h) => h === "qty" || h.includes("quantity")),
          customer_name: headers.findIndex((h) => h.includes("name") || h.includes("customer")),
        };

        // Fallback to positional if headers not found
        const parseBruteforceCells = (line: string) => line.split('","').map((c) => c.replace(/"/g, "").trim());

        const parsedRows: { date: string; amount: number; phone: string; sanitized_phone: string; customer_name: string; order_ref: string; qty: number }[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          let cells: string[];
          if (colIdx.date >= 0 && colIdx.amount >= 0) {
            cells = line.split(/[\t,]/).map((c) => c.replace(/"/g, "").trim());
          } else {
            cells = parseBruteforceCells(line);
          }

          // Get raw values
          const rawDate = colIdx.date >= 0 ? (cells[colIdx.date] || "") : (cells[6] || "");
          const rawAmount = colIdx.amount >= 0 ? (cells[colIdx.amount] || "") : (cells[25] || "");
          const rawPhone = colIdx.phone >= 0 ? (cells[colIdx.phone] || "") : (cells[2] || "");
          const rawName = colIdx.customer_name >= 0 ? (cells[colIdx.customer_name] || "") : (cells[1] || "");
          const rawOrder = colIdx.order_ref >= 0 ? (cells[colIdx.order_ref] || "") : (cells[0] || "");
          const rawQty = colIdx.qty >= 0 ? (cells[colIdx.qty] || "1") : "1";

          // Strict date parsing
          const parts = rawDate.split("-");
          let date: string | null = null;
          if (parts.length === 3) {
            const mk = parts[1].slice(0, 1).toUpperCase() + parts[1].slice(1).toLowerCase();
            const monthNum = monthMap[mk];
            if (monthNum) {
              const yearStr = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
              if (/^\d{4}$/.test(yearStr)) {
                date = `${yearStr}-${monthNum}-${parts[0].padStart(2, "0")}`;
              }
            } else if (/^\d{4}$/.test(parts[0])) {
              date = rawDate;
            }
          }

          const amount = parseFloat(rawAmount.replace(/[^0-9.]/g, "")) || 0;
          if (!date || amount <= 0) continue;

          const phone = rawPhone.replace(/"/g, "").trim();
          const sanitized_phone = sanitizePhone(phone);
          const qty = parseInt(rawQty.replace(/[^0-9]/g, "")) || 1;

          parsedRows.push({ date, amount, phone, sanitized_phone, customer_name: rawName, order_ref: rawOrder, qty });
        }

        if (parsedRows.length === 0) { toast({ title: `No valid rows in ${file.name}`, variant: "destructive" }); continue; }

        // Chunked deletion by order_ref
        const orderRefs = parsedRows.map((r) => r.order_ref).filter(Boolean);
        for (let i = 0; i < orderRefs.length; i += CHUNK_SIZE) {
          const chunk = orderRefs.slice(i, i + CHUNK_SIZE);
          await supabase.from("turns_sales").delete().in("order_ref", chunk);
        }

        // Chunked lead matching
        const { data: customers } = await supabase.from("customers").select("id, phone");
        const customerByPhone = new Map<string, string>();
        (customers || []).forEach((c) => { const key = (c.phone || "").replace(/\D/g, ""); if (key) customerByPhone.set(key, c.id); });
        const customerIds = Array.from(new Set(Array.from(customerByPhone.values())));
        const leadsByCustomer = new Map<string, { id: string; created_at: string }[]>();
        for (let i = 0; i < customerIds.length; i += CHUNK_SIZE) {
          const chunk = customerIds.slice(i, i + CHUNK_SIZE);
          const { data: leadsChunk } = await supabase.from("leads").select("id, customer_id, created_at").in("customer_id", chunk);
          (leadsChunk || []).forEach((l) => {
            const arr = leadsByCustomer.get(l.customer_id) || [];
            arr.push({ id: l.id, created_at: l.created_at });
            leadsByCustomer.set(l.customer_id, arr);
          });
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
          return {
            date: r.date, order_ref: r.order_ref || "", customer_name: r.customer_name || null,
            phone: r.phone || null, sanitized_phone: r.sanitized_phone || null, amount: r.amount,
            qty: r.qty, matched_lead_id, matched_at: matched_lead_id ? new Date().toISOString() : null,
          };
        });

        // Chunked inserts
        for (let i = 0; i < upsertRows.length; i += CHUNK_SIZE) {
          const batch = upsertRows.slice(i, i + CHUNK_SIZE);
          const { error } = await supabase.from("turns_sales").insert(batch);
          if (error) throw error;
        }

        const totalAmount = parsedRows.reduce((s, r) => s + r.amount, 0);
        toast({ title: `✅ ${file.name}: ₹${totalAmount.toLocaleString("en-IN")} from ${parsedRows.length} orders` });
      }
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
              { key: "last_7" as DatePreset, label: "7d" },
              { key: "last_14" as DatePreset, label: "14d" },
              { key: "last_30" as DatePreset, label: "30d" },
              { key: "all" as DatePreset, label: "Sep 25–Now" },
              { key: "last_month" as DatePreset, label: "Last Month" },
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

          {/* Settings Gear */}
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Meta API Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Meta Access Token</Label>
                  <Input type="password" placeholder="EAAx..." value={metaToken} onChange={(e) => setMetaToken(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Ad Account ID</Label>
                  <Input placeholder="717289587216194" value={metaAdAccountId} onChange={(e) => setMetaAdAccountId(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleSaveSettings} disabled={savingSettings}>
                  {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" className="gap-2 text-xs border-mint/30 text-mint hover:bg-mint/10" onClick={handleLiveSync} disabled={syncing}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {syncing ? "Syncing..." : "Sync Live"}
          </Button>

          <label className="cursor-pointer">
            <input type="file" accept=".csv" multiple className="hidden" onChange={handleTurnsCsvUpload} disabled={uploadingTurns} />
            <Button variant="outline" size="sm" className="gap-2 text-xs pointer-events-none" asChild>
              <span>{uploadingTurns ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Turns CSV</span>
            </Button>
          </label>

          <label className="cursor-pointer">
            <input type="file" accept=".csv" multiple className="hidden" onChange={handleAdCsvUpload} disabled={uploadingAds} />
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
            P&L
          </TabsTrigger>
          <TabsTrigger value="ads" className="rounded-xl text-xs font-semibold gap-1.5 data-[state=active]:shadow-md">
            <BarChart3 className="h-3.5 w-3.5" />
            Ad Intel
          </TabsTrigger>
          <TabsTrigger value="operations" className="rounded-xl text-xs font-semibold gap-1.5 data-[state=active]:shadow-md">
            <ShoppingCart className="h-3.5 w-3.5" />
            Operations
          </TabsTrigger>
          <TabsTrigger value="ai" className="rounded-xl text-xs font-semibold gap-1.5 data-[state=active]:shadow-md">
            <Brain className="h-3.5 w-3.5" />
            AI CFO
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: EXECUTIVE P&L */}
        <TabsContent value="executive" className="space-y-6">
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
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`₹${value.toLocaleString("en-IN")}`, name === "revenue" ? "Revenue" : name === "spend" ? "Ad Spend" : "Profit"]} />
                    <Bar dataKey="revenue" fill="hsl(170, 50%, 55%)" radius={[10, 10, 0, 0]} name="revenue" />
                    <Bar dataKey="spend" fill="hsl(48, 80%, 78%)" radius={[10, 10, 0, 0]} name="spend" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

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
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">Net Profit</th>
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
                            <Badge variant={m.roas >= 2 ? "default" : m.roas >= 1 ? "secondary" : "destructive"} className="rounded-full text-xs">{m.roas.toFixed(2)}x</Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${m.profit >= 0 ? "text-mint" : "text-destructive"}`}>₹{m.profit.toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: AD INTEL */}
        <TabsContent value="ads" className="space-y-6">
          <AdsIntelligence
            adSpend={adSpend as any[]}
            dateFilter={isInRange}
            turnsRevenue={pnl.turnsRevenue}
            leadsCount={filteredLeads.length}
            onSelectionChange={setSelectedAds}
          />
        </TabsContent>

        {/* TAB 3: OPERATIONS */}
        <TabsContent value="operations" className="space-y-6">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <div className="neu-raised-neon p-5 text-center">
              <ShoppingCart className="h-5 w-5 mx-auto mb-2 text-primary icon-recessed" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">AOV</p>
              <p className="text-2xl font-bold text-foreground">₹{Math.round(opsMetrics.aov).toLocaleString("en-IN")}</p>
              <p className="text-[10px] text-muted-foreground">{opsMetrics.totalOrders} orders</p>
            </div>
            <div className="neu-raised-neon p-5 text-center">
              <BarChart3 className="h-5 w-5 mx-auto mb-2 text-primary icon-recessed" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Units Served</p>
              <p className="text-2xl font-bold text-foreground">{opsMetrics.totalQty.toLocaleString("en-IN")}</p>
            </div>
            <div className="neu-raised-neon p-5 text-center">
              <Repeat className="h-5 w-5 mx-auto mb-2 text-primary icon-recessed" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Repeat Rate</p>
              <p className="text-2xl font-bold text-foreground">{opsMetrics.repeatRate.toFixed(1)}%</p>
              <p className="text-[10px] text-muted-foreground">{opsMetrics.repeatPhones} of {opsMetrics.uniquePhones}</p>
            </div>
            <div className="neu-raised-neon p-5 text-center">
              <Users className="h-5 w-5 mx-auto mb-2 text-primary icon-recessed" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Unique Customers</p>
              <p className="text-2xl font-bold text-foreground">{opsMetrics.uniquePhones.toLocaleString("en-IN")}</p>
            </div>
          </div>

          {/* Top Customers */}
          <Card className="neu-raised-neon">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Top Customers by Revenue</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neon-border/20">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground uppercase tracking-wider text-xs">#</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground uppercase tracking-wider text-xs">Customer</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opsMetrics.topCustomers.map((c, i) => (
                      <tr key={i} className="border-b border-neon-border/10 last:border-0">
                        <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-2.5 font-medium text-foreground">{c.name}</td>
                        <td className="px-4 py-2.5 text-right text-mint font-semibold">₹{Math.round(c.amount).toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                    {opsMetrics.topCustomers.length === 0 && (
                      <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No customer data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
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
            selectedAds={selectedAds}
            aov={opsMetrics.aov}
            totalOrders={opsMetrics.totalOrders}
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
