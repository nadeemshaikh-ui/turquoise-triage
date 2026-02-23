import { Package, Users, TrendingUp, Clock } from "lucide-react";

interface StatsBarProps {
  todayOrders: number;
  activeLeads: number;
  revenue: number;
  pendingPickup: number;
}

const StatsBar = ({ todayOrders, activeLeads, revenue, pendingPickup }: StatsBarProps) => {
  const stats = [
    { label: "Today's Orders", value: todayOrders, icon: Package, color: "text-primary" },
    { label: "Active Leads", value: activeLeads, icon: Users, color: "text-deep-teal" },
    { label: "Revenue (₹)", value: `₹${revenue.toLocaleString("en-IN")}`, icon: TrendingUp, color: "text-primary" },
    { label: "Ready for Pickup", value: pendingPickup, icon: Clock, color: "text-gold" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-4 rounded-[28px] border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <stat.icon className={`h-6 w-6 ${stat.color}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-bold text-card-foreground">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsBar;
