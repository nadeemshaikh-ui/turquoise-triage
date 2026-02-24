import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, Zap, ArrowUpRight, ArrowDownRight, Link2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

type TurnsSale = {
  id: string;
  date: string;
  amount: number;
  matched_lead_id: string | null;
  customer_name: string | null;
  phone: string | null;
  order_ref: string | null;
};

type AdSpend = {
  id: string;
  date: string;
  amount_spent: number;
  campaign_name: string | null;
  impressions: number | null;
  clicks: number | null;
};

type Props = {
  turnsSales: TurnsSale[];
  adSpend: AdSpend[];
  dateFilter: (dateStr: string) => boolean;
};

const RoasSentinel = ({ turnsSales, adSpend, dateFilter }: Props) => {
  const filtered = useMemo(() => {
    const fTurns = turnsSales.filter((t) => dateFilter(t.date));
    const fAds = adSpend.filter((a) => dateFilter(a.date));
    return { turns: fTurns, ads: fAds };
  }, [turnsSales, adSpend, dateFilter]);

  const stats = useMemo(() => {
    const matchedTurns = filtered.turns.filter((t) => t.matched_lead_id);
    const unmatchedTurns = filtered.turns.filter((t) => !t.matched_lead_id);
    const matchedRevenue = matchedTurns.reduce((s, t) => s + Number(t.amount), 0);
    const unmatchedRevenue = unmatchedTurns.reduce((s, t) => s + Number(t.amount), 0);
    const totalTurnsRevenue = matchedRevenue + unmatchedRevenue;
    const totalAdSpend = filtered.ads.reduce((s, a) => s + Number(a.amount_spent), 0);
    const roas = totalAdSpend > 0 ? matchedRevenue / totalAdSpend : 0;
    const matchRate = filtered.turns.length > 0 ? (matchedTurns.length / filtered.turns.length) * 100 : 0;

    return {
      matchedRevenue,
      unmatchedRevenue,
      totalTurnsRevenue,
      totalAdSpend,
      roas,
      matchRate,
      matchedCount: matchedTurns.length,
      totalCount: filtered.turns.length,
    };
  }, [filtered]);

  // Campaign profitability
  const campaignData = useMemo(() => {
    const campaignMap = new Map<string, { spend: number; impressions: number; clicks: number }>();
    filtered.ads.forEach((a) => {
      const name = a.campaign_name || "Unknown Campaign";
      const existing = campaignMap.get(name) || { spend: 0, impressions: 0, clicks: 0 };
      existing.spend += Number(a.amount_spent);
      existing.impressions += Number(a.impressions || 0);
      existing.clicks += Number(a.clicks || 0);
      campaignMap.set(name, existing);
    });

    // Distribute matched revenue proportionally across campaigns by spend share
    const totalSpend = Array.from(campaignMap.values()).reduce((s, c) => s + c.spend, 0);

    return Array.from(campaignMap.entries())
      .map(([name, data]) => {
        const revenueShare = totalSpend > 0 ? (data.spend / totalSpend) * stats.matchedRevenue : 0;
        const roas = data.spend > 0 ? revenueShare / data.spend : 0;
        const cpc = data.clicks > 0 ? data.spend / data.clicks : 0;
        return { name, spend: data.spend, revenue: revenueShare, roas, clicks: data.clicks, impressions: data.impressions, cpc };
      })
      .sort((a, b) => b.roas - a.roas);
  }, [filtered.ads, stats.matchedRevenue]);

  // Monthly attribution chart data
  const monthlyData = useMemo(() => {
    const monthMap = new Map<string, { matched: number; unmatched: number; spend: number }>();

    filtered.turns.forEach((t) => {
      const key = t.date.substring(0, 7); // YYYY-MM
      const existing = monthMap.get(key) || { matched: 0, unmatched: 0, spend: 0 };
      if (t.matched_lead_id) existing.matched += Number(t.amount);
      else existing.unmatched += Number(t.amount);
      monthMap.set(key, existing);
    });

    filtered.ads.forEach((a) => {
      const key = a.date.substring(0, 7);
      const existing = monthMap.get(key) || { matched: 0, unmatched: 0, spend: 0 };
      existing.spend += Number(a.amount_spent);
      monthMap.set(key, existing);
    });

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({
        month: new Date(month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        matched: Math.round(data.matched),
        unmatched: Math.round(data.unmatched),
        spend: Math.round(data.spend),
      }));
  }, [filtered]);

  const hasData = filtered.turns.length > 0 || filtered.ads.length > 0;

  if (!hasData) {
    return (
      <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(16_100%_50%/0.10)]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4 text-primary" />
            ROAS Sentinel
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-40 items-center justify-center">
          <p className="text-sm text-muted-foreground">Upload Turns Sales & Meta Ad CSVs to activate the Sentinel</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" />
        <h2 className="text-base font-bold text-foreground">ROAS Sentinel</h2>
        <Badge variant="outline" className="text-[10px]">Live Attribution</Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(16_100%_50%/0.10)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium">Matched Revenue</span>
            </div>
            <p className="mt-1 text-lg font-bold text-primary">₹{stats.matchedRevenue.toLocaleString("en-IN")}</p>
            <p className="text-[10px] text-muted-foreground">from {stats.matchedCount} matched orders</p>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(16_100%_50%/0.10)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium">ROAS</span>
            </div>
            <p className={`mt-1 text-lg font-bold ${stats.roas >= 2 ? "text-primary" : stats.roas >= 1 ? "text-foreground" : "text-destructive"}`}>
              {stats.roas > 0 ? `${stats.roas.toFixed(2)}x` : "—"}
            </p>
            <div className="flex items-center gap-1">
              {stats.roas >= 2 ? <ArrowUpRight className="h-3 w-3 text-primary" /> : stats.roas > 0 ? <ArrowDownRight className="h-3 w-3 text-destructive" /> : null}
              <span className="text-[10px] text-muted-foreground">
                {stats.roas >= 3 ? "Excellent" : stats.roas >= 2 ? "Good" : stats.roas >= 1 ? "Break-even" : stats.roas > 0 ? "Below target" : "No data"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(16_100%_50%/0.10)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium">Match Rate</span>
            </div>
            <p className="mt-1 text-lg font-bold text-foreground">{stats.matchRate.toFixed(0)}%</p>
            <p className="text-[10px] text-muted-foreground">{stats.matchedCount}/{stats.totalCount} orders linked</p>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(16_100%_50%/0.10)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium">Unmatched Revenue</span>
            </div>
            <p className="mt-1 text-lg font-bold text-muted-foreground">₹{stats.unmatchedRevenue.toLocaleString("en-IN")}</p>
            <p className="text-[10px] text-muted-foreground">organic / walk-in</p>
          </CardContent>
        </Card>
      </div>

      {/* Attribution Chart: Matched vs Unmatched vs Spend */}
      <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(16_100%_50%/0.10)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Revenue Attribution vs Ad Spend</CardTitle>
        </CardHeader>
        <CardContent className="h-64 px-2">
          {monthlyData.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">No data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barGap={2}>
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
                    name === "matched" ? "Matched Revenue" : name === "unmatched" ? "Unmatched Revenue" : "Ad Spend",
                  ]}
                />
                <Bar dataKey="matched" stackId="revenue" fill="hsl(16, 100%, 50%)" radius={[0, 0, 0, 0]} name="matched" />
                <Bar dataKey="unmatched" stackId="revenue" fill="hsl(16, 100%, 50%, 0.35)" radius={[8, 8, 0, 0]} name="unmatched" />
                <Bar dataKey="spend" fill="hsl(var(--destructive))" radius={[8, 8, 0, 0]} name="spend" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Campaign Profitability Table */}
      {campaignData.length > 0 && (
        <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(16_100%_50%/0.10)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Campaign Profitability</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Campaign</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Spend</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Attr. Revenue</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">ROAS</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">CPC</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignData.map((c, i) => (
                    <tr key={c.name} className={`border-b border-border last:border-0 ${i === 0 && c.roas > 0 ? "bg-primary/5" : ""}`}>
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          {c.name}
                          {i === 0 && c.roas > 0 && (
                            <Badge className="text-[10px] gap-0.5 bg-primary text-primary-foreground">
                              <Zap className="h-2.5 w-2.5" />
                              Top
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-destructive font-semibold">₹{c.spend.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-2.5 text-right text-primary font-semibold">₹{Math.round(c.revenue).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Badge variant={c.roas >= 2 ? "default" : c.roas >= 1 ? "secondary" : "destructive"} className="rounded-full text-xs">
                          {c.roas.toFixed(2)}x
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">
                        {c.cpc > 0 ? `₹${c.cpc.toFixed(0)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RoasSentinel;
