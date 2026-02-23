import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, Mail, User, Loader2, Crown, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  New: "bg-blue-100 text-blue-700",
  Assigned: "bg-violet-100 text-violet-700",
  "In Progress": "bg-amber-100 text-amber-700",
  QC: "bg-orange-100 text-orange-700",
  "Ready for Pickup": "bg-emerald-100 text-emerald-700",
  Completed: "bg-green-100 text-green-700",
};

const getSlaStatus = (createdAt: string, tatDaysMax: number, status: string): "ok" | "warning" | "overdue" => {
  if (status === "Completed") return "ok";
  const deadline = new Date(createdAt);
  deadline.setDate(deadline.getDate() + tatDaysMax);
  const now = new Date();
  const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursLeft < 0) return "overdue";
  if (hoursLeft < 48) return "warning";
  return "ok";
};

const CustomerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: customer, isLoading: loadingCustomer } = useQuery({
    queryKey: ["customer-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["customer-orders", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(`
          id, quoted_price, status, tat_days_max, is_gold_tier, created_at,
          custom_service_name,
          services ( name )
        `)
        .eq("customer_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const isLoading = loadingCustomer || loadingOrders;

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Customer not found.</p>
        <Button variant="outline" onClick={() => navigate("/customers")} className="rounded-[28px]">
          Back to Customers
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/customers")} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-foreground truncate">{customer.name}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-0.5">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" /> {customer.phone}
            </span>
            {customer.email && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" /> {customer.email}
              </span>
            )}
          </div>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <User className="h-6 w-6 text-primary" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[20px] border bg-card p-3 text-center shadow-[0_2px_10px_-4px_hsl(16_100%_50%/0.10)]">
          <p className="text-xl font-bold text-foreground">{orders.length}</p>
          <p className="text-[10px] text-muted-foreground">Total Orders</p>
        </div>
        <div className="rounded-[20px] border bg-card p-3 text-center shadow-[0_2px_10px_-4px_hsl(16_100%_50%/0.10)]">
          <p className="text-xl font-bold text-primary">
            ₹{orders.reduce((s, o: any) => s + Number(o.quoted_price), 0).toLocaleString("en-IN")}
          </p>
          <p className="text-[10px] text-muted-foreground">Total Value</p>
        </div>
        <div className="rounded-[20px] border bg-card p-3 text-center shadow-[0_2px_10px_-4px_hsl(16_100%_50%/0.10)]">
          <p className="text-xl font-bold text-foreground">
            {orders.filter((o: any) => o.status === "Completed").length}
          </p>
          <p className="text-[10px] text-muted-foreground">Completed</p>
        </div>
      </div>

      {/* Orders */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">Order History</h2>
        {orders.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <div className="space-y-2">
            {orders.map((order: any) => {
              const sla = getSlaStatus(order.created_at, order.tat_days_max, order.status);
              const serviceName = order.custom_service_name || order.services?.name || "Unknown";
              const slaBorderClass =
                sla === "overdue" ? "border-destructive" : sla === "warning" ? "border-gold" : "border-border";

              return (
                <div
                  key={order.id}
                  onClick={() => navigate(`/leads/${order.id}`)}
                  className={cn(
                    "flex items-center gap-3 rounded-[20px] border-2 bg-card p-4 cursor-pointer transition-all shadow-[0_2px_10px_-4px_hsl(16_100%_50%/0.10)] hover:shadow-[0_4px_16px_-4px_hsl(16_100%_50%/0.18)]",
                    slaBorderClass
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-card-foreground truncate">{serviceName}</p>
                      {order.is_gold_tier && <Crown className="h-3.5 w-3.5 shrink-0 text-gold" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {format(new Date(order.created_at), "dd MMM yyyy")}
                    </p>
                    {sla === "warning" && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-gold-foreground">
                        <Clock className="h-3 w-3" /> &lt;48h remaining
                      </div>
                    )}
                    {sla === "overdue" && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-destructive">
                        <AlertTriangle className="h-3 w-3" /> TAT exceeded
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-sm font-bold text-primary">₹{Number(order.quoted_price).toLocaleString("en-IN")}</p>
                    <Badge className={cn("text-[10px] border-0", statusColors[order.status] || "bg-muted text-muted-foreground")}>
                      {order.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerDetail;
