import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Lead } from "./GoldTierLeads";

interface LeadsPipelineProps {
  leads: Lead[];
  onViewLead?: (id: string) => void;
}

const statusStyles: Record<string, { dot: string; badge: string }> = {
  New: { dot: "bg-primary", badge: "bg-primary/15 text-primary border-primary/30" },
  Assigned: { dot: "bg-accent-foreground", badge: "bg-accent text-accent-foreground border-accent" },
  "In Progress": { dot: "bg-gold", badge: "bg-gold/15 text-gold-foreground border-gold/30" },
  QC: { dot: "bg-secondary-foreground", badge: "bg-secondary text-secondary-foreground border-border" },
  "Ready for Pickup": { dot: "bg-green-500", badge: "bg-green-100 text-green-800 border-green-300" },
  Completed: { dot: "bg-muted-foreground", badge: "bg-muted text-muted-foreground border-border" },
};

const LeadsPipeline = ({ leads, onViewLead }: LeadsPipelineProps) => {
  const queryClient = useQueryClient();

  const acceptMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from("leads")
        .update({ status: "Assigned" })
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["workshop-leads"] });
      toast({ title: "Order accepted — moved to Workshop" });
    },
  });

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-card-foreground">Recent Leads</h2>
      {leads.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-border bg-muted/30 p-10 text-center">
          <p className="text-muted-foreground">No leads yet. Create your first lead!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => {
            const style = statusStyles[lead.status] || statusStyles.New;
            const isNew = lead.status === "New";
            return (
              <div
                key={lead.id}
                className="flex w-full items-center gap-3 rounded-[28px] border border-border bg-card p-4 shadow-[0_2px_12px_-4px_hsl(16_100%_50%/0.10)] transition-all hover:border-primary/30 hover:shadow-[0_4px_20px_-4px_hsl(16_100%_50%/0.18)]"
              >
                <button
                  onClick={() => onViewLead?.(lead.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className={`h-3 w-3 shrink-0 rounded-full ${style.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-card-foreground">{lead.customerName}</p>
                    <p className="truncate text-sm text-muted-foreground">{lead.serviceName}</p>
                  </div>
                  <p className="shrink-0 font-semibold text-card-foreground">
                    ₹{lead.quotedPrice.toLocaleString("en-IN")}
                  </p>
                  <Badge variant="outline" className={`shrink-0 rounded-full text-xs ${style.badge}`}>
                    {lead.status}
                  </Badge>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {lead.tatDaysMin}–{lead.tatDaysMax}d
                  </span>
                </button>
                {isNew && (
                  <Button
                    size="sm"
                    className="shrink-0 gap-1.5 rounded-[28px] shadow-[0_2px_8px_-2px_hsl(16_100%_50%/0.25)]"
                    onClick={(e) => {
                      e.stopPropagation();
                      acceptMutation.mutate(lead.id);
                    }}
                    disabled={acceptMutation.isPending}
                  >
                    {acceptMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5" />
                    )}
                    Accept
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LeadsPipeline;
