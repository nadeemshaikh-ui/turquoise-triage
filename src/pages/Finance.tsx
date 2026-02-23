import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Upload, DollarSign, TrendingUp, Users, BarChart3, Settings2, CalendarIcon, ToggleLeft, ToggleRight } from "lucide-react";
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
import { format as fnsFormat, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, isWithinInterval } from "date-fns";

const Finance = () => {
  const queryClient = useQueryClient();
  const [uploadingAds, setUploadingAds] = useState(false);
  const [uploadingRevenue, setUploadingRevenue] = useState(false);
  const [laborValue, setLaborValue] = useState<string | null>(null);
  const [savingLabor, setSavingLabor] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [includeHistorical, setIncludeHistorical] = useState(true);

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

  // Imported revenue
  const { data: revenueImports = [] } = useQuery({
    queryKey: ["finance-revenue-imports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue_imports")
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

  // App settings (labor cost)
  const { data: settings = [] } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*");
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

  const laborCostSetting = (settings as any[]).find((s) => s.key === "artisan_labor_per_order");
  const laborCost = Number(laborCostSetting?.value || 150);

  // Initialize labor input
  if (laborValue === null && laborCostSetting) {
    setLaborValue(laborCostSetting.value);
  }

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
  const filteredImports = useMemo(() => includeHistorical ? (revenueImports as any[]).filter((r) => isInRange(r.date)) : [], [revenueImports, dateFrom, dateTo, includeHistorical]);
  const filteredAdSpend = useMemo(() => (adSpend as any[]).filter((a) => isInRange(a.date)), [adSpend, dateFrom, dateTo]);

  // Compute P&L
  const pnl = useMemo(() => {
    const leadRevenue = filteredLeads.reduce((s, l: any) => s + Number(l.quoted_price), 0);
    const importedRevenue = filteredImports.reduce((s, r: any) => s + Number(r.amount), 0);
    const totalRevenue = leadRevenue + importedRevenue;

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

    const totalOrders = filteredLeads.length + filteredImports.length;
    const totalLaborCost = totalOrders * laborCost;
    const netProfit = totalRevenue - totalMaterialCost - totalLaborCost;

    return { totalRevenue, totalMaterialCost, totalLaborCost, netProfit, orderCount: totalOrders, importedRevenue };
  }, [filteredLeads, filteredImports, recipes, laborCost]);

  // ROAS chart data
  const roasChartData = useMemo(() => {
    const now = new Date();
    const months = eachMonthOfInterval({
      start: subMonths(startOfMonth(now), 5),
      end: endOfMonth(now),
    });

    return months.map((month) => {
      const monthLabel = fnsFormat(month, "MMM yy");
      const monthEnd = endOfMonth(month);

      const leadRev = filteredLeads
        .filter((l: any) => {
          const d = new Date(l.created_at);
          return d >= month && d <= monthEnd;
        })
        .reduce((s, l: any) => s + Number(l.quoted_price), 0);

      const importRev = filteredImports
        .filter((r) => {
          const d = new Date(r.date);
          return d >= month && d <= monthEnd;
        })
        .reduce((s, r: any) => s + Number(r.amount), 0);

      const revenue = leadRev + importRev;

      const spend = filteredAdSpend
        .filter((a) => {
          const d = new Date(a.date);
          return d >= month && d <= monthEnd;
        })
        .reduce((s, a: any) => s + Number(a.amount_spent), 0);

      return { month: monthLabel, revenue, spend };
    });
  }, [filteredLeads, filteredImports, filteredAdSpend]);

  // CSV upload handlers
  const handleAdCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAds(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) throw new Error("CSV is empty");

      // Auto-detect delimiter: tab or comma
      const delimiter = lines.some((l) => l.includes("\t")) ? "\t" : ",";

      // Find the header row (contains "date" and "amount" columns)
      let headerIdx = -1;
      let dateCol = -1;
      let amountCol = -1;
      for (let i = 0; i < Math.min(lines.length, 20); i++) {
        const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/"/g, "").toLowerCase());
        const dIdx = cols.findIndex((c) => c === "date" || c.includes("date") || c.includes("day"));
        const aIdx = cols.findIndex((c) => c === "amount" || c.includes("spend") || c.includes("amount") || c.includes("cost"));
        if (dIdx >= 0 && aIdx >= 0) {
          headerIdx = i;
          dateCol = dIdx;
          amountCol = aIdx;
          break;
        }
      }
      if (headerIdx < 0) throw new Error("CSV must have 'date' and 'amount/spend/cost' columns");

      // Summary phrases to ignore
      const summaryPhrases = ["total amount billed", "total funds added", "gst amount", "tds amount", "vat rate", "tds rate"];

      const parsedRows = lines.slice(headerIdx + 1).map((line) => {
        if (summaryPhrases.some((phrase) => line.toLowerCase().includes(phrase))) return null;

        const cells = delimiter === "\t"
          ? line.split("\t").map((c) => c.trim().replace(/"/g, ""))
          : (() => {
              // For comma-delimited, split on first comma only (2-col format)
              const firstComma = line.indexOf(",");
              if (firstComma < 0) return [line.trim()];
              return [line.substring(0, firstComma).trim().replace(/"/g, ""), line.substring(firstComma + 1).replace(/"/g, "").trim()];
            })();

        const rawDate = cells[dateCol]?.trim() || "";
        const rawAmount = (cells[amountCol] || "").replace(/[₹,\s]/g, "").trim();

        // Only accept rows where the date column is a valid date
        const isDdMmYyyy = /^\d{1,2}-\d{1,2}-\d{4}$/.test(rawDate);
        const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate);
        if (!isDdMmYyyy && !isIsoDate) return null;

        const amount = parseFloat(rawAmount) || 0;
        if (amount <= 0) return null;

        let normalizedDate = rawDate;
        if (isDdMmYyyy) {
          const m = rawDate.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
          if (m) normalizedDate = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        }

        return { date: normalizedDate, amount_spent: amount };
      }).filter((r): r is { date: string; amount_spent: number } => r !== null && !!r.date && !isNaN(new Date(r.date).getTime()));

      if (parsedRows.length === 0) throw new Error("No valid rows found");

      // Sum by date for deduplication
      const byDate = new Map<string, number>();
      parsedRows.forEach((r) => {
        byDate.set(r.date, (byDate.get(r.date) || 0) + r.amount_spent);
      });

      const insertRows = Array.from(byDate.entries()).map(([date, amount_spent]) => ({
        date,
        amount_spent,
        campaign_name: "Meta Ads",
      }));

      const totalSpend = insertRows.reduce((s, r) => s + r.amount_spent, 0);
      const { error } = await supabase.from("meta_ad_spend").insert(insertRows);
      if (error) throw error;
      toast({ title: `✅ Total Spend Verified: ₹${totalSpend.toLocaleString("en-IN", { minimumFractionDigits: 2 })} across ${insertRows.length} days` });
      queryClient.invalidateQueries({ queryKey: ["finance-ad-spend"] });
    } catch (err: any) {
      toast({ title: "Upload Error", description: err.message, variant: "destructive" });
    } finally {
      setUploadingAds(false);
      e.target.value = "";
    }
  };

  const handleRevenueCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingRevenue(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) throw new Error("CSV is empty");

      const header = lines[0];
      // Detect TurnsApp format vs simple date,revenue format
      const isTurnsApp = header.includes("Order Creation Date") || header.includes("Order Status");

      let rows: { date: string; order_ref?: string; customer_name?: string; amount: number }[] = [];

      if (isTurnsApp) {
        // Parse TurnsApp CSV (comma-separated, quoted fields)
        const parseCSVLine = (line: string) => {
          const result: string[] = [];
          let current = "";
          let inQuotes = false;
          for (const char of line) {
            if (char === '"') { inQuotes = !inQuotes; }
            else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ""; }
            else { current += char; }
          }
          result.push(current.trim());
          return result;
        };

        const headerCols = parseCSVLine(lines[0]);
        const orderIdx = headerCols.findIndex((c) => c === "Order");
        const nameIdx = headerCols.findIndex((c) => c === "Customer Name");
        const dateIdx = headerCols.findIndex((c) => c === "Order Creation Date");
        const amountIdx = headerCols.findIndex((c) => c === "Amount");

        for (let i = 1; i < lines.length; i++) {
          const vals = parseCSVLine(lines[i]);
          const orderRef = vals[orderIdx]?.trim();
          if (!orderRef) continue; // Skip total/empty rows
          const rawDate = vals[dateIdx]?.trim();
          const rawAmount = vals[amountIdx]?.replace(/[₹,\s]/g, "")?.trim();
          const amount = parseFloat(rawAmount) || 0;

          // Parse date "31-Jan-2026" format
          const parsedDate = new Date(rawDate);
          if (isNaN(parsedDate.getTime())) continue;
          const dateStr = fnsFormat(parsedDate, "yyyy-MM-dd");

          rows.push({
            date: dateStr,
            order_ref: orderRef,
            customer_name: vals[nameIdx]?.trim(),
            amount,
          });
        }
      } else {
        // Simple date,revenue format
        const cols = lines[0].toLowerCase().split(",").map((c) => c.trim().replace(/"/g, ""));
        const dateIdx = cols.findIndex((c) => c.includes("date"));
        const revIdx = cols.findIndex((c) => c.includes("revenue") || c.includes("amount"));
        if (dateIdx < 0 || revIdx < 0) throw new Error("CSV must have 'date' and 'revenue/amount' columns");

        rows = lines.slice(1).map((line) => {
          const vals = line.split(",").map((v) => v.trim().replace(/"/g, ""));
          return { date: vals[dateIdx], amount: parseFloat(vals[revIdx]) || 0 };
        }).filter((r) => r.date && !isNaN(new Date(r.date).getTime()));
      }

      if (rows.length === 0) throw new Error("No valid rows found");

      const insertRows = rows.map((r) => ({
        date: r.date,
        order_ref: r.order_ref || null,
        customer_name: r.customer_name || null,
        amount: r.amount,
        source: isTurnsApp ? "TurnsApp" : "CSV Import",
      }));

      const { error } = await supabase.from("revenue_imports").insert(insertRows);
      if (error) throw error;
      const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
      toast({ title: `✅ Successfully imported ₹${totalAmount.toLocaleString("en-IN")} revenue from ${rows.length} records` });
      queryClient.invalidateQueries({ queryKey: ["finance-revenue-imports"] });
      queryClient.invalidateQueries({ queryKey: ["finance-top-customers"] });
    } catch (err: any) {
      toast({ title: "Upload Error", description: err.message, variant: "destructive" });
    } finally {
      setUploadingRevenue(false);
      e.target.value = "";
    }
  };

  const handleLaborSave = async () => {
    if (!laborValue) return;
    setSavingLabor(true);
    try {
      if (laborCostSetting) {
        const { error } = await supabase.from("app_settings").update({ value: laborValue }).eq("id", laborCostSetting.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("app_settings").insert({ key: "artisan_labor_per_order", value: laborValue });
        if (error) throw error;
      }
      toast({ title: "✅ Labor cost updated" });
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingLabor(false);
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
        <h1 className="text-lg font-bold text-foreground">Finance & ROI</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("rounded-[28px] gap-2 text-xs", !dateFrom && "text-muted-foreground")}>
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
              <Button variant="outline" size="sm" className={cn("rounded-[28px] gap-2 text-xs", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateTo ? fnsFormat(dateTo, "dd MMM yyyy") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" className="rounded-[28px] text-xs h-8" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
              Clear
            </Button>
          )}
          <Button
            variant={includeHistorical ? "default" : "outline"}
            size="sm"
            className="rounded-[28px] text-xs gap-1.5"
            onClick={() => setIncludeHistorical(!includeHistorical)}
          >
            {includeHistorical ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
            Historical Revenue
          </Button>
        </div>
      </div>

      {/* P&L Summary Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(16_100%_50%/0.10)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">Total Revenue</span>
            </div>
            <p className="mt-1 text-xl font-bold text-primary">₹{pnl.totalRevenue.toLocaleString("en-IN")}</p>
            {pnl.importedRevenue > 0 && (
              <p className="text-[10px] text-muted-foreground">Incl. ₹{pnl.importedRevenue.toLocaleString("en-IN")} imported</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(16_100%_50%/0.10)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs font-medium">Material Costs</span>
            </div>
            <p className="mt-1 text-xl font-bold text-destructive">₹{pnl.totalMaterialCost.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(16_100%_50%/0.10)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">Labor ({pnl.orderCount} orders)</span>
            </div>
            <p className="mt-1 text-xl font-bold text-foreground">₹{pnl.totalLaborCost.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(16_100%_50%/0.10)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Net Profit</span>
            </div>
            <p className={`mt-1 text-xl font-bold ${pnl.netProfit >= 0 ? "text-primary" : "text-destructive"}`}>
              ₹{pnl.netProfit.toLocaleString("en-IN")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Labor Cost Setting inline */}
      <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(16_100%_50%/0.10)]">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Settings2 className="h-4 w-4" />
              <Label className="text-xs font-medium">Default Labor Cost (₹/order)</Label>
            </div>
            <Input
              type="number"
              value={laborValue ?? String(laborCost)}
              onChange={(e) => setLaborValue(e.target.value)}
              className="max-w-[120px] h-8 text-sm"
            />
            <Button
              onClick={handleLaborSave}
              disabled={savingLabor || laborValue === String(laborCost)}
              className="rounded-[28px] h-8"
              size="sm"
            >
              {savingLabor ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ROAS Chart */}
      <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(16_100%_50%/0.10)]">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">Revenue vs Ad Spend (ROAS)</CardTitle>
            <div className="flex gap-2">
              <label className="cursor-pointer">
                <input type="file" accept=".csv" className="hidden" onChange={handleRevenueCsvUpload} disabled={uploadingRevenue} />
                <Button variant="outline" size="sm" className="rounded-[28px] gap-2 pointer-events-none" asChild>
                  <span>
                    {uploadingRevenue ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Upload Revenue CSV
                  </span>
                </Button>
              </label>
              <label className="cursor-pointer">
                <input type="file" accept=".csv" className="hidden" onChange={handleAdCsvUpload} disabled={uploadingAds} />
                <Button variant="outline" size="sm" className="rounded-[28px] gap-2 pointer-events-none" asChild>
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
          {adSpend.length === 0 && revenueImports.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">Upload CSVs to see ROAS data</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roasChartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [
                    `₹${value.toLocaleString("en-IN")}`,
                    name === "revenue" ? "Revenue" : "Ad Spend",
                  ]}
                />
                <Bar dataKey="revenue" fill="hsl(16, 100%, 50%)" radius={[8, 8, 0, 0]} name="revenue" />
                <Bar dataKey="spend" fill="hsl(16, 100%, 35%)" radius={[8, 8, 0, 0]} name="spend" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Monthly Breakdown Table */}
      <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(16_100%_50%/0.10)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Month</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Revenue</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Ad Spend</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {roasChartData.filter((m) => m.revenue > 0 || m.spend > 0).map((m) => {
                  const roas = m.spend > 0 ? m.revenue / m.spend : 0;
                  return (
                    <tr key={m.month} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-medium text-foreground">{m.month}</td>
                      <td className="px-4 py-2.5 text-right text-primary font-semibold">₹{m.revenue.toLocaleString("en-IN")}</td>
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
      <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(16_100%_50%/0.10)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Top Customers by Lifetime Spend</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {topCustomers.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No completed orders yet</p>
          ) : (
            <div className="divide-y divide-border">
              {topCustomers.map((c, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.count} orders</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-primary">₹{c.total.toLocaleString("en-IN")}</p>
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
