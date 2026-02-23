import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, DollarSign, TrendingUp, Users, BarChart3 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";

const Finance = () => {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  // Revenue from completed leads
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
      // Aggregate by customer
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

  const laborCost = Number(settings.find((s: any) => s.key === "artisan_labor_per_order")?.value || 150);

  // Compute P&L
  const pnl = useMemo(() => {
    const totalRevenue = leads.reduce((s, l: any) => s + Number(l.quoted_price), 0);

    // Material cost: for each lead, sum recipe quantities * cost_per_unit
    const recipeCostByService = new Map<string, number>();
    (recipes as any[]).forEach((r: any) => {
      const cost = Number(r.quantity) * Number(r.inventory_items?.cost_per_unit || 0);
      const existing = recipeCostByService.get(r.service_id) || 0;
      recipeCostByService.set(r.service_id, existing + cost);
    });

    let totalMaterialCost = 0;
    leads.forEach((l: any) => {
      totalMaterialCost += recipeCostByService.get(l.service_id) || 0;
    });

    const totalLaborCost = leads.length * laborCost;
    const netProfit = totalRevenue - totalMaterialCost - totalLaborCost;

    return { totalRevenue, totalMaterialCost, totalLaborCost, netProfit, orderCount: leads.length };
  }, [leads, recipes, laborCost]);

  // ROAS chart data: merge monthly revenue + ad spend
  const roasChartData = useMemo(() => {
    const now = new Date();
    const months = eachMonthOfInterval({
      start: subMonths(startOfMonth(now), 5),
      end: endOfMonth(now),
    });

    return months.map((month) => {
      const monthKey = format(month, "yyyy-MM");
      const monthLabel = format(month, "MMM yy");
      const monthEnd = endOfMonth(month);

      const revenue = leads
        .filter((l: any) => {
          const d = new Date(l.created_at);
          return d >= month && d <= monthEnd;
        })
        .reduce((s, l: any) => s + Number(l.quoted_price), 0);

      const spend = (adSpend as any[])
        .filter((a) => {
          const d = new Date(a.date);
          return d >= month && d <= monthEnd;
        })
        .reduce((s, a: any) => s + Number(a.amount_spent), 0);

      const roas = spend > 0 ? (revenue / spend).toFixed(1) : "-";

      return { month: monthLabel, revenue, spend, roas };
    });
  }, [leads, adSpend]);

  // CSV upload handler
  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) throw new Error("CSV is empty or has no data rows");

      const header = lines[0].toLowerCase();
      // Try to detect columns
      const cols = header.split(",").map((c) => c.trim().replace(/"/g, ""));
      const dateIdx = cols.findIndex((c) => c.includes("date") || c.includes("day"));
      const spendIdx = cols.findIndex((c) => c.includes("spend") || c.includes("amount") || c.includes("cost"));
      const campaignIdx = cols.findIndex((c) => c.includes("campaign") || c.includes("name"));
      const impressionsIdx = cols.findIndex((c) => c.includes("impression"));
      const clicksIdx = cols.findIndex((c) => c.includes("click"));

      if (dateIdx < 0 || spendIdx < 0) throw new Error("CSV must have 'date' and 'spend/amount/cost' columns");

      const rows = lines.slice(1).map((line) => {
        const vals = line.split(",").map((v) => v.trim().replace(/"/g, ""));
        return {
          date: vals[dateIdx],
          amount_spent: parseFloat(vals[spendIdx]) || 0,
          campaign_name: campaignIdx >= 0 ? vals[campaignIdx] : null,
          impressions: impressionsIdx >= 0 ? parseInt(vals[impressionsIdx]) || 0 : 0,
          clicks: clicksIdx >= 0 ? parseInt(vals[clicksIdx]) || 0 : 0,
        };
      }).filter((r) => r.date && !isNaN(new Date(r.date).getTime()));

      if (rows.length === 0) throw new Error("No valid rows found in CSV");

      const { error } = await supabase.from("meta_ad_spend").insert(rows);
      if (error) throw error;

      toast({ title: `✅ Uploaded ${rows.length} rows of ad spend data` });
      queryClient.invalidateQueries({ queryKey: ["finance-ad-spend"] });
    } catch (err: any) {
      toast({ title: "Upload Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
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
      <h1 className="text-lg font-bold text-foreground">Finance & ROI</h1>

      {/* P&L Summary Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(174_72%_56%/0.10)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">Total Revenue</span>
            </div>
            <p className="mt-1 text-xl font-bold text-primary">₹{pnl.totalRevenue.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(174_72%_56%/0.10)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs font-medium">Material Costs</span>
            </div>
            <p className="mt-1 text-xl font-bold text-destructive">₹{pnl.totalMaterialCost.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(174_72%_56%/0.10)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">Labor ({pnl.orderCount} orders)</span>
            </div>
            <p className="mt-1 text-xl font-bold text-foreground">₹{pnl.totalLaborCost.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(174_72%_56%/0.10)]">
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

      {/* ROAS Chart */}
      <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(174_72%_56%/0.10)]">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">Revenue vs Ad Spend (ROAS)</CardTitle>
            <label className="cursor-pointer">
              <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} disabled={uploading} />
              <Button variant="outline" size="sm" className="rounded-[28px] gap-2 pointer-events-none" asChild>
                <span>
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Upload Meta CSV
                </span>
              </Button>
            </label>
          </div>
        </CardHeader>
        <CardContent className="h-64 px-2">
          {adSpend.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">Upload your Meta Ads CSV to see ROAS data</p>
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
                <Bar dataKey="revenue" fill="hsl(174, 72%, 56%)" radius={[8, 8, 0, 0]} name="revenue" />
                <Bar dataKey="spend" fill="hsl(174, 72%, 36%)" radius={[8, 8, 0, 0]} name="spend" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top Customers */}
      <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(174_72%_56%/0.10)]">
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
