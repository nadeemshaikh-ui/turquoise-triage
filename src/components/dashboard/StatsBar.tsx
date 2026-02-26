import { Package, Users, TrendingUp, Clock } from "lucide-react";

interface StatsBarProps {
  todayOrders: number;
  activeLeads: number;
  revenue: number;
  pendingPickup: number;
}

const StatsBar = ({ todayOrders, activeLeads, revenue, pendingPickup }: StatsBarProps) => {
  const stats = [
    { label: "Today's Orders", value: todayOrders, icon: Package },
    { label: "Active Leads", value: activeLeads, icon: Users },
    { label: "Revenue (₹)", value: `₹${revenue.toLocaleString("en-IN")}`, icon: TrendingUp },
    { label: "Ready for Pickup", value: pendingPickup, icon: Clock },
  ];

  return (
    <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="neu-raised flex items-center gap-4 p-5">
          <div className="neu-pressed flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
            <stat.icon className="h-5 w-5 icon-recessed" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsBar;
