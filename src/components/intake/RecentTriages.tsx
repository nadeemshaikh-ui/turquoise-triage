import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

type RecentLead = {
  id: string;
  quoted_price: number;
  created_at: string;
  customer_name: string;
  service_name: string;
};

const RecentTriages = () => {
  const [leads, setLeads] = useState<RecentLead[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from("leads")
      .select("id, quoted_price, created_at, customers(name), services(name)")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) {
          setLeads(
            data.map((l: any) => ({
              id: l.id,
              quoted_price: l.quoted_price,
              created_at: l.created_at,
              customer_name: l.customers?.name ?? "Unknown",
              service_name: l.services?.name ?? "Service",
            }))
          );
        }
      });
  }, []);

  if (leads.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Triages</p>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-2">
          {leads.map((lead) => (
            <button
              key={lead.id}
              type="button"
              onClick={() => navigate(`/leads/${lead.id}`)}
              className="flex-shrink-0 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-muted/50"
            >
              <p className="text-xs font-semibold text-foreground truncate max-w-[120px]">{lead.customer_name}</p>
              <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{lead.service_name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-medium text-primary">₹{lead.quoted_price.toLocaleString()}</span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                </span>
              </div>
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};

export default RecentTriages;
