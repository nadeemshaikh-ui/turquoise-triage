import { Crown, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface Lead {
  id: string;
  customerName: string;
  serviceName: string;
  category: string;
  quotedPrice: number;
  status: string;
  tatDaysMin: number;
  tatDaysMax: number;
  isGoldTier: boolean;
  createdAt: string;
}

interface GoldTierLeadsProps {
  leads: Lead[];
  onViewLead?: (id: string) => void;
}

const statusColor: Record<string, string> = {
  New: "bg-primary/15 text-primary border-primary/30",
  Assigned: "bg-accent text-accent-foreground border-accent",
  "In Progress": "bg-gold/15 text-gold-foreground border-gold/30",
  QC: "bg-secondary text-secondary-foreground border-border",
  "Ready for Pickup": "bg-green-100 text-green-800 border-green-300",
  Completed: "bg-muted text-muted-foreground border-border",
};

const GoldTierLeads = ({ leads, onViewLead }: GoldTierLeadsProps) => {
  if (leads.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Crown className="h-5 w-5 text-gold" />
        <h2 className="text-lg font-bold text-card-foreground">Gold Tier Leads</h2>
        <Badge className="rounded-full border border-gold/40 bg-gold/15 text-gold-foreground hover:bg-gold/20">
          {leads.length}
        </Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {leads.map((lead) => (
          <button
            key={lead.id}
            onClick={() => onViewLead?.(lead.id)}
            className="group relative overflow-hidden rounded-[28px] border-2 border-gold/30 bg-gradient-to-br from-gold/5 via-card to-primary/5 p-5 text-left shadow-[0_2px_12px_-4px_hsl(16_100%_50%/0.10)] transition-all hover:border-gold/50 hover:shadow-[0_4px_20px_-4px_hsl(16_100%_50%/0.18)]"
          >
            <div className="absolute right-3 top-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/20">
                <Crown className="h-3.5 w-3.5 text-gold" />
              </div>
            </div>
            <p className="font-semibold text-card-foreground">{lead.customerName}</p>
            <p className="mt-1 text-sm text-muted-foreground">{lead.serviceName}</p>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-lg font-bold text-primary">₹{lead.quotedPrice.toLocaleString("en-IN")}</p>
              <Badge variant="outline" className={`rounded-full text-xs ${statusColor[lead.status] || ""}`}>
                {lead.status}
              </Badge>
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              View details <ArrowRight className="h-3 w-3" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default GoldTierLeads;
