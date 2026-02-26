import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLeads } from "@/hooks/useLeads";
import GoldTierLeads from "@/components/dashboard/GoldTierLeads";
import LeadsPipeline from "@/components/dashboard/LeadsPipeline";
import NewLeadDialog from "@/components/intake/NewLeadDialog";
import RecentTriages from "@/components/intake/RecentTriages";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Inbox, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showNewLead, setShowNewLead] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { goldTierLeads, recentLeads, stats, isLoading } = useLeads();

  useEffect(() => {
    if (searchParams.get("newLead") === "1") {
      setShowNewLead(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleLeadCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["leads"] });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const newLeads = recentLeads.filter((l) => l.status === "New");
  const pendingQuotes = recentLeads.filter((l) => l.status === "Assigned" || l.status === "In Progress");

  return (
    <div className="space-y-6">
      {/* Hero KPI cards — neumorphic */}
      <div className="grid grid-cols-2 gap-5">
        <div className="neu-raised flex items-center gap-4 p-5">
          <div className="neu-pressed flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
            <Inbox className="h-5 w-5 icon-recessed" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">New Leads</p>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-semibold text-foreground">{newLeads.length}</p>
              {newLeads.length > 0 && (
                <Badge className="bg-primary/15 text-primary border-none text-[10px]">Action needed</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="neu-raised flex items-center gap-4 p-5">
          <div className="neu-pressed flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
            <Clock className="h-5 w-5 icon-recessed" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pending Quotes</p>
            <p className="text-3xl font-semibold text-foreground">{pendingQuotes.length}</p>
          </div>
        </div>
      </div>

      <RecentTriages />
      <GoldTierLeads leads={goldTierLeads} onViewLead={(id) => navigate(`/leads/${id}`)} />
      <LeadsPipeline leads={recentLeads} onViewLead={(id) => navigate(`/leads/${id}`)} />
      <NewLeadDialog open={showNewLead} onOpenChange={setShowNewLead} onCreated={handleLeadCreated} />
    </div>
  );
};

export default Index;
