import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, Zap, AlertTriangle, ArrowDown, Eye, MousePointerClick, Users, DollarSign } from "lucide-react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

type AdSpendRow = {
  id: string;
  date: string;
  amount_spent: number;
  campaign_name: string | null;
  ad_name?: string | null;
  impressions: number | null;
  clicks: number | null;
  reach?: number | null;
  engagement?: number | null;
};

type Props = {
  adSpend: AdSpendRow[];
  dateFilter: (dateStr: string) => boolean;
  turnsRevenue: number;
};

const tooltipStyle = {
  borderRadius: 16,
  border: "1px solid hsl(186, 60%, 75%, 0.35)",
  background: "hsl(220, 16%, 95%)",
  fontSize: 12,
  boxShadow: "4px 4px 10px hsl(220, 20%, 84%), -4px -4px 10px hsl(0, 0%, 100%)",
};

const AdsIntelligence = ({ adSpend, dateFilter, turnsRevenue }: Props) => {
  const [viewMode, setViewMode] = useState<"ad" | "day">("ad");

  const filtered = useMemo(() => adSpend.filter((a) => dateFilter(a.date)), [adSpend, dateFilter]);

  // Aggregated ad-level stats
  const adStats = useMemo(() => {
    const map = new Map<string, {
      ad_name: string;
      campaign_name: string;
      spend: number;
      impressions: number;
      clicks: number;
      reach: number;
      engagement: number;
      days: number;
    }>();

    filtered.forEach((a) => {
      const key = viewMode === "ad" ? (a.ad_name || a.campaign_name || "Unknown") : a.date;
      const label = viewMode === "ad" ? (a.ad_name || a.campaign_name || "Unknown") : a.date;
      const existing = map.get(key);
      if (existing) {
        existing.spend += Number(a.amount_spent);
        existing.impressions += Number(a.impressions || 0);
        existing.clicks += Number(a.clicks || 0);
        existing.reach += Number(a.reach || 0);
        existing.engagement += Number(a.engagement || 0);
        existing.days += 1;
      } else {
        map.set(key, {
          ad_name: label,
          campaign_name: a.campaign_name || "",
          spend: Number(a.amount_spent),
          impressions: Number(a.impressions || 0),
          clicks: Number(a.clicks || 0),
          reach: Number(a.reach || 0),
          engagement: Number(a.engagement || 0),
          days: 1,
        });
      }
    });

    return Array.from(map.values())
      .map((a) => ({
        ...a,
        ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
        cpc: a.clicks > 0 ? a.spend / a.clicks : 0,
        frequency: a.reach > 0 ? a.impressions / a.reach : 0,
        isHighBurn: a.spend > 100 && a.clicks === 0,
      }))
      .sort((a, b) => b.spend - a.spend);
  }, [filtered, viewMode]);

  // Funnel data
  const funnel = useMemo(() => {
    const totalReach = filtered.reduce((s, a) => s + Number(a.reach || 0), 0);
    const totalImpressions = filtered.reduce((s, a) => s + Number(a.impressions || 0), 0);
    const totalClicks = filtered.reduce((s, a) => s + Number(a.clicks || 0), 0);
    return [
      { stage: "Reach", value: totalReach, icon: Users },
      { stage: "Impressions", value: totalImpressions, icon: Eye },
      { stage: "Clicks", value: totalClicks, icon: MousePointerClick },
      { stage: "Revenue", value: Math.round(turnsRevenue), icon: DollarSign },
    ];
  }, [filtered, turnsRevenue]);

  // Scatter data for spend vs engagement
  const scatterData = useMemo(() => {
    return adStats
      .filter((a) => a.spend > 0)
      .map((a) => ({
        name: a.ad_name.length > 25 ? a.ad_name.slice(0, 25) + "…" : a.ad_name,
        spend: Math.round(a.spend),
        engagement: a.engagement,
        clicks: a.clicks,
        ctr: a.ctr,
        isHighBurn: a.isHighBurn,
      }));
  }, [adStats]);

  if (filtered.length === 0) {
    return (
      <Card className="neu-raised-neon">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <BarChart3 className="h-4 w-4 icon-recessed" />
            360° Ads Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-32 items-center justify-center">
          <p className="text-sm text-muted-foreground">Sync Meta data to activate Ad Intelligence</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary icon-recessed" />
        <h2 className="text-base font-bold text-foreground">360° Ads Intelligence</h2>
        <Badge variant="outline" className="text-[10px] border-neon-border/40 text-dusty-blue">Ad-Level</Badge>
      </div>

      {/* Performance Funnel */}
      <Card className="neu-raised-neon">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Performance Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2">
            {funnel.map((step, i) => {
              const Icon = step.icon;
              const prevValue = i > 0 ? funnel[i - 1].value : null;
              const dropRate = prevValue && prevValue > 0 ? ((1 - step.value / prevValue) * 100) : null;
              return (
                <div key={step.stage} className="flex flex-1 items-center gap-1">
                  <div className="neu-raised p-3 rounded-2xl flex-1 text-center">
                    <Icon className="h-4 w-4 mx-auto mb-1 text-primary icon-recessed" />
                    <p className="text-lg font-bold text-foreground">
                      {step.stage === "Revenue" ? `₹${step.value.toLocaleString("en-IN")}` : step.value.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{step.stage}</p>
                    {dropRate !== null && dropRate > 0 && (
                      <p className="text-[9px] text-destructive mt-0.5 flex items-center justify-center gap-0.5">
                        <ArrowDown className="h-2.5 w-2.5" />
                        {dropRate.toFixed(1)}% drop
                      </p>
                    )}
                  </div>
                  {i < funnel.length - 1 && (
                    <div className="w-6 h-0.5 bg-gradient-to-r from-primary/40 to-primary/10 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Spend vs Engagement Scatter */}
      {scatterData.length > 1 && (
        <Card className="neu-raised-neon">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Spend vs. Engagement (Creative Performance)</CardTitle>
          </CardHeader>
          <CardContent className="h-64 px-2">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 88%)" />
                <XAxis type="number" dataKey="spend" name="Spend" tick={{ fontSize: 11 }} stroke="hsl(215, 15%, 55%)" tickFormatter={(v) => `₹${v}`} />
                <YAxis type="number" dataKey="engagement" name="Engagement" tick={{ fontSize: 11 }} stroke="hsl(215, 15%, 55%)" />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => {
                    if (name === "Spend") return [`₹${value.toLocaleString("en-IN")}`, name];
                    return [value.toLocaleString("en-IN"), name];
                  }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ""}
                />
                <Scatter data={scatterData} fill="hsl(186, 60%, 55%)">
                  {scatterData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.isHighBurn ? "hsl(0, 72%, 60%)" : entry.ctr > 2 ? "hsl(170, 50%, 55%)" : "hsl(186, 60%, 55%)"}
                      strokeWidth={entry.isHighBurn ? 2 : 0}
                      stroke={entry.isHighBurn ? "hsl(0, 72%, 45%)" : "none"}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Ad Breakdown Table */}
      <Card className="neu-raised-neon">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Detailed Ad Breakdown</CardTitle>
            <div className="flex gap-1">
              <Button
                variant={viewMode === "ad" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-[11px] rounded-full"
                onClick={() => setViewMode("ad")}
              >
                Ad-wise
              </Button>
              <Button
                variant={viewMode === "day" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-[11px] rounded-full"
                onClick={() => setViewMode("day")}
              >
                Day-wise
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neon-border/20">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground uppercase tracking-wider text-xs">
                    {viewMode === "ad" ? "Ad Name" : "Date"}
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">Spend</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">Clicks</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">CTR</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">CPC</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">Engagement</th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground uppercase tracking-wider text-xs">Freq.</th>
                  <th className="px-3 py-2.5 text-center font-medium text-muted-foreground uppercase tracking-wider text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {adStats.slice(0, 25).map((a, i) => (
                  <tr key={i} className={`border-b border-neon-border/10 last:border-0 ${a.isHighBurn ? "bg-destructive/5" : ""}`}>
                    <td className="px-4 py-2.5 font-medium text-foreground max-w-[200px] truncate">
                      {a.ad_name}
                    </td>
                    <td className="px-3 py-2.5 text-right text-destructive font-semibold">₹{Math.round(a.spend).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5 text-right text-foreground">{a.clicks.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={a.ctr >= 2 ? "text-mint font-semibold" : a.ctr >= 1 ? "text-foreground" : "text-muted-foreground"}>
                        {a.ctr.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">
                      {a.cpc > 0 ? `₹${a.cpc.toFixed(0)}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-foreground">{a.engagement.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{a.frequency.toFixed(1)}x</td>
                    <td className="px-3 py-2.5 text-center">
                      {a.isHighBurn ? (
                        <Badge variant="destructive" className="text-[10px] gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          High Burn
                        </Badge>
                      ) : a.ctr >= 2 ? (
                        <Badge className="text-[10px] gap-0.5 bg-primary text-primary-foreground">
                          <Zap className="h-2.5 w-2.5" />
                          Top
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Normal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdsIntelligence;
