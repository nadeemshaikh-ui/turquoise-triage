import { Package, Users, TrendingUp, Clock } from "lucide-react";

interface StatsBarProps {
  todayOrders: number;
  activeLeads: number;
  revenue: number;
  pendingPickup: number;
}

const StatsBar = ({ todayOrders, activeLeads, revenue, pendingPickup }: StatsBarProps) => {
  const stats = [
    { label: "Today's Orders", value: todayOrders, icon: Package, glow: true },
    { label: "Active Leads", value: activeLeads, icon: Users, glow: false },
    { label: "Revenue (₹)", value: `₹${revenue.toLocaleString("en-IN")}`, icon: TrendingUp, glow: true },
    { label: "Ready for Pickup", value: pendingPickup, icon: Clock, glow: false },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`flex items-center gap-4 rounded-lg p-5 transition-shadow ${
            stat.glow ? "glass-card-glow" : "glass-card"
          }`}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <stat.icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-xs font-tech uppercase tracking-widest text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-bold font-display text-foreground">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsBar;
