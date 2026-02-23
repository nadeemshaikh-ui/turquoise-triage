import { useState } from "react";
import { Plus, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import StatsBar from "@/components/dashboard/StatsBar";
import GoldTierLeads from "@/components/dashboard/GoldTierLeads";
import LeadsPipeline from "@/components/dashboard/LeadsPipeline";
import NewLeadDialog from "@/components/intake/NewLeadDialog";
import type { Lead } from "@/components/dashboard/GoldTierLeads";

// Mock data — will be replaced with live DB queries after auth is wired
const mockLeads: Lead[] = [
  {
    id: "1",
    customerName: "Priya Mehta",
    serviceName: "Color Change (Bags)",
    category: "Luxury Bags",
    quotedPrice: 7500,
    status: "New",
    tatDaysMin: 10,
    tatDaysMax: 15,
    isGoldTier: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "2",
    customerName: "Arjun Kapoor",
    serviceName: "Signature Clean",
    category: "Cleaning",
    quotedPrice: 6500,
    status: "In Progress",
    tatDaysMin: 4,
    tatDaysMax: 5,
    isGoldTier: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "3",
    customerName: "Sneha Reddy",
    serviceName: "Sneaker Deep Clean",
    category: "Cleaning",
    quotedPrice: 800,
    status: "New",
    tatDaysMin: 4,
    tatDaysMax: 5,
    isGoldTier: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "4",
    customerName: "Vikram Shah",
    serviceName: "Leather Peeling Repair",
    category: "Restoration & Color",
    quotedPrice: 3500,
    status: "In Progress",
    tatDaysMin: 10,
    tatDaysMax: 15,
    isGoldTier: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "5",
    customerName: "Meera Joshi",
    serviceName: "Structural Realignment",
    category: "Luxury Bags",
    quotedPrice: 8000,
    status: "Ready for Pickup",
    tatDaysMin: 12,
    tatDaysMax: 15,
    isGoldTier: true,
    createdAt: new Date().toISOString(),
  },
];

const goldTierLeads = mockLeads.filter((l) => l.isGoldTier);
const recentLeads = mockLeads.filter((l) => !l.isGoldTier);

const Index = () => {
  const [showNewLead, setShowNewLead] = useState(false);
  const { signOut } = useAuth();

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
        <StatsBar
          todayOrders={3}
          activeLeads={mockLeads.filter((l) => l.status !== "Completed").length}
          revenue={26300}
          pendingPickup={mockLeads.filter((l) => l.status === "Ready for Pickup").length}
        />

        <GoldTierLeads leads={goldTierLeads} />

        <LeadsPipeline leads={recentLeads} />
      </main>

      <NewLeadDialog open={showNewLead} onOpenChange={setShowNewLead} />
    </div>
  );
};

export default Index;
