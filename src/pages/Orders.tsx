import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ClipboardList, Send, Eye, MessageSquare } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import SlaIndicator from "@/components/orders/SlaIndicator";

const STATUS_TABS = ["all", "pickup_scheduled", "received", "inspection", "in_progress", "qc", "ready", "delivered", "declined"] as const;
const TAB_LABELS: Record<string, string> = {
  all: "All", pickup_scheduled: "Pickup", received: "Received", inspection: "Inspection",
  in_progress: "In Progress", qc: "QC", ready: "Ready", delivered: "Delivered",
  declined: "Declined",
};

const statusColor: Record<string, string> = {
  pickup_scheduled: "bg-primary/15 text-primary border-primary/30",
  received: "bg-amber-100 text-amber-800 border-amber-300",
  inspection: "bg-secondary text-secondary-foreground border-border",
  in_progress: "bg-blue-100 text-blue-800 border-blue-300",
  qc: "bg-purple-100 text-purple-800 border-purple-300",
  ready: "bg-emerald-100 text-emerald-800 border-emerald-300",
  delivered: "bg-green-100 text-green-800 border-green-300",
  declined: "bg-red-100 text-red-800 border-red-300",
  cancelled: "bg-gray-100 text-gray-800 border-gray-300",
  // Legacy statuses for backwards compat
  triage: "bg-primary/15 text-primary border-primary/30",
  consult: "bg-amber-100 text-amber-800 border-amber-300",
  quoted: "bg-secondary text-secondary-foreground border-border",
  pending_advance: "bg-orange-100 text-orange-800 border-orange-300",
  workshop: "bg-blue-100 text-blue-800 border-blue-300",
};

const Orders = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", tab],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (tab !== "all") {
        query = query.eq("status", tab);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedOrders = useMemo(
    () => (orders || []).filter((o: any) => selectedIds.has(o.id)),
    [orders, selectedIds]
  );

  const canBatchPublish = useMemo(() => {
    if (selectedOrders.length < 2) return false;
    const phones = new Set(selectedOrders.map((o: any) => o.customer_phone).filter(Boolean));
    return phones.size === 1;
  }, [selectedOrders]);

  const batchPhone = canBatchPublish
    ? selectedOrders[0]?.customer_phone?.replace(/\D/g, "").slice(-4)
    : null;

  const batchPublish = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const validUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      for (const o of selectedOrders) {
        await supabase.from("orders").update({
          status: "quoted",
          quote_sent_at: now,
          quote_valid_until: validUntil,
        }).eq("id", o.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setSelectedIds(new Set());
      toast({
        title: `Batch published! Portal link: /portal/${batchPhone}`,
        description: `${selectedOrders.length} orders set to quoted`,
      });
    },
  });

  // Quote expiry highlighting
  const getQuoteExpiryBorder = (order: any) => {
    if (order.status !== "quoted" || !order.quote_sent_at) return "";
    const hoursSinceQuote = (Date.now() - new Date(order.quote_sent_at).getTime()) / (1000 * 60 * 60);
    if (hoursSinceQuote > 48) return "border-l-4 border-l-red-500";
    if (hoursSinceQuote > 24) return "border-l-4 border-l-amber-400";
    return "";
  };

  // Check-in mismatch highlighting
  const getCheckinBorder = (order: any) => {
    if (order.status !== "received" || order.checkin_confirmed) return "";
    const checked = (order.checked_in_items || []).length;
    const expected = order.expected_item_count || 1;
    if (checked !== expected && checked > 0) return "border-l-4 border-l-orange-500";
    return "";
  };

  // Sort: pin >72h quoted orders to top
  const sortedOrders = useMemo(() => {
    if (!orders) return [];
    return [...orders].sort((a, b) => {
      const aPin = a.status === "quoted" && a.quote_sent_at && (Date.now() - new Date(a.quote_sent_at).getTime()) > 72 * 60 * 60 * 1000;
      const bPin = b.status === "quoted" && b.quote_sent_at && (Date.now() - new Date(b.quote_sent_at).getTime()) > 72 * 60 * 60 * 1000;
      if (aPin && !bPin) return -1;
      if (!aPin && bPin) return 1;
      return 0;
    });
  }, [orders]);

  const openWhatsAppReminder = (order: any) => {
    const phone = order.customer_phone?.replace(/\D/g, "") || "";
    const portalUrl = `${window.location.origin}/portal/${order.customer_id}`;
    const message = `Hi ${order.customer_name || "there"}! Just checking in on your Restoree 360 quote. You can review and approve it here: ${portalUrl}`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

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

      {/* Batch Publish Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-card p-3">
          <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            {canBatchPublish && (
              <Button
                size="sm"
                onClick={() => batchPublish.mutate()}
                disabled={batchPublish.isPending}
                className="gap-1.5"
              >
                {batchPublish.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Publish Batch → /portal/{batchPhone}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !sortedOrders?.length ? (
        <div className="rounded-[var(--radius)] border border-dashed border-border bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">No orders found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedOrders.map((order: any) => {
            const expiryBorder = getQuoteExpiryBorder(order);
            const checkinBorder = getCheckinBorder(order);
            const isExpiredQuote = order.status === "quoted" && order.quote_valid_until && new Date(order.quote_valid_until) < new Date();
            return (
              <div
                key={order.id}
                className={`flex items-start gap-3 rounded-[var(--radius)] border border-border bg-card p-4 hover:shadow-md transition-shadow ${expiryBorder} ${checkinBorder}`}
              >
                <Checkbox
                  checked={selectedIds.has(order.id)}
                  onCheckedChange={() => toggleSelect(order.id)}
                  className="mt-1 shrink-0"
                />
                <button
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className="flex-1 text-left space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{order.customer_name || "Unknown"}</span>
                    <div className="flex items-center gap-1.5">
                      {isExpiredQuote && (
                        <Badge className="bg-red-100 text-red-800 border-red-400 text-[10px] rounded-full">
                          Quote Expired
                        </Badge>
                      )}
                      <Badge variant="outline" className={`text-[10px] rounded-full ${statusColor[order.status] || "bg-yellow-100 text-yellow-800 border-yellow-300"}`}>
                        {statusColor[order.status] ? order.status : `Unknown (${order.status})`}
                      </Badge>
                    </div>
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
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`/portal/${order.customer_id}`, "_blank");
                    }}
                    className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                    title="Open Customer Portal"
                  >
                    <Eye className="h-4 w-4" style={{ color: "#C9A96E" }} />
                  </button>
                  {order.status === "quoted" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openWhatsAppReminder(order);
                      }}
                      className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                      title="Send WhatsApp Reminder"
                    >
                      <MessageSquare className="h-4 w-4 text-green-600" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Orders;
