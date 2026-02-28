import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Camera, Shield, AlertTriangle, Star, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface DigitalWardrobeProps {
  customerId: string;
}

interface CompletedOrder {
  id: string;
  deliveredAt: string;
  warrantyDaysSnapshot: number;
  totalPrice: number;
  items: {
    id: string;
    category: string;
    brand: string;
    serviceType: string;
    remarksSnapshot: string | null;
    primaryImageUrlSnapshot: string | null;
    warrantyStartAt: string | null;
    warrantyEndAt: string | null;
  }[];
  invoiceUrl: string | null;
  hasRating: boolean;
  hasDispute: boolean;
}

const DigitalWardrobe = ({ customerId }: DigitalWardrobeProps) => {
  const [ratingOrderId, setRatingOrderId] = useState<string | null>(null);
  const [stars, setStars] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [disputeOrderId, setDisputeOrderId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");

  const { data: wardrobeOrders = [], isLoading } = useQuery({
    queryKey: ["digital-wardrobe", customerId],
    queryFn: async (): Promise<CompletedOrder[]> => {
      // Get completed orders with delivered_at
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, delivered_at, warranty_days_snapshot, total_price")
        .eq("customer_id", customerId)
        .not("delivered_at", "is", null)
        .in("status", ["delivered", "Completed"])
        .order("delivered_at", { ascending: false });

      if (error || !orders?.length) return [];

      const orderIds = orders.map((o: any) => o.id);

      // Parallel fetch items, invoices, ratings, disputes
      const [itemsRes, invoicesRes, ratingsRes, disputesRes] = await Promise.all([
        supabase.from("order_items").select("*").in("order_id", orderIds),
        supabase.from("invoices").select("order_id, public_url").in("order_id", orderIds),
        supabase.from("ratings").select("order_id").in("order_id", orderIds),
        supabase.from("disputes").select("order_id").in("order_id", orderIds),
      ]);

      const invoiceMap = Object.fromEntries(
        (invoicesRes.data || []).map((i: any) => [i.order_id, i.public_url])
      );
      const ratingSet = new Set((ratingsRes.data || []).map((r: any) => r.order_id));
      const disputeSet = new Set((disputesRes.data || []).map((d: any) => d.order_id));

      return orders.map((o: any) => ({
        id: o.id,
        deliveredAt: o.delivered_at,
        warrantyDaysSnapshot: o.warranty_days_snapshot,
        totalPrice: Number(o.total_price) || 0,
        items: (itemsRes.data || [])
          .filter((i: any) => i.order_id === o.id)
          .map((i: any) => ({
            id: i.id,
            category: i.category,
            brand: i.brand,
            serviceType: i.service_type,
            remarksSnapshot: i.remarks_snapshot,
            primaryImageUrlSnapshot: i.primary_image_url_snapshot,
            warrantyStartAt: i.warranty_start_at,
            warrantyEndAt: i.warranty_end_at,
          })),
        invoiceUrl: invoiceMap[o.id] || null,
        hasRating: ratingSet.has(o.id),
        hasDispute: disputeSet.has(o.id),
      }));
    },
    enabled: !!customerId,
  });

  const handleSubmitRating = async (orderId: string) => {
    if (stars < 1) return;
    try {
      const { error } = await supabase.from("ratings").insert({
        order_id: orderId,
        stars,
      });
      if (error) throw error;
      toast.success(stars === 5 ? "Thank you! Consider leaving a Google Review" : "Feedback recorded");
      setRatingOrderId(null);
      setStars(0);
      setFeedback("");
    } catch {
      toast.error("Failed to submit rating");
    }
  };

  const handleSubmitDispute = async (orderId: string) => {
    if (!disputeReason.trim()) return;
    try {
      const { error } = await supabase.from("disputes").insert({
        order_id: orderId,
        reason: disputeReason.trim(),
      });
      if (error) throw error;
      toast.success("Dispute raised");
      setDisputeOrderId(null);
      setDisputeReason("");
    } catch {
      toast.error("Failed to raise dispute");
    }
  };

  if (isLoading || wardrobeOrders.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Digital Wardrobe</h2>
        <Badge variant="secondary" className="text-[10px]">{wardrobeOrders.length}</Badge>
      </div>

      <div className="space-y-3">
        {wardrobeOrders.map((order) => {
          const deliveredDate = new Date(order.deliveredAt);
          const daysSinceDelivery = differenceInDays(new Date(), deliveredDate);
          const canDispute = daysSinceDelivery <= 7 && !order.hasDispute;

          return (
            <div key={order.id} className="rounded-[var(--radius)] border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Delivered {format(deliveredDate, "MMM d, yyyy")}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    ₹{order.totalPrice.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="flex gap-2">
                  {order.invoiceUrl ? (
                    <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => window.open(order.invoiceUrl!, "_blank")}>
                      <ExternalLink className="h-3 w-3" /> Invoice
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">Invoice pending</Badge>
                  )}
                </div>
              </div>

              {/* Item cards */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {order.items.map((item) => {
                  const warrantyEnd = item.warrantyEndAt ? new Date(item.warrantyEndAt) : null;
                  const warrantyDaysLeft = warrantyEnd ? differenceInDays(warrantyEnd, new Date()) : 0;
                  const inWarranty = warrantyDaysLeft > 0;

                  return (
                    <div key={item.id} className="rounded-[calc(var(--radius)/2)] border border-border overflow-hidden">
                      <div className="aspect-square bg-muted flex items-center justify-center">
                        {item.primaryImageUrlSnapshot ? (
                          <img
                            src={supabase.storage.from("lead-photos").getPublicUrl(item.primaryImageUrlSnapshot).data.publicUrl}
                            alt={item.category}
                            className="h-full w-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <Camera className="h-6 w-6 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="p-2 space-y-1">
                        <p className="text-xs font-medium text-foreground truncate">{item.brand} · {item.category}</p>
                        <p className="text-[10px] text-muted-foreground">{item.serviceType}</p>
                        {item.remarksSnapshot && (
                          <p className="text-[10px] text-muted-foreground italic truncate">{item.remarksSnapshot}</p>
                        )}
                        <Badge variant={inWarranty ? "default" : "secondary"} className="text-[9px]">
                          {inWarranty ? `${warrantyDaysLeft}d warranty left` : "Out of warranty"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                {canDispute && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1 border-destructive/30 text-destructive"
                    onClick={() => setDisputeOrderId(order.id)}
                  >
                    <AlertTriangle className="h-3 w-3" /> Raise Dispute
                  </Button>
                )}
                {!order.hasRating && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1"
                    onClick={() => setRatingOrderId(order.id)}
                  >
                    <Star className="h-3 w-3" /> Rate
                  </Button>
                )}
              </div>

              {/* Rating form */}
              {ratingOrderId === order.id && (
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button key={s} onClick={() => setStars(s)}>
                        <Star className={`h-5 w-5 ${s <= stars ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}`} />
                      </button>
                    ))}
                  </div>
                  <Button size="sm" className="h-7 text-xs" disabled={stars < 1} onClick={() => handleSubmitRating(order.id)}>
                    Submit
                  </Button>
                </div>
              )}

              {/* Dispute form */}
              {disputeOrderId === order.id && (
                <div className="border-t border-border pt-3 space-y-2">
                  <textarea
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder="Describe the issue..."
                    className="w-full h-16 text-sm border border-border rounded-[calc(var(--radius)/2)] p-2 bg-background text-foreground"
                  />
                  <Button size="sm" className="h-7 text-xs" disabled={!disputeReason.trim()} onClick={() => handleSubmitDispute(order.id)}>
                    Submit Dispute
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default DigitalWardrobe;
