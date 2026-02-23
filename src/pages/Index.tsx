import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLeads } from "@/hooks/useLeads";
import StatsBar from "@/components/dashboard/StatsBar";
import GoldTierLeads from "@/components/dashboard/GoldTierLeads";
import LeadsPipeline from "@/components/dashboard/LeadsPipeline";
import NewLeadDialog from "@/components/intake/NewLeadDialog";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

const Index = () => {
  const [showNewLead, setShowNewLead] = useState(false);
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const { goldTierLeads, recentLeads, stats, isLoading } = useLeads();

  const handleLeadCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["leads"] });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">
              Restoree <span className="text-primary">360</span>
            </h1>
            <p className="text-xs text-muted-foreground">Shoe & Bag Restoration OS</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="rounded-[28px] gap-2 px-6 shadow-md hover:shadow-lg transition-shadow"
              onClick={() => setShowNewLead(true)}
            >
              <Plus className="h-4 w-4" />
              New Lead
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <StatsBar
              todayOrders={stats.todayOrders}
              activeLeads={stats.activeLeads}
              revenue={stats.revenue}
              pendingPickup={stats.pendingPickup}
            />
            <GoldTierLeads leads={goldTierLeads} onViewLead={(id) => navigate(`/leads/${id}`)} />
            <LeadsPipeline leads={recentLeads} onViewLead={(id) => navigate(`/leads/${id}`)} />
          </>
        )}
      </main>

      <NewLeadDialog open={showNewLead} onOpenChange={setShowNewLead} onCreated={handleLeadCreated} />
    </div>
  );
};

export default Index;
