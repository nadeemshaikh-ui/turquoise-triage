import { Badge } from "@/components/ui/badge";
import type { Lead } from "./GoldTierLeads";

interface LeadsPipelineProps {
  leads: Lead[];
  onViewLead?: (id: string) => void;
}

const statusOrder = ["New", "In Progress", "Ready for Pickup", "Completed"];

const statusStyles: Record<string, { dot: string; badge: string }> = {
  New: { dot: "bg-primary", badge: "bg-primary/15 text-primary border-primary/30" },
  Assigned: { dot: "bg-accent-foreground", badge: "bg-accent text-accent-foreground border-accent" },
  "In Progress": { dot: "bg-gold", badge: "bg-gold/15 text-gold-foreground border-gold/30" },
  QC: { dot: "bg-secondary-foreground", badge: "bg-secondary text-secondary-foreground border-border" },
  "Ready for Pickup": { dot: "bg-green-500", badge: "bg-green-100 text-green-800 border-green-300" },
  Completed: { dot: "bg-muted-foreground", badge: "bg-muted text-muted-foreground border-border" },
};

const LeadsPipeline = ({ leads, onViewLead }: LeadsPipelineProps) => {
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
            return (
              <button
                key={lead.id}
                onClick={() => onViewLead?.(lead.id)}
                className="flex w-full items-center gap-4 rounded-[28px] border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
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
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LeadsPipeline;
