import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Props = {
  turnsRevenue: number;
  totalAdSpend: number;
  materialCogs: number;
  realProfit: number;
  profitMargin: string;
};

const AiAuditor = ({ turnsRevenue, totalAdSpend, materialCogs, realProfit, profitMargin }: Props) => {
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
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: "AI Auditor", description: data.error, variant: "destructive" });
        return;
      }
      setAnalysis(data.analysis);
    } catch (err: any) {
      toast({ title: "AI Auditor Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(40_80%_50%/0.15)] border-amber-200/40 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-sm font-semibold">Gemini AI Auditor</CardTitle>
          <span className="ml-auto flex items-center gap-1 text-[9px] text-emerald-600 font-medium"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live API</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full h-12 rounded-2xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-[0_0_20px_-4px_hsl(40_100%_50%/0.5)] hover:shadow-[0_0_28px_-4px_hsl(40_100%_50%/0.7)] transition-all duration-300"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Analyze My Business
            </span>
          )}
        </Button>

        {analysis && (
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30 p-5">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-3 tracking-wide uppercase">
              Growth Insights
            </p>
            <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line font-serif">
              {analysis}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AiAuditor;
