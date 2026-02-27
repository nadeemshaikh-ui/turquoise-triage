import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, ClipboardList } from "lucide-react";
import SlaIndicator from "@/components/orders/SlaIndicator";

const STATUS_TABS = ["all", "triage", "consult", "quoted", "workshop", "qc", "delivered"] as const;
const TAB_LABELS: Record<string, string> = {
  all: "All", triage: "Triage", consult: "Consult", quoted: "Quoted",
  workshop: "Workshop", qc: "QC", delivered: "Delivered",
};

const statusColor: Record<string, string> = {
  triage: "bg-primary/15 text-primary border-primary/30",
  consult: "bg-amber-100 text-amber-800 border-amber-300",
  quoted: "bg-secondary text-secondary-foreground border-border",
  workshop: "bg-blue-100 text-blue-800 border-blue-300",
  qc: "bg-purple-100 text-purple-800 border-purple-300",
  delivered: "bg-green-100 text-green-800 border-green-300",
};

const Orders = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<string>("all");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", tab],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (tab !== "all") query = query.eq("status", tab);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 icon-recessed" />
        <h1 className="text-xl font-bold text-foreground">Orders</h1>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              tab === t ? "neu-pressed text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !orders?.length ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">No orders found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order: any) => (
            <button
              key={order.id}
              onClick={() => navigate(`/orders/${order.id}`)}
              className="w-full text-left rounded-[var(--radius)] border border-border bg-card p-4 hover:shadow-md transition-shadow space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{order.customer_name || "Unknown"}</span>
                <Badge variant="outline" className={`text-[10px] rounded-full ${statusColor[order.status] || ""}`}>
                  {order.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{order.customer_phone}</span>
                <span className="font-medium text-foreground">₹{Number(order.total_price || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {new Date(order.created_at).toLocaleDateString()}
                </span>
                <SlaIndicator orderStatus={order.status} consultationStartTime={order.consultation_start_time} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Orders;
