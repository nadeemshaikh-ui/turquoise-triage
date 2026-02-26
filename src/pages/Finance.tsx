import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, DollarSign, TrendingUp, BarChart3, Trash2, RefreshCw, Wifi, Target, Brain, CalendarDays, Settings, ShoppingCart, Users, Repeat, ArrowLeft, AlertTriangle, UserX, CalendarIcon, Download, MessageSquare } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";
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
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, ComposedChart,
} from "recharts";
import { format as fnsFormat, endOfMonth, eachMonthOfInterval, subDays, subMonths, startOfMonth, differenceInDays, eachDayOfInterval } from "date-fns";

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

// DatePreset type removed — replaced by calendar range picker

// Keyword mining categories
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Sneaker: ["sneaker", "shoe", "trainer", "footwear", "kicks", "jordan", "nike", "yeezy", "adidas"],
  Bag: ["bag", "handbag", "purse", "clutch", "tote", "backpack", "wallet", "luggage"],
  Leather: ["leather", "hide", "suede", "nubuck"],
  Laundry: ["laundry", "wash", "dry clean", "iron", "press"],
};

const categorizeServiceDetails = (text: string): string => {
  const lower = (text || "").toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return category;
  }
  return "Other";
};

const Finance = () => {
  const queryClient = useQueryClient();
  const [uploadingAds, setUploadingAds] = useState(false);
  const [uploadingTurns, setUploadingTurns] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>({
    from: new Date("2025-09-01"),
    to: new Date(),
  });
  const [selectedAds, setSelectedAds] = useState<AdStat[]>([]);
  const [drilldownMonth, setDrilldownMonth] = useState<string | null>(null);

  // Settings dialog state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [metaToken, setMetaToken] = useState("");
  const [metaAdAccountId, setMetaAdAccountId] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Crash-safe date range from calendar
  const dateRange = useMemo(() => {
    const from = calendarRange?.from;
    const to = calendarRange?.to;
    return {
      start: from ? fnsFormat(from, "yyyy-MM-dd") : "2025-09-01",
      end: to ? fnsFormat(to, "yyyy-MM-dd") : fnsFormat(new Date(), "yyyy-MM-dd"),
    };
  }, [calendarRange]);

  // CSV export helper
  const downloadCSV = (data: Record<string, any>[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(","),
      ...data.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  // WhatsApp CRM helper
  const getWhatsAppUrl = (name: string, phone: string) => {
    const tenDigits = phone.replace(/\D/g, "").slice(-10);
    const message = `Hi ${name}, we missed you at Restoree! Here is a special 15% discount for your next sneaker or bag restoration.`;
    return `https://wa.me/91${tenDigits}?text=${encodeURIComponent(message)}`;
  };

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
  const mer = pnl.totalAdSpend > 0 ? pnl.turnsRevenue / pnl.totalAdSpend : 0;

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

  // Keyword mining on service_details
  const categoryData = useMemo(() => {
    const cats: Record<string, { volume: number; revenue: number }> = {};
    filteredTurnsSales.forEach((t: any) => {
      const cat = categorizeServiceDetails((t as any).service_details || "");
      if (!cats[cat]) cats[cat] = { volume: 0, revenue: 0 };
      cats[cat].volume += 1;
      cats[cat].revenue += Number(t.amount);
    });
    return cats;
  }, [filteredTurnsSales]);

  // MoM category data for cannibalization
  const categoryMomData = useMemo(() => {
    const monthCats = new Map<string, Record<string, { volume: number; revenue: number }>>();
    (turnsSales as any[]).forEach((t: any) => {
      const monthKey = t.date.substring(0, 7);
      const cat = categorizeServiceDetails((t as any).service_details || "");
      if (!monthCats.has(monthKey)) monthCats.set(monthKey, {});
      const mc = monthCats.get(monthKey)!;
      if (!mc[cat]) mc[cat] = { volume: 0, revenue: 0 };
      mc[cat].volume += 1;
      mc[cat].revenue += Number(t.amount);
    });
    const months = Array.from(monthCats.keys()).sort();
    return { months, data: monthCats };
  }, [turnsSales]);

  // Cannibalization alert
  const cannibalizationAlert = useMemo(() => {
    const { months, data } = categoryMomData;
    if (months.length < 2) return null;
    const prev = data.get(months[months.length - 2]);
    const curr = data.get(months[months.length - 1]);
    if (!prev || !curr) return null;
    const sneakerVolGrowth = (curr["Sneaker"]?.volume || 0) - (prev["Sneaker"]?.volume || 0);
    const bagRevGrowth = (curr["Bag"]?.revenue || 0) - (prev["Bag"]?.revenue || 0);
    if (sneakerVolGrowth > 0 && bagRevGrowth < 0) {
      return "Margin Risk: High-volume sneakers are displacing high-margin bags. Consider rebalancing marketing spend.";
    }
    return null;
  }, [categoryMomData]);

  // Churn list (customers inactive > 45 days)
  const churnData = useMemo(() => {
    const today = new Date();
    const phoneData = new Map<string, { name: string; phone: string; lastDate: string; ltv: number }>();
    (turnsSales as any[]).forEach((t: any) => {
      const phone = t.sanitized_phone || t.phone || "";
      if (!phone) return;
      const existing = phoneData.get(phone);
      if (!existing) {
        phoneData.set(phone, { name: t.customer_name || "Unknown", phone, lastDate: t.date, ltv: Number(t.amount) });
      } else {
        existing.ltv += Number(t.amount);
        if (t.date > existing.lastDate) {
          existing.lastDate = t.date;
          if (t.customer_name) existing.name = t.customer_name;
        }
      }
    });
    const churned = Array.from(phoneData.values())
      .filter((c) => differenceInDays(today, new Date(c.lastDate)) > 45)
      .sort((a, b) => b.ltv - a.ltv);
    return churned;
  }, [turnsSales]);

  // Cohort heatmap data
  const cohortData = useMemo(() => {
    const phoneFirstMonth = new Map<string, string>();
    const phoneMonthRevenue = new Map<string, Map<string, number>>();
    const sorted = [...(turnsSales as any[])].sort((a, b) => a.date.localeCompare(b.date));
    sorted.forEach((t: any) => {
      const phone = t.sanitized_phone || t.phone || "";
      if (!phone) return;
      const monthKey = t.date.substring(0, 7);
      if (!phoneFirstMonth.has(phone)) phoneFirstMonth.set(phone, monthKey);
      if (!phoneMonthRevenue.has(phone)) phoneMonthRevenue.set(phone, new Map());
      const mr = phoneMonthRevenue.get(phone)!;
      mr.set(monthKey, (mr.get(monthKey) || 0) + Number(t.amount));
    });

    // Build cohort grid
    const acqMonths = Array.from(new Set(phoneFirstMonth.values())).sort();
    const allMonths = Array.from(new Set((turnsSales as any[]).map((t) => t.date.substring(0, 7)))).sort();
    const maxOffset = 6;

    const grid: { acqMonth: string; cells: number[] }[] = acqMonths.map((acqM) => {
      const cells: number[] = [];
      for (let offset = 0; offset <= maxOffset; offset++) {
        const acqDate = new Date(acqM + "-01");
        const targetMonth = fnsFormat(new Date(acqDate.getFullYear(), acqDate.getMonth() + offset, 1), "yyyy-MM");
        let revenue = 0;
        phoneFirstMonth.forEach((firstM, phone) => {
          if (firstM === acqM) {
            const mr = phoneMonthRevenue.get(phone);
            if (mr) revenue += mr.get(targetMonth) || 0;
          }
        });
        cells.push(Math.round(revenue));
      }
      return { acqMonth: acqM, cells };
    });

    return { grid, maxOffset };
  }, [turnsSales]);

  // Pareto chart data for operations
  const paretoData = useMemo(() => {
    return Object.entries(categoryData)
      .filter(([cat]) => cat !== "Other")
      .sort((a, b) => b[1].volume - a[1].volume)
      .map(([category, data]) => ({
        category,
        volume: data.volume,
        revenue: Math.round(data.revenue),
      }));
  }, [categoryData]);

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

  // P&L drilldown daily data
  const drilldownDailyData = useMemo(() => {
    if (!drilldownMonth) return [];
    const monthStart = new Date(drilldownMonth + "-01");
    const monthEnd = endOfMonth(monthStart);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    return days.map((day) => {
      const dateStr = fnsFormat(day, "yyyy-MM-dd");
      const revenue = (turnsSales as any[]).filter((t) => t.date === dateStr).reduce((s, t: any) => s + Number(t.amount), 0);
      const spend = (adSpend as any[]).filter((a) => a.date === dateStr).reduce((s, a: any) => s + Number(a.amount_spent), 0);
      return { date: fnsFormat(day, "dd MMM"), revenue: Math.round(revenue), spend: Math.round(spend) };
    });
  }, [drilldownMonth, turnsSales, adSpend]);

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
            const monthKey = dateParts[1].slice(0, 1).toUpperCase() + dateParts[1].slice(1).toLowerCase();
            if (monthMap[monthKey]) {
              formattedDate = `20${dateParts[2]}-${monthMap[monthKey]}-${dateParts[0].padStart(2, "0")}`;
            } else if (/^\d{4}$/.test(dateParts[0])) {
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

        const uniqueDates = [...new Set(rows.map((r) => r.date))];
        for (let i = 0; i < uniqueDates.length; i += CHUNK_SIZE) {
          const chunk = uniqueDates.slice(i, i + CHUNK_SIZE);
          await supabase.from("meta_ad_spend").delete().in("date", chunk).eq("ad_name", "Manual Meta CSV");
        }

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

  // TURNS SALES CSV UPLOAD — multi-file, strict parser, chunked, with service_details extraction
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
          service_details: headers.findIndex((h) => h.includes("order details") || h.includes("price list") || h.includes("item")),
        };

        // Fallback to positional if headers not found
        const parseBruteforceCells = (line: string) => line.split('","').map((c) => c.replace(/"/g, "").trim());

        const parsedRows: { date: string; amount: number; phone: string; sanitized_phone: string; customer_name: string; order_ref: string; qty: number; service_details: string }[] = [];

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
          const rawServiceDetails = colIdx.service_details >= 0 ? (cells[colIdx.service_details] || "") : "";

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

          parsedRows.push({ date, amount, phone, sanitized_phone, customer_name: rawName, order_ref: rawOrder, qty, service_details: rawServiceDetails });
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
            service_details: r.service_details || null,
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

  // Cohort heatmap color
  const getHeatColor = (value: number, max: number) => {
    if (value === 0 || max === 0) return "transparent";
    const intensity = Math.min(value / max, 1);
    return `hsl(170, 50%, ${85 - intensity * 40}%)`;
  };
  const cohortMax = Math.max(...cohortData.grid.flatMap((r) => r.cells), 1);

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
          {/* Date Range Picker */}
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2 text-[11px] px-3">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {calendarRange?.from ? (
                    calendarRange.to ? (
                      <>{fnsFormat(calendarRange.from, "dd MMM yy")} – {fnsFormat(calendarRange.to, "dd MMM yy")}</>
                    ) : (
                      fnsFormat(calendarRange.from, "dd MMM yy")
                    )
                  ) : (
                    "Pick dates"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={calendarRange}
                  onSelect={setCalendarRange}
                  numberOfMonths={2}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2" onClick={() => setCalendarRange({ from: subDays(new Date(), 7), to: new Date() })}>7d</Button>
            <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2" onClick={() => setCalendarRange({ from: subDays(new Date(), 30), to: new Date() })}>30d</Button>
            <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2" onClick={() => setCalendarRange({ from: new Date("2025-09-01"), to: new Date() })}>All</Button>
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

      {/* 5-Tab Layout */}
      <Tabs defaultValue="executive" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 h-11 rounded-2xl bg-secondary/50">
          <TabsTrigger value="executive" className="rounded-xl text-xs font-semibold gap-1.5 data-[state=active]:shadow-md">
            <Target className="h-3.5 w-3.5" />
            P&L
          </TabsTrigger>
          <TabsTrigger value="ads" className="rounded-xl text-xs font-semibold gap-1.5 data-[state=active]:shadow-md">
            <BarChart3 className="h-3.5 w-3.5" />
            Creative
          </TabsTrigger>
          <TabsTrigger value="operations" className="rounded-xl text-xs font-semibold gap-1.5 data-[state=active]:shadow-md">
            <ShoppingCart className="h-3.5 w-3.5" />
            Operations
          </TabsTrigger>
          <TabsTrigger value="cohorts" className="rounded-xl text-xs font-semibold gap-1.5 data-[state=active]:shadow-md">
            <Users className="h-3.5 w-3.5" />
            Cohorts
          </TabsTrigger>
          <TabsTrigger value="ai" className="rounded-xl text-xs font-semibold gap-1.5 data-[state=active]:shadow-md">
            <Brain className="h-3.5 w-3.5" />
            AI CFO
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: EXECUTIVE P&L */}
        <TabsContent value="executive" className="space-y-6">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
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
                <span className="text-[10px] font-medium uppercase tracking-wider">Contribution Margin</span>
              </div>
              <p className={`text-2xl font-bold ${pnl.realProfit >= 0 ? "text-mint" : "text-destructive"}`}>
                ₹{pnl.realProfit.toLocaleString("en-IN")}
              </p>
              <p className={`text-[10px] font-medium ${pnl.realProfit >= 0 ? "text-mint/70" : "text-destructive/70"}`}>{profitMargin} margin</p>
            </div>
            <div className="neu-raised-neon p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingUp className="h-4 w-4 icon-recessed" />
                <span className="text-[10px] font-medium uppercase tracking-wider">MER</span>
              </div>
              <p className={`text-2xl font-bold ${mer >= 2 ? "text-mint" : mer >= 1 ? "text-foreground" : "text-destructive"}`}>
                {mer > 0 ? `${mer.toFixed(2)}x` : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">Revenue ÷ Total Ad Spend</p>
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

          {/* Monthly Breakdown with Deep Dive */}
          <Card className="neu-raised-neon">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  {drilldownMonth ? `Daily Deep Dive — ${drilldownMonth}` : "Monthly Breakdown"}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {!drilldownMonth && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => downloadCSV(momChartData.filter(m => m.revenue > 0 || m.spend > 0).map(m => ({ Month: m.month, Revenue: m.revenue, Spend: m.spend, ROAS: m.roas.toFixed(2), Profit: m.profit })), "pnl-monthly.csv")}>
                      <Download className="h-3.5 w-3.5" /> CSV
                    </Button>
                  )}
                  {drilldownMonth && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setDrilldownMonth(null)}>
                      <ArrowLeft className="h-3.5 w-3.5" /> Back
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {drilldownMonth ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={drilldownDailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 88%)" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(215, 15%, 55%)" interval="preserveStartEnd" />
                      <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 10 }} stroke="hsl(215, 15%, 55%)" />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="hsl(215, 15%, 55%)" />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`₹${value.toLocaleString("en-IN")}`, name === "revenue" ? "Revenue" : "Ad Spend"]} />
                      <Bar yAxisId="left" dataKey="revenue" fill="hsl(170, 50%, 55%)" radius={[8, 8, 0, 0]} name="revenue" />
                      <Line yAxisId="right" type="monotone" dataKey="spend" stroke="hsl(0, 70%, 60%)" strokeWidth={2} dot={false} name="spend" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neon-border/20">
                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground uppercase tracking-wider text-xs">Month</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">Revenue</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">Ad Spend</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">ROAS</th>
                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">Net Profit</th>
                        <th className="px-4 py-2.5 text-center font-medium text-muted-foreground uppercase tracking-wider text-xs"></th>
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
                          <td className="px-4 py-2.5 text-center">
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary" onClick={() => setDrilldownMonth(m.monthKey)}>
                              Deep Dive
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: CREATIVE INTEL */}
        <TabsContent value="ads" className="space-y-6">
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => downloadCSV(adStatsForAi.map(a => ({ "Ad Name": a.ad_name, Spend: Math.round(a.spend), Clicks: a.clicks, CTR: a.ctr.toFixed(2), CPC: a.cpc.toFixed(2) })), "creative-performance.csv")}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
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

          {/* Cannibalization Alert */}
          {cannibalizationAlert && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Cannibalization Warning</AlertTitle>
              <AlertDescription>{cannibalizationAlert}</AlertDescription>
            </Alert>
          )}

          {/* Pareto Chart */}
          {paretoData.length > 0 && (
            <Card className="neu-raised-neon">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Service Category Pareto</CardTitle>
              </CardHeader>
              <CardContent className="h-64 px-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={paretoData} barGap={6}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 88%)" />
                    <XAxis dataKey="category" tick={{ fontSize: 11 }} stroke="hsl(215, 15%, 55%)" />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="hsl(215, 15%, 55%)" />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="hsl(215, 15%, 55%)" />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [name === "revenue" ? `₹${value.toLocaleString("en-IN")}` : value, name === "revenue" ? "Revenue" : "Volume"]} />
                    <Bar yAxisId="left" dataKey="volume" fill="hsl(186, 60%, 55%)" radius={[8, 8, 0, 0]} name="volume" />
                    <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="hsl(170, 50%, 55%)" strokeWidth={2} dot name="revenue" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

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

        {/* TAB 4: COHORTS */}
        <TabsContent value="cohorts" className="space-y-6">
          {/* Repeat Rate + Churn Count */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
            <div className="neu-raised-neon p-5 text-center">
              <Repeat className="h-5 w-5 mx-auto mb-2 text-primary icon-recessed" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Repeat Rate</p>
              <p className="text-2xl font-bold text-foreground">{opsMetrics.repeatRate.toFixed(1)}%</p>
              <p className="text-[10px] text-muted-foreground">{opsMetrics.repeatPhones} of {opsMetrics.uniquePhones}</p>
            </div>
            <div className="neu-raised-neon p-5 text-center">
              <UserX className="h-5 w-5 mx-auto mb-2 text-destructive icon-recessed" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Churned (45d+)</p>
              <p className="text-2xl font-bold text-destructive">{churnData.length}</p>
              <p className="text-[10px] text-muted-foreground">Inactive customers</p>
            </div>
            <div className="neu-raised-neon p-5 text-center">
              <Users className="h-5 w-5 mx-auto mb-2 text-primary icon-recessed" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Active Customers</p>
              <p className="text-2xl font-bold text-foreground">{Math.max(opsMetrics.uniquePhones - churnData.length, 0)}</p>
            </div>
          </div>

          {/* Churn List */}
          <Card className="neu-raised-neon">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <UserX className="h-4 w-4 text-destructive" />
                  Churn List — WhatsApp Remarketing Targets
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => downloadCSV(churnData.map(c => ({ Name: c.name, Phone: c.phone, "Last Order": c.lastDate, LTV: Math.round(c.ltv) })), "churn-list.csv")}>
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b border-neon-border/20">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground uppercase tracking-wider text-xs">Customer</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground uppercase tracking-wider text-xs">Phone</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">Last Order</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">LTV</th>
                      <th className="px-4 py-2.5 text-center font-medium text-muted-foreground uppercase tracking-wider text-xs">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {churnData.slice(0, 50).map((c, i) => (
                      <tr key={i} className="border-b border-neon-border/10 last:border-0">
                        <td className="px-4 py-2.5 font-medium text-foreground">{c.name}</td>
                        <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{c.phone}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{new Date(c.lastDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                        <td className="px-4 py-2.5 text-right text-mint font-semibold">₹{Math.round(c.ltv).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-2.5 text-center">
                          <a href={getWhatsAppUrl(c.name, c.phone)} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary">
                              <MessageSquare className="h-3.5 w-3.5" /> Message Now
                            </Button>
                          </a>
                        </td>
                      </tr>
                    ))}
                    {churnData.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No churned customers</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Cohort Heatmap */}
          <Card className="neu-raised-neon">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Revenue Cohort Heatmap</CardTitle>
            </CardHeader>
            <CardContent>
              {cohortData.grid.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Upload Turns CSV to see cohort data</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className="px-2 py-2 text-left font-medium text-muted-foreground">Acq Month</th>
                        {Array.from({ length: cohortData.maxOffset + 1 }, (_, i) => (
                          <th key={i} className="px-2 py-2 text-center font-medium text-muted-foreground">M{i}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cohortData.grid.map((row) => (
                        <tr key={row.acqMonth}>
                          <td className="px-2 py-1.5 font-medium text-foreground whitespace-nowrap">{row.acqMonth}</td>
                          {row.cells.map((val, ci) => (
                            <td
                              key={ci}
                              className="px-2 py-1.5 text-center font-mono"
                              style={{
                                backgroundColor: getHeatColor(val, cohortMax),
                                color: val > cohortMax * 0.5 ? "hsl(0, 0%, 100%)" : "hsl(215, 15%, 35%)",
                              }}
                            >
                              {val > 0 ? `₹${(val / 1000).toFixed(0)}k` : "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: AI CFO */}
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
            mer={mer}
            categoryData={categoryData}
            churnCount={churnData.length}
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
