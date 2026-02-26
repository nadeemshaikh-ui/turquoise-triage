import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Upload, DollarSign, TrendingUp, BarChart3, CalendarIcon, Trash2, RefreshCw, Wifi } from "lucide-react";
import RoasSentinel from "@/components/finance/RoasSentinel";
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
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { format as fnsFormat, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";

// Sanitize phone: remove +91, spaces, dashes, parens, dots
const sanitizePhone = (raw: string): string => {
  let p = raw.replace(/[\s\-().+]/g, "");
  if (p.startsWith("91") && p.length > 10) p = p.slice(p.length - 10);
  return p.slice(-10); // last 10 digits
};

// Month name map for DD-Mon-YYYY parsing
const MONTH_MAP: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

const Finance = () => {
  const queryClient = useQueryClient();
  const [uploadingAds, setUploadingAds] = useState(false);
  const [uploadingTurns, setUploadingTurns] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Revenue from completed leads (in-app)
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

  // Turns sales data
  const { data: turnsSales = [] } = useQuery({
    queryKey: ["finance-turns-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turns_sales")
        .select("*")
        .order("date");
      if (error) throw error;
      return data || [];
    },
  });

  // Material costs from recipes + inventory
  const { data: recipes = [] } = useQuery({
    queryKey: ["finance-recipes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_recipes")
        .select("service_id, quantity, inventory_items(cost_per_unit)");
      if (error) throw error;
      return data || [];
    },
  });

  // Ad spend data
  const { data: adSpend = [] } = useQuery({
    queryKey: ["finance-ad-spend"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_ad_spend")
        .select("*")
        .order("date");
      if (error) throw error;
      return data || [];
    },
  });

  // Top customers by lifetime spend
  const { data: topCustomers = [] } = useQuery({
    queryKey: ["finance-top-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("quoted_price, customer_id, customers(name, phone)")
        .in("status", ["Ready for Pickup", "Completed"]);
      if (error) throw error;
      const map = new Map<string, { name: string; phone: string; total: number; count: number }>();
      (data || []).forEach((l: any) => {
        const cid = l.customer_id;
        const existing = map.get(cid);
        if (existing) {
          existing.total += Number(l.quoted_price);
          existing.count += 1;
        } else {
          map.set(cid, {
            name: l.customers?.name || "Unknown",
            phone: l.customers?.phone || "",
            total: Number(l.quoted_price),
            count: 1,
          });
        }
      });
      return Array.from(map.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    },
  });

  // Helper: check if a date string is within the selected range
  const isInRange = (dateStr: string) => {
    if (!dateFrom && !dateTo) return true;
    const d = new Date(dateStr);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > new Date(dateTo.getTime() + 86400000 - 1)) return false;
    return true;
  };

  // Filtered data
  const filteredLeads = useMemo(() => leads.filter((l: any) => isInRange(l.created_at)), [leads, dateFrom, dateTo]);
  const filteredAdSpend = useMemo(() => (adSpend as any[]).filter((a) => isInRange(a.date)), [adSpend, dateFrom, dateTo]);
  const filteredTurnsSales = useMemo(() => (turnsSales as any[]).filter((t) => isInRange(t.date)), [turnsSales, dateFrom, dateTo]);

  const pnl = useMemo(() => {
    const turnsRevenue = filteredTurnsSales.reduce((s, t: any) => s + Number(t.amount), 0);
    const recipeCostByService = new Map<string, number>();
    (recipes as any[]).forEach((r: any) => {
      const cost = Number(r.quantity) * Number(r.inventory_items?.cost_per_unit || 0);
      const existing = recipeCostByService.get(r.service_id) || 0;
      recipeCostByService.set(r.service_id, existing + cost);
    });
    let totalMaterialCost = 0;
    filteredLeads.forEach((l: any) => {
      totalMaterialCost += recipeCostByService.get(l.service_id) || 0;
    });
    const totalAdSpend = filteredAdSpend.reduce((s, a: any) => s + Number(a.amount_spent), 0);
    const realProfit = turnsRevenue - totalAdSpend - totalMaterialCost;
    return { turnsRevenue, totalMaterialCost, totalAdSpend, realProfit };
  }, [filteredLeads, filteredTurnsSales, filteredAdSpend, recipes]);

  const roasChartData = useMemo(() => {
    const now = new Date();
    const months = eachMonthOfInterval({
      start: subMonths(startOfMonth(now), 5),
      end: endOfMonth(now),
    });
    return months.map((month) => {
      const monthLabel = fnsFormat(month, "MMM yy");
      const monthEnd = endOfMonth(month);
      const revenue = filteredTurnsSales
        .filter((t: any) => { const d = new Date(t.date); return d >= month && d <= monthEnd; })
        .reduce((s, t: any) => s + Number(t.amount), 0);
      const spend = filteredAdSpend
        .filter((a) => { const d = new Date(a.date); return d >= month && d <= monthEnd; })
        .reduce((s, a: any) => s + Number(a.amount_spent), 0);
      return { month: monthLabel, revenue, spend };
    });
  }, [filteredTurnsSales, filteredAdSpend]);

  // ═══════════════════════════════════════════════════
  // LIVE META SYNC
  // ═══════════════════════════════════════════════════
  const handleLiveSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-meta-data");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLastSyncTime(new Date().toLocaleTimeString());
      queryClient.invalidateQueries({ queryKey: ["finance-ad-spend"] });
      toast({
        title: "✅ Live Meta Sync Complete",
        description: data?.message || `Synced ${data?.synced || 0} rows`,
      });
    } catch (err: any) {
      toast({ title: "Sync Error", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  // ═══════════════════════════════════════════════════
  // CSV PARSER UTILITIES
  // ═══════════════════════════════════════════════════
  const parseCSVLine = (line: string, delimiter = ","): string[] => {
    if (delimiter === "\t") return line.split("\t").map((c) => c.trim().replace(/^"|"$/g, ""));
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === delimiter && !inQuotes) { result.push(current.trim()); current = ""; }
      else { current += char; }
    }
    result.push(current.trim());
    return result;
  };

  const cleanAmount = (raw: string): number => {
    const cleaned = raw.replace(/[^0-9.]/g, "").trim();
    return Math.abs(parseFloat(cleaned) || 0);
  };

  // Parse DD-Mon-YYYY (e.g. "01-Jan-2026") or DD-MM-YYYY or YYYY-MM-DD
  const parseFlexDate = (rawDate: string): string | null => {
    const trimmed = rawDate.replace(/"/g, "").trim();

    // DD-Mon-YYYY (e.g. 01-Jan-2026)
    const monMatch = trimmed.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (monMatch) {
      const mm = MONTH_MAP[monMatch[2].toLowerCase()];
      if (mm) return `${monMatch[3]}-${mm}-${monMatch[1].padStart(2, "0")}`;
    }

    // DD-MM-YYYY
    const ddmmMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (ddmmMatch) return `${ddmmMatch[3]}-${ddmmMatch[2].padStart(2, "0")}-${ddmmMatch[1].padStart(2, "0")}`;

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && !isNaN(new Date(trimmed).getTime())) return trimmed;

    // DD/MM/YYYY
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) return `${slashMatch[3]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[1].padStart(2, "0")}`;

    return null;
  };

  // ═══════════════════════════════════════════════════
  // META AD CSV UPLOAD (Historical)
  // ═══════════════════════════════════════════════════
  const handleAdCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAds(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) throw new Error("Invalid Format: CSV is empty");

      // Search-and-Skip: find the row that STARTS with "Date" (skip metadata/preamble)
      let headerIdx = -1;
      let delimiter = ",";
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].replace(/^["'\s]+/, "");
        if (/^date\b/i.test(trimmed)) {
          headerIdx = i;
          delimiter = lines[i].includes("\t") ? "\t" : ",";
          break;
        }
      }
      if (headerIdx < 0) throw new Error("Invalid Format: Could not find a header row starting with 'Date'. Make sure your CSV has Date and Amount columns.");

      const headerCols = parseCSVLine(lines[headerIdx], delimiter).map((c) => c.replace(/"/g, "").toLowerCase());
      const dateCol = headerCols.findIndex((c) => c === "date" || c.includes("date"));
      const amountCol = headerCols.findIndex((c) => c === "amount" || c.includes("spend") || c.includes("amount") || c.includes("cost"));
      if (dateCol < 0 || amountCol < 0) throw new Error("Invalid Format: Could not find Date and Amount/Spend columns");

      const campaignCol = headerCols.findIndex((c) => c.includes("campaign"));
      const impressionsCol = headerCols.findIndex((c) => c.includes("impression"));
      const clicksCol = headerCols.findIndex((c) => c.includes("click"));

      const skipPhrases = ["total", "gst", "tds", "vat", "funds added"];

      const parsedRows = lines.slice(headerIdx + 1).map((line) => {
        const lower = line.toLowerCase();
        if (skipPhrases.some((phrase) => lower.includes(phrase))) return null;

        const cells = parseCSVLine(line, delimiter);
        const rawDate = (cells[dateCol] || "").replace(/"/g, "").trim();
        const amount = cleanAmount(cells[amountCol] || "");
        if (amount <= 0) return null;

        const normalizedDate = parseFlexDate(rawDate);
        if (!normalizedDate) return null;

        return {
          date: normalizedDate,
          amount_spent: amount,
          campaign_name: campaignCol >= 0 ? (cells[campaignCol] || "").replace(/"/g, "").trim() || "Meta Ads" : "Meta Ads",
          impressions: impressionsCol >= 0 ? parseInt((cells[impressionsCol] || "").replace(/["₹,\s]/g, "")) || 0 : 0,
          clicks: clicksCol >= 0 ? parseInt((cells[clicksCol] || "").replace(/["₹,\s]/g, "")) || 0 : 0,
        };
      }).filter((r): r is NonNullable<typeof r> => r !== null && !isNaN(new Date(r.date).getTime()));

      if (parsedRows.length === 0) throw new Error("No valid data rows found. Check that your file has Date and Amount columns with valid values.");

      // Sum by date+campaign for deduplication
      const byKey = new Map<string, { amount_spent: number; campaign_name: string; impressions: number; clicks: number }>();
      parsedRows.forEach((r) => {
        const key = `${r.date}|${r.campaign_name}`;
        const existing = byKey.get(key);
        if (existing) {
          existing.amount_spent += r.amount_spent;
          existing.impressions += r.impressions;
          existing.clicks += r.clicks;
        } else {
          byKey.set(key, { ...r });
        }
      });

      const insertRows = Array.from(byKey.entries()).map(([key, data]) => ({
        date: key.split("|")[0],
        amount_spent: data.amount_spent,
        campaign_name: data.campaign_name,
        impressions: data.impressions,
        clicks: data.clicks,
      }));

      const totalSpend = insertRows.reduce((s, r) => s + r.amount_spent, 0);
      const { error } = await supabase.from("meta_ad_spend").insert(insertRows);
      if (error) throw error;
      toast({ title: `✅ Successfully synced ₹${totalSpend.toLocaleString("en-IN", { minimumFractionDigits: 2 })} across ${insertRows.length} entries` });
      queryClient.invalidateQueries({ queryKey: ["finance-ad-spend"] });
    } catch (err: any) {
      toast({ title: "Upload Error", description: err.message, variant: "destructive" });
    } finally {
      setUploadingAds(false);
      e.target.value = "";
    }
  };

  // ═══════════════════════════════════════════════════
  // TURNS SALES CSV UPLOAD
  // ═══════════════════════════════════════════════════
  const handleTurnsCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingTurns(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) throw new Error("CSV is empty");

      // Find header row (search-and-skip)
      let headerIdx = -1;
      let headerCols: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]).map((c) => c.toLowerCase().replace(/"/g, ""));
        if (cols.some((c) => c.includes("date")) && cols.some((c) => c.includes("amount") || c.includes("total") || c.includes("price"))) {
          headerIdx = i;
          headerCols = cols;
          break;
        }
      }
      if (headerIdx < 0) throw new Error("Invalid Turns CSV: must contain Date and Amount/Total columns");

      // Flexible column matching for Turns format
      const dateCol = headerCols.findIndex((c) => c.includes("order") && c.includes("date")) >= 0
        ? headerCols.findIndex((c) => c.includes("order") && c.includes("date"))
        : headerCols.findIndex((c) => c.includes("date"));
      const amountCol = headerCols.findIndex((c) => c === "amount" || c.includes("amount") || c.includes("total") || c.includes("price"));
      const phoneCol = headerCols.findIndex((c) => c.includes("phone") || c.includes("mobile") || c.includes("contact"));
      const nameCol = headerCols.findIndex((c) => c.includes("customer") || c.includes("name") || c.includes("client"));
      const orderCol = headerCols.findIndex((c) => c.includes("order") && !c.includes("date") || c.includes("invoice") || c.includes("ref"));

      const skipPhrases = ["total", "gst", "tds", "subtotal", "grand total"];
      const rows: { date: string; amount: number; phone: string; sanitized_phone: string; customer_name: string; order_ref: string }[] = [];

      for (let i = headerIdx + 1; i < lines.length; i++) {
        const lower = lines[i].toLowerCase();
        if (skipPhrases.some((p) => lower.includes(p))) continue;

        const cells = parseCSVLine(lines[i]);
        const rawDate = (cells[dateCol] || "").replace(/"/g, "").trim();
        const amount = cleanAmount(cells[amountCol] || "");
        if (amount <= 0) continue;

        // Parse date flexibly (DD-Mon-YYYY, DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD)
        const dateStr = parseFlexDate(rawDate);
        if (!dateStr || isNaN(new Date(dateStr).getTime())) continue;

        const rawPhone = phoneCol >= 0 ? (cells[phoneCol] || "").replace(/"/g, "").trim() : "";
        const sPhone = sanitizePhone(rawPhone);
        const custName = nameCol >= 0 ? (cells[nameCol] || "").replace(/"/g, "").trim() : "";
        const orderRef = orderCol >= 0 ? (cells[orderCol] || "").replace(/"/g, "").trim() : "";

        rows.push({ date: dateStr, amount, phone: rawPhone, sanitized_phone: sPhone, customer_name: custName, order_ref: orderRef });
      }

      if (rows.length === 0) throw new Error("No valid data rows found in Turns CSV");

      // Fetch customers for phone matching
      const { data: customers } = await supabase.from("customers").select("id, phone, name");
      const customerByPhone = new Map<string, { id: string; name: string }>();
      (customers || []).forEach((c) => {
        const sp = sanitizePhone(c.phone);
        if (sp.length >= 10) customerByPhone.set(sp, { id: c.id, name: c.name });
      });

      // Fetch recent leads (30-day window) for matching
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: recentLeads } = await supabase
        .from("leads")
        .select("id, customer_id, created_at, quoted_price")
        .gte("created_at", thirtyDaysAgo.toISOString());
      const leadsByCustomer = new Map<string, { id: string; created_at: string }[]>();
      (recentLeads || []).forEach((l) => {
        const arr = leadsByCustomer.get(l.customer_id) || [];
        arr.push({ id: l.id, created_at: l.created_at });
        leadsByCustomer.set(l.customer_id, arr);
      });

      let matchedCount = 0;
      const insertRows = rows.map((r) => {
        let matched_lead_id: string | null = null;
        if (r.sanitized_phone.length >= 10) {
          const customer = customerByPhone.get(r.sanitized_phone);
          if (customer) {
            const customerLeads = leadsByCustomer.get(customer.id);
            if (customerLeads && customerLeads.length > 0) {
              const saleDate = new Date(r.date).getTime();
              let closest = customerLeads[0];
              let closestDiff = Math.abs(new Date(closest.created_at).getTime() - saleDate);
              customerLeads.forEach((l) => {
                const diff = Math.abs(new Date(l.created_at).getTime() - saleDate);
                if (diff < closestDiff) { closest = l; closestDiff = diff; }
              });
              if (closestDiff <= 30 * 24 * 60 * 60 * 1000) {
                matched_lead_id = closest.id;
                matchedCount++;
              }
            }
          }
        }
        return {
          date: r.date,
          order_ref: r.order_ref || null,
          customer_name: r.customer_name || null,
          phone: r.phone || null,
          sanitized_phone: r.sanitized_phone || null,
          amount: r.amount,
          matched_lead_id,
          matched_at: matched_lead_id ? new Date().toISOString() : null,
        };
      });

      const { error } = await supabase.from("turns_sales").insert(insertRows);
      if (error) throw error;

      const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
      toast({
        title: `✅ Synced ₹${totalAmount.toLocaleString("en-IN")} from ${rows.length} Turns orders`,
        description: `${matchedCount} orders matched to leads via phone number`,
      });
      queryClient.invalidateQueries({ queryKey: ["finance-turns-sales"] });
    } catch (err: any) {
      toast({ title: "Upload Error", description: err.message, variant: "destructive" });
    } finally {
      setUploadingTurns(false);
      e.target.value = "";
    }
  };

  const handleResetFinanceData = async () => {
    try {
      const { error: e1 } = await supabase.from("meta_ad_spend").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("revenue_imports").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (e2) throw e2;
      const { error: e3 } = await supabase.from("turns_sales").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (e3) throw e3;
      queryClient.invalidateQueries({ queryKey: ["finance-ad-spend"] });
      queryClient.invalidateQueries({ queryKey: ["finance-revenue-imports"] });
      queryClient.invalidateQueries({ queryKey: ["finance-turns-sales"] });
      queryClient.invalidateQueries({ queryKey: ["finance-top-customers"] });
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground">Finance & ROI</h1>
          {/* Live Sync Indicator */}
          {lastSyncTime && (
            <Badge variant="outline" className="gap-1.5 text-[10px] border-neon-border/40 text-mint">
              <Wifi className="h-3 w-3" />
              <span className="h-1.5 w-1.5 rounded-full bg-mint animate-pulse" />
              Synced {lastSyncTime}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Live Meta Sync Button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs border-mint/30 text-mint hover:bg-mint/10"
            onClick={handleLiveSync}
            disabled={syncing}
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {syncing ? "Syncing..." : "Sync Live Data"}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-2 text-xs", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateFrom ? fnsFormat(dateFrom, "dd MMM yyyy") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">–</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-2 text-xs", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateTo ? fnsFormat(dateTo, "dd MMM yyyy") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* P&L Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="neu-raised-neon p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="h-4 w-4 icon-recessed" />
            <span className="text-xs font-medium uppercase tracking-wider">Turns Revenue</span>
            <span className="ml-auto flex items-center gap-1 text-[9px] text-mint font-medium"><span className="h-1.5 w-1.5 rounded-full bg-mint animate-pulse" /> Live</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-foreground">₹{pnl.turnsRevenue.toLocaleString("en-IN")}</p>
        </div>

        <div className="neu-raised-neon p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BarChart3 className="h-4 w-4 icon-recessed" />
            <span className="text-xs font-medium uppercase tracking-wider">Meta Ad Spend</span>
            {lastSyncTime && (
              <span className="ml-auto flex items-center gap-1 text-[9px] text-mint font-medium">
                <Wifi className="h-2.5 w-2.5" /> API
              </span>
            )}
          </div>
          <p className="mt-2 text-2xl font-semibold text-destructive">₹{pnl.totalAdSpend.toLocaleString("en-IN")}</p>
        </div>

        <div className="neu-raised-yellow p-4">
          <div className="flex items-center gap-2 text-soft-yellow-foreground">
            <BarChart3 className="h-4 w-4 icon-recessed" />
            <span className="text-xs font-medium uppercase tracking-wider">Material COGS</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-soft-yellow-foreground">₹{pnl.totalMaterialCost.toLocaleString("en-IN")}</p>
        </div>

        <div className="neu-raised-neon p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4 icon-recessed" />
            <span className="text-xs font-medium uppercase tracking-wider">Real Profit</span>
          </div>
          <p className={`mt-2 text-2xl font-semibold ${pnl.realProfit >= 0 ? "text-mint" : "text-destructive"}`}>
            ₹{pnl.realProfit.toLocaleString("en-IN")}
          </p>
          <p className={`text-[10px] font-medium ${pnl.realProfit >= 0 ? "text-mint/70" : "text-destructive/70"}`}>
            {pnl.turnsRevenue > 0 ? `${((pnl.realProfit / pnl.turnsRevenue) * 100).toFixed(1)}% margin` : "—"}
          </p>
          <p className="text-[9px] text-muted-foreground mt-1">Revenue − Ad Spend − COGS</p>
        </div>
      </div>

      {/* ROAS Sentinel */}
      <RoasSentinel
        turnsSales={turnsSales as any[]}
        adSpend={adSpend as any[]}
        dateFilter={isInRange}
      />

      {/* AI Auditor */}
      <AiAuditor
        turnsRevenue={pnl.turnsRevenue}
        totalAdSpend={pnl.totalAdSpend}
        materialCogs={pnl.totalMaterialCost}
        realProfit={pnl.realProfit}
        profitMargin={pnl.turnsRevenue > 0 ? `${((pnl.realProfit / pnl.turnsRevenue) * 100).toFixed(1)}%` : "N/A"}
      />

      {/* Reset Finance Data */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5" />
            Reset All Finance Data
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all uploaded Meta Spend, Turns Sales, and Historical Revenue data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetFinanceData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, Reset Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="neu-raised-neon">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">Revenue vs Ad Spend (ROAS)</CardTitle>
            <div className="flex flex-wrap gap-2">
              <label className="cursor-pointer">
                <input type="file" accept=".csv" className="hidden" onChange={handleTurnsCsvUpload} disabled={uploadingTurns} />
                <Button variant="outline" size="sm" className="gap-2 pointer-events-none" asChild>
                  <span>
                    {uploadingTurns ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Upload Turns CSV
                  </span>
                </Button>
              </label>
              <label className="cursor-pointer">
                <input type="file" accept=".csv" className="hidden" onChange={handleAdCsvUpload} disabled={uploadingAds} />
                <Button variant="outline" size="sm" className="gap-2 pointer-events-none" asChild>
                  <span>
                    {uploadingAds ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Upload Meta CSV
                  </span>
                </Button>
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-64 px-2">
          {adSpend.length === 0 && turnsSales.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">Upload CSVs or Sync Live Data to see ROAS</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roasChartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 88%)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(215, 15%, 55%)" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(215, 15%, 55%)" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: "1px solid hsl(186, 60%, 75%, 0.35)",
                    background: "hsl(220, 16%, 95%)",
                    fontSize: 12,
                    boxShadow: "4px 4px 10px hsl(220, 20%, 84%), -4px -4px 10px hsl(0, 0%, 100%)",
                  }}
                  formatter={(value: number, name: string) => [
                    `₹${value.toLocaleString("en-IN")}`,
                    name === "revenue" ? "Revenue" : "Ad Spend",
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
                </tr>
              </thead>
              <tbody>
                {roasChartData.filter((m) => m.revenue > 0 || m.spend > 0).map((m) => {
                  const roas = m.spend > 0 ? m.revenue / m.spend : 0;
                  return (
                    <tr key={m.month} className="border-b border-neon-border/10 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-foreground">{m.month}</td>
                      <td className="px-4 py-2.5 text-right text-mint font-semibold">₹{m.revenue.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-2.5 text-right text-destructive font-semibold">₹{m.spend.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-2.5 text-right">
                        {m.spend > 0 ? (
                          <Badge variant={roas >= 2 ? "default" : roas >= 1 ? "secondary" : "destructive"} className="rounded-full text-xs">
                            {roas.toFixed(2)}x
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {roasChartData.every((m) => m.revenue === 0 && m.spend === 0) && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No data for this period</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Card className="neu-raised-yellow">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-soft-yellow-foreground">Top Customers by Lifetime Spend</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {topCustomers.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No completed orders yet</p>
          ) : (
            <div className="divide-y divide-neon-border/15">
              {topCustomers.map((c, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="neu-pressed flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.count} orders</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-mint">₹{c.total.toLocaleString("en-IN")}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Finance;
