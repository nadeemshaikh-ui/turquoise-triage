import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Alert {
  id: string;
  item_name: string;
  stock_level: number;
  min_stock_level: number;
  is_read: boolean;
  created_at: string;
}

const AlertBell = () => {
  const queryClient = useQueryClient();

  const { data: alerts = [] } = useQuery({
    queryKey: ["low-stock-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("low_stock_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as Alert[];
    },
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("alerts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "low_stock_alerts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["low-stock-alerts"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const markAllRead = useMutation({
    mutationFn: async () => {
      const unreadIds = alerts.filter((a) => !a.is_read).map((a) => a.id);
      if (unreadIds.length === 0) return;
      const { error } = await supabase
        .from("low_stock_alerts")
        .update({ is_read: true })
        .in("id", unreadIds);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["low-stock-alerts"] }),
  });

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return (
    <Popover onOpenChange={(open) => { if (open && unreadCount > 0) markAllRead.mutate(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Low Stock Alerts</h3>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {alerts.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No alerts yet</p>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "border-b border-border px-4 py-3 last:border-0",
                  !alert.is_read && "bg-accent/30"
                )}
              >
                <p className="text-sm font-medium text-foreground">
                  ⚠️ {alert.item_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Stock: {alert.stock_level} — Min: {alert.min_stock_level}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {format(new Date(alert.created_at), "MMM d, h:mm a")}
                </p>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AlertBell;
