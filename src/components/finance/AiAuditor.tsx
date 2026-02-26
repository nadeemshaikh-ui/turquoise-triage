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
    <Card className="glass-card-glow overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-sm font-semibold font-display">Gemini AI Auditor</CardTitle>
          <span className="ml-auto flex items-center gap-1 text-[9px] font-tech uppercase tracking-widest text-electric-teal font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-electric-teal animate-pulse" /> Live API
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full h-12 rounded-lg text-sm"
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
          <div className="rounded-lg glass-card p-5">
            <p className="text-xs font-tech uppercase tracking-widest text-primary mb-3">
              Growth Insights
            </p>
            <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line font-display">
              {analysis}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AiAuditor;
