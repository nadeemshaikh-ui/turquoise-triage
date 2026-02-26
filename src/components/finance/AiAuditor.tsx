import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type AdStat = {
  ad_name: string;
  spend: number;
  clicks: number;
  cpc: number;
  ctr: number;
  engagement: number;
};

type Props = {
  turnsRevenue: number;
  totalAdSpend: number;
  materialCogs: number;
  realProfit: number;
  profitMargin: string;
  topAd?: AdStat | null;
  worstAd?: AdStat | null;
};

const AiAuditor = ({ turnsRevenue, totalAdSpend, materialCogs, realProfit, profitMargin, topAd, worstAd }: Props) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    setAnalysis(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-auditor", {
        body: {
          totalRevenue: turnsRevenue,
          totalAdSpend,
          materialCogs,
          realProfit,
          profitMargin,
          topAd: topAd ? { name: topAd.ad_name, cpc: topAd.cpc.toFixed(0), ctr: topAd.ctr.toFixed(2) } : null,
          worstAd: worstAd ? { name: worstAd.ad_name, spend: worstAd.spend.toFixed(0), clicks: worstAd.clicks } : null,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: "AI CFO", description: data.error, variant: "destructive" });
        return;
      }
      setAnalysis(data.analysis);
    } catch (err: any) {
      toast({ title: "AI CFO Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Parse markdown sections
  const sections = useMemo(() => {
    if (!analysis) return null;
    const lines = analysis.split("\n");
    const result: { icon: string; title: string; bullets: string[] }[] = [];
    let current: { icon: string; title: string; bullets: string[] } | null = null;

    for (const line of lines) {
      const headerMatch = line.match(/^(📊|🔍|🎯)\s*\*\*(.+?)\*\*/);
      if (headerMatch) {
        if (current) result.push(current);
        current = { icon: headerMatch[1], title: headerMatch[2], bullets: [] };
        continue;
      }
      if (current && line.trim().startsWith("-")) {
        current.bullets.push(line.trim().replace(/^-\s*/, ""));
      }
    }
    if (current) result.push(current);
    return result.length > 0 ? result : null;
  }, [analysis]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-foreground">AI CFO Action Plan</h2>
        <p className="text-sm text-muted-foreground">Ruthless, data-driven strategy from your AI finance advisor</p>
      </div>

      {/* Quick Stats for Context */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="neu-raised p-4 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Revenue</p>
          <p className="text-lg font-bold text-foreground">₹{turnsRevenue.toLocaleString("en-IN")}</p>
        </div>
        <div className="neu-raised p-4 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Ad Spend</p>
          <p className="text-lg font-bold text-destructive">₹{totalAdSpend.toLocaleString("en-IN")}</p>
        </div>
        <div className="neu-raised p-4 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">ROAS</p>
          <p className="text-lg font-bold text-foreground">
            {totalAdSpend > 0 ? `${(turnsRevenue / totalAdSpend).toFixed(2)}x` : "—"}
          </p>
        </div>
        <div className="neu-raised p-4 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Margin</p>
          <p className={`text-lg font-bold ${realProfit >= 0 ? "text-mint" : "text-destructive"}`}>{profitMargin}</p>
        </div>
      </div>

      {/* Analyze Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleAnalyze}
          disabled={loading}
          size="lg"
          className="h-14 px-10 text-sm font-semibold rounded-2xl shadow-lg"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Analyzing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Generate Action Plan
            </span>
          )}
        </Button>
      </div>

      {/* Structured Output */}
      {sections ? (
        <div className="space-y-4">
          {sections.map((section, i) => (
            <Card key={i} className={`neu-raised-neon ${i === 2 ? "border-mint/40" : ""}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <span className="text-lg">{section.icon}</span>
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {section.bullets.map((bullet, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                    <p className="text-sm leading-relaxed text-foreground">{bullet}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : analysis ? (
        <Card className="neu-raised-neon">
          <CardContent className="p-5">
            <div className="text-sm leading-relaxed text-foreground whitespace-pre-line">{analysis}</div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export default AiAuditor;
