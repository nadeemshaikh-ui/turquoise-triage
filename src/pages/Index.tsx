import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLeads } from "@/hooks/useLeads";
import StatsBar from "@/components/dashboard/StatsBar";
import GoldTierLeads from "@/components/dashboard/GoldTierLeads";
import LeadsPipeline from "@/components/dashboard/LeadsPipeline";
import NewLeadDialog from "@/components/intake/NewLeadDialog";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showNewLead, setShowNewLead] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { goldTierLeads, recentLeads, stats, isLoading } = useLeads();

  // Open new lead dialog via URL param from AppLayout
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

  return (
    <div className="space-y-6">
      <StatsBar
        todayOrders={stats.todayOrders}
        activeLeads={stats.activeLeads}
        revenue={stats.revenue}
        pendingPickup={stats.pendingPickup}
      />
      <GoldTierLeads leads={goldTierLeads} onViewLead={(id) => navigate(`/leads/${id}`)} />
      <LeadsPipeline leads={recentLeads} onViewLead={(id) => navigate(`/leads/${id}`)} />
      <NewLeadDialog open={showNewLead} onOpenChange={setShowNewLead} onCreated={handleLeadCreated} />
    </div>
  );
};

export default Index;
