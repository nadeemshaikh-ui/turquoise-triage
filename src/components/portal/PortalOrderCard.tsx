import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle, XCircle, Star, ChevronDown, Clock, RotateCcw } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import PortalPhotoViewer, { BeforeAfterSlider } from "./PortalPhotoViewer";

interface PortalOrderCardProps {
  order: any;
  tasks: any[];
  photos: any[];
  discoveries: any[];
  markers: any[];
  auditLogs?: any[];
  systemSettings?: any;
  onAction?: (action: string, body: any) => Promise<void>;
  onApproveDiscovery: (discoveryId: string) => Promise<void>;
  onDeclineDiscovery: (discoveryId: string) => Promise<void>;
  onConfirmAddress: (orderId: string, address: string) => Promise<void>;
  onSubmitRating: (orderId: string, rating: number, feedback: string) => Promise<void>;
  selectedTier?: string;
  onTierChange?: (tier: string) => void;
  excludedTaskIds?: Set<string>;
  onExcludedChange?: (excluded: Set<string>) => void;
}

const PROGRESS_STEPS = [
  { key: "pickup_scheduled", label: "Pickup" },
  { key: "received", label: "Received" },
  { key: "inspection", label: "Inspection" },
  { key: "in_progress", label: "In Progress" },
  { key: "qc", label: "QC" },
  { key: "ready", label: "Ready" },
  { key: "delivered", label: "Delivered" },
];

const PortalOrderCard = React.memo(({
  order, tasks, photos, discoveries, markers, auditLogs = [], systemSettings = {},
  onAction, onApproveDiscovery, onDeclineDiscovery, onConfirmAddress, onSubmitRating,
  selectedTier = "standard", onTierChange, excludedTaskIds = new Set(), onExcludedChange,
}: PortalOrderCardProps) => {
  const status = order.status;
  const isPending = order.discovery_pending;
  const isQuoted = status === "quoted";
  const isDelivered = status === "delivered";
  const isApproved = !!order.customer_approved_at;

  // Status categorization
  const isEvaluation = status === "triage" || status === "consult";
  const isPickupScheduled = status === "pickup_scheduled";
  const isInProgress = ["received", "inspection", "in_progress", "qc"].includes(status);
  const isReady = status === "ready";

  const orderPhotos = photos.filter((p: any) => p.order_id === order.id);
  const orderTasks = tasks.filter((t: any) => t.order_id === order.id);
  const orderDiscoveries = discoveries.filter((d: any) => d.order_id === order.id);
  const orderMarkers = markers.filter((m: any) =>
    orderPhotos.some((p: any) => p.id === m.photo_id)
  );
  const orderAuditLogs = auditLogs.filter((a: any) => a.order_id === order.id);

  const beforePhoto = orderPhotos.find((p: any) => p.photo_type === "before");
  const afterPhoto = orderPhotos.find((p: any) => p.photo_type === "after");

  const tier = isApproved ? (order.package_tier || "standard") : selectedTier;

  // Math Fortress
  const pricing = useMemo(() => {
    const selected = orderTasks.filter((t: any) =>
      !t.is_optional || !excludedTaskIds.has(t.id)
    );
    const isBundled = order.is_bundle_applied && tier === "standard";
    let taskSum: number;
    if (tier === "elite") {
      taskSum = selected.reduce((s: number, t: any) => s + Number(t.estimated_price || 0), 0) * 1.4;
    } else {
      taskSum = selected
        .filter((t: any) => !(isBundled && t.expert_type === "cleaning"))
        .reduce((s: number, t: any) => s + Number(t.estimated_price || 0), 0);
    }
    const shippingFee = tier === "elite" ? 0 : Number(order.shipping_fee || 0);
    const cleaningFee = tier === "elite" ? 0 : (isBundled ? 299 : 0);
    const subtotal = taskSum + shippingFee + cleaningFee;
    const discount = Number(order.discount_amount || 0);
    const taxable = Math.max(0, subtotal - discount);
    const gst = order.is_gst_applicable ? Math.round(taxable * 0.18 * 100) / 100 : 0;
    const total = Math.round((taxable + gst) * 100) / 100;
    const warrantyMonths = tier === "elite" ? 6 : 3;
    const slaLabel = tier === "elite" ? "8-12 days" : "15-20 days";
    return { subtotal, discount, taxable, gst, total, warrantyMonths, slaLabel, shippingFee, cleaningFee };
  }, [orderTasks, excludedTaskIds, tier, order]);

  const toggleExcluded = (taskId: string) => {
    if (isApproved || !onExcludedChange) return;
    const next = new Set(excludedTaskIds);
    if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
    onExcludedChange(next);
  };

  // Progress bar index
  const progressIdx = PROGRESS_STEPS.findIndex(s => s.key === status);

  return (
    <div
      className={`portal-raised p-5 space-y-4 transition-all duration-300 ${
        (isQuoted || isPending) ? "ring-1 ring-[hsl(37_40%_60%/0.4)]" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-base font-medium text-[hsl(var(--portal-muted))]">
          {order.unique_asset_signature || "Restoration"}
        </span>
        <Badge className="text-[10px] rounded-full border bg-[hsl(var(--portal-surface))] text-[hsl(var(--portal-gold))] border-[hsl(var(--portal-gold)/0.3)]">
          {status}
        </Badge>
      </div>

      {/* Progress Bar (shown for non-quoted, non-evaluation statuses) */}
      {progressIdx >= 0 && !isQuoted && !isEvaluation && (
        <div className="space-y-2">
          <div className="flex items-center gap-0.5">
            {PROGRESS_STEPS.map((step, i) => (
              <div key={step.key} className="flex-1 flex flex-col items-center gap-1">
                <div className="relative w-full h-1.5 rounded-full overflow-hidden bg-[hsl(var(--portal-border))]">
                  {i <= progressIdx && (
                    <div className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(90deg, hsl(37 40% 60%), hsl(37 50% 55%))" }} />
                  )}
                </div>
                <div className="flex items-center gap-0.5">
                  {i === progressIdx && (
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "hsl(37 50% 55%)" }} />
                  )}
                  <span className={`text-[8px] font-medium ${i <= progressIdx ? "text-[hsl(var(--portal-gold))]" : "text-[hsl(var(--portal-muted))]"}`}>
                    {step.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* State: Evaluation */}
      {isEvaluation && (
        <div className="py-8 text-center space-y-2">
          <div className="inline-block portal-shimmer rounded-full px-6 py-2 text-base font-medium text-[hsl(var(--portal-gold))]">
            Being evaluated by our Restoree 360 artisans
          </div>
        </div>
      )}

      {/* State: Pickup Scheduled — Slot Booking */}
      {isPickupScheduled && (
        <SlotBookingSection
          order={order}
          slotType="pickup"
          slots={systemSettings?.pickup_slots || ["Morning (10 AM - 12 PM)", "Evening (4 PM - 6 PM)"]}
          currentSlot={order.pickup_slot}
          onAction={onAction}
        />
      )}

      {/* State: Quoted — Interactive Sales Engine */}
      {isQuoted && (
        <div className="space-y-4">
          {orderPhotos.length > 0 && (
            <PortalPhotoViewer
              photos={orderPhotos.filter((p: any) => p.photo_type === "before").map((p: any) => ({ id: p.id, url: p.url }))}
              markers={orderMarkers.map((m: any) => ({
                id: m.id, x: Number(m.x_coordinate), y: Number(m.y_coordinate), label: m.label, photoId: m.photo_id,
              }))}
            />
          )}

          {/* Tier Switcher */}
          {!isApproved && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "standard", label: "Standard", sla: "15-20 days", warranty: "3 months" },
                { key: "elite", label: "✨ Elite", sla: "8-12 days", warranty: "6 months" },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => onTierChange?.(t.key)}
                  className={`rounded-2xl p-4 text-left transition-all min-h-[48px] ${
                    tier === t.key
                      ? "portal-pressed border border-[hsl(var(--portal-gold)/0.5)]"
                      : "portal-raised opacity-70 hover:opacity-100"
                  }`}
                >
                  <p className={`text-base font-semibold ${tier === t.key ? "text-[hsl(var(--portal-gold))]" : "text-[hsl(var(--portal-text))]"}`}>
                    {t.label}
                  </p>
                  <p className="text-xs text-[hsl(var(--portal-muted))] mt-1">{t.sla}</p>
                  <p className="text-xs text-[hsl(var(--portal-muted))]">{t.warranty} warranty</p>
                </button>
              ))}
            </div>
          )}

          {/* Pricing breakdown */}
          <div className="space-y-1.5 text-base text-[hsl(var(--portal-text))]">
            {orderTasks.map((t: any) => {
              const isOpt = t.is_optional;
              const isExcluded = excludedTaskIds.has(t.id);
              const isBundledCleaning = order.is_bundle_applied && tier === "standard" && t.expert_type === "cleaning";
              return (
                <div key={t.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isOpt && !isApproved && (
                      <Checkbox checked={!isExcluded} onCheckedChange={() => toggleExcluded(t.id)} className="h-5 w-5" />
                    )}
                    <span className={`capitalize ${isExcluded || isBundledCleaning ? "line-through text-[hsl(var(--portal-muted))]" : ""}`}>
                      {t.expert_type}
                      {isOpt && <span className="text-xs ml-1 text-[hsl(var(--portal-muted))]">(optional)</span>}
                    </span>
                  </div>
                  <span className={`font-medium ${isExcluded || isBundledCleaning ? "line-through text-[hsl(var(--portal-muted))]" : ""}`}>
                    ₹{Number(t.estimated_price || 0).toLocaleString()}
                  </span>
                </div>
              );
            })}

            {pricing.shippingFee > 0 && (
              <div className="flex justify-between text-sm text-[hsl(var(--portal-muted))]">
                <span>Shipping</span><span>₹{pricing.shippingFee.toLocaleString()}</span>
              </div>
            )}
            {pricing.cleaningFee > 0 && (
              <div className="flex justify-between text-sm text-[hsl(var(--portal-muted))]">
                <span>Cleaning Fee (Bundle 50% off)</span><span>₹{pricing.cleaningFee.toLocaleString()}</span>
              </div>
            )}
            {pricing.discount > 0 && (
              <div className="flex justify-between text-sm" style={{ color: "hsl(140 50% 50%)" }}>
                <span>Discount</span><span>-₹{pricing.discount.toLocaleString()}</span>
              </div>
            )}
            {pricing.gst > 0 && (
              <div className="flex justify-between text-sm text-[hsl(var(--portal-muted))]">
                <span>GST (18%)</span><span>₹{pricing.gst.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold pt-2 border-t border-[hsl(var(--portal-border))]">
              <span>Total</span>
              <span className="text-lg text-[hsl(var(--portal-gold))]">₹{pricing.total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-[hsl(var(--portal-muted))]">
              <span>Estimated Delivery</span><span>{pricing.slaLabel}</span>
            </div>
            <div className="flex justify-between text-sm text-[hsl(var(--portal-muted))]">
              <span>Warranty</span><span>{pricing.warrantyMonths} months</span>
            </div>
          </div>

          {order.auto_sweetener_value && (
            <div className="text-base font-medium px-3 py-1.5 rounded-full inline-block bg-[hsl(var(--portal-gold)/0.15)] text-[hsl(var(--portal-gold))]">
              🎁 Bonus: {order.auto_sweetener_value}
            </div>
          )}
        </div>
      )}

      {/* Discovery Pending */}
      {isPending && orderDiscoveries.filter((d: any) => !d.approved_at).length > 0 && (
        <div className="space-y-3">
          {orderDiscoveries.filter((d: any) => !d.approved_at).map((d: any) => (
            <DiscoveryCard key={d.id} discovery={d} onApprove={() => onApproveDiscovery(d.id)} onDecline={() => onDeclineDiscovery(d.id)} />
          ))}
        </div>
      )}

      {/* In Progress */}
      {isInProgress && !isPending && (
        <div className="space-y-3 py-4">
          <div className="portal-shimmer text-center text-base font-medium py-3 rounded-xl text-[hsl(var(--portal-gold))]">
            ✨ Your item is being lovingly restored by our artisans
          </div>
        </div>
      )}

      {/* Ready — UPI Payment + Slot Booking */}
      {isReady && (
        <ReadySection order={order} pricing={pricing} systemSettings={systemSettings} onAction={onAction} onConfirmAddress={onConfirmAddress} />
      )}

      {/* Delivered */}
      {isDelivered && (
        <DeliveredSection
          order={order}
          beforePhotoUrl={beforePhoto?.url}
          afterPhotoUrl={afterPhoto?.url}
          onSubmitRating={onSubmitRating}
          onAction={onAction}
        />
      )}

      {/* History Vault */}
      {orderAuditLogs.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs text-[hsl(var(--portal-muted))] hover:text-[hsl(var(--portal-text))] transition-colors w-full">
            <Clock className="h-3 w-3" />
            <span>Activity Timeline ({orderAuditLogs.length})</span>
            <ChevronDown className="h-3 w-3 ml-auto" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-1.5">
            {orderAuditLogs.slice(0, 20).map((log: any) => (
              <div key={log.id} className="flex items-start gap-2 text-xs text-[hsl(var(--portal-muted))]">
                <span className="shrink-0 text-[9px] mt-0.5">{new Date(log.created_at).toLocaleDateString()}</span>
                <span>{log.action}: {log.field_name} — {log.reason}</span>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
});

PortalOrderCard.displayName = "PortalOrderCard";

// Slot Booking sub-component
const SlotBookingSection = React.memo(({ order, slotType, slots, currentSlot, onAction }: {
  order: any; slotType: string; slots: string[]; currentSlot: string | null; onAction?: (action: string, body: any) => Promise<void>;
}) => {
  const [selecting, setSelecting] = useState("");

  if (currentSlot) {
    return (
      <div className="flex items-center gap-2 text-base py-4" style={{ color: "hsl(140 50% 50%)" }}>
        <CheckCircle className="h-5 w-5" />
        <span>{slotType === "pickup" ? "Pickup" : "Delivery"} slot confirmed: <strong>{currentSlot}</strong></span>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-2">
      <p className="text-base font-medium text-[hsl(var(--portal-text))]">
        Select your {slotType === "pickup" ? "pickup" : "delivery"} slot:
      </p>
      <div className="grid grid-cols-2 gap-3">
        {(slots as string[]).map((slot: string) => (
          <button
            key={slot}
            onClick={async () => {
              setSelecting(slot);
              await onAction?.("select_slot", { orderId: order.id, slotType, slot });
              setSelecting("");
            }}
            disabled={!!selecting}
            className="portal-raised rounded-2xl p-4 text-left min-h-[48px] hover:border-[hsl(var(--portal-gold)/0.5)] transition-all"
          >
            {selecting === slot ? (
              <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--portal-gold))]" />
            ) : (
              <p className="text-sm font-medium text-[hsl(var(--portal-text))]">{slot}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
});
SlotBookingSection.displayName = "SlotBookingSection";

// Ready section with UPI + address
const ReadySection = React.memo(({ order, pricing, systemSettings, onAction, onConfirmAddress }: {
  order: any; pricing: any; systemSettings: any; onAction?: (action: string, body: any) => Promise<void>;
  onConfirmAddress: (orderId: string, address: string) => Promise<void>;
}) => {
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [declaring, setDeclaring] = useState(false);
  const hasConfirmed = !!order.delivery_address_confirmed_at;
  const upiId = systemSettings?.company_upi_id;
  const total = pricing.total;

  const upiLink = upiId ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=Restoree360&am=${total}&cu=INR` : null;

  return (
    <div className="space-y-4">
      {order.final_qc_video_url && (
        <video controls className="w-full rounded-xl" style={{ maxHeight: 300 }}>
          <source src={order.final_qc_video_url} />
        </video>
      )}

      {/* Dropoff slot booking */}
      {!order.dropoff_slot && (
        <SlotBookingSection
          order={order}
          slotType="dropoff"
          slots={systemSettings?.dropoff_slots || ["Morning (10 AM - 12 PM)", "Evening (4 PM - 6 PM)"]}
          currentSlot={order.dropoff_slot}
          onAction={onAction}
        />
      )}

      {/* Total Due + UPI */}
      <div className="text-center py-2">
        <p className="text-base text-[hsl(var(--portal-muted))]">Total Due</p>
        <p className="text-3xl font-bold text-[hsl(var(--portal-gold))]">
          ₹{total.toLocaleString()}
        </p>
      </div>

      {upiLink && !order.payment_declared && (
        <a
          href={upiLink}
          className="block w-full text-center min-h-[48px] leading-[48px] rounded-2xl font-medium text-base bg-[hsl(var(--portal-gold))] text-[hsl(0_0%_4%)]"
        >
          Pay via UPI
        </a>
      )}

      <Button
        onClick={async () => {
          setDeclaring(true);
          await onAction?.("declare_payment", { orderIds: [order.id] });
          setDeclaring(false);
        }}
        disabled={order.payment_declared || declaring}
        className={`w-full min-h-[48px] gap-2 text-base ${
          order.payment_declared
            ? "bg-[hsl(var(--portal-surface))] text-[hsl(var(--portal-muted))]"
            : "bg-[hsl(var(--portal-gold))] text-[hsl(0_0%_4%)]"
        }`}
      >
        {declaring || order.payment_declared ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {order.payment_declared ? "Verifying..." : "I Have Paid"}
      </Button>

      {/* Address confirmation */}
      {!hasConfirmed ? (
        <div className="space-y-2">
          <label className="text-base font-medium text-[hsl(var(--portal-muted))]">Confirm Delivery Address</label>
          <Textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter your full delivery address..."
            className="min-h-[60px] border bg-[hsl(var(--portal-surface))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text))]"
          />
          <Button
            onClick={async () => {
              if (!address.trim()) return;
              setSaving(true);
              await onConfirmAddress(order.id, address.trim());
              setSaving(false);
            }}
            disabled={saving || !address.trim()}
            className="w-full min-h-[48px] gap-2 bg-[hsl(var(--portal-gold))] text-[hsl(0_0%_4%)]"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm Address
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-base" style={{ color: "hsl(140 50% 50%)" }}>
          <CheckCircle className="h-4 w-4" /> Address confirmed
        </div>
      )}
    </div>
  );
});
ReadySection.displayName = "ReadySection";

// Discovery sub-card
const DiscoveryCard = React.memo(({ discovery, onApprove, onDecline }: { discovery: any; onApprove: () => Promise<void>; onDecline: () => Promise<void> }) => {
  const [loading, setLoading] = useState("");
  return (
    <div className="portal-raised p-4 space-y-3 border border-[hsl(var(--portal-gold)/0.3)]">
      {discovery.discovery_photo_url && (
        <img src={discovery.discovery_photo_url} alt="Discovery" className="w-full rounded-lg object-cover max-h-40" />
      )}
      <p className="text-base text-[hsl(var(--portal-text))]">{discovery.description}</p>
      {Number(discovery.extra_price) > 0 && (
        <p className="text-lg font-semibold text-[hsl(var(--portal-gold))]">+₹{Number(discovery.extra_price).toLocaleString()}</p>
      )}
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 min-h-[48px] gap-1.5 bg-[hsl(var(--portal-gold))] text-[hsl(0_0%_4%)]" disabled={!!loading}
          onClick={async () => { setLoading("approve"); await onApprove(); setLoading(""); }}>
          {loading === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />} Approve
        </Button>
        <Button variant="outline" size="sm" className="flex-1 min-h-[48px] gap-1.5 border-[hsl(var(--portal-border))] text-[hsl(var(--portal-muted))]" disabled={!!loading}
          onClick={async () => { setLoading("decline"); await onDecline(); setLoading(""); }}>
          {loading === "decline" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} Decline
        </Button>
      </div>
    </div>
  );
});
DiscoveryCard.displayName = "DiscoveryCard";

// Delivered section
const DeliveredSection = React.memo(({ order, beforePhotoUrl, afterPhotoUrl, onSubmitRating, onAction }: {
  order: any; beforePhotoUrl?: string; afterPhotoUrl?: string;
  onSubmitRating: (orderId: string, rating: number, feedback: string) => Promise<void>;
  onAction?: (action: string, body: any) => Promise<void>;
}) => {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reworking, setReworking] = useState(false);

  const daysSinceDelivery = order.updated_at
    ? Math.floor((Date.now() - new Date(order.updated_at).getTime()) / (1000 * 60 * 60 * 24))
    : 999;
  const canRequestRework = daysSinceDelivery <= 7;

  const handleSubmit = async () => {
    if (!rating) return;
    setSaving(true);
    await onSubmitRating(order.id, rating, feedback);
    setSubmitted(true);
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {beforePhotoUrl && afterPhotoUrl && (
        <BeforeAfterSlider beforeUrl={beforePhotoUrl} afterUrl={afterPhotoUrl} />
      )}

      {!submitted ? (
        <div className="space-y-3 text-center">
          <p className="text-base font-medium text-[hsl(var(--portal-text))]">How was your experience?</p>
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setRating(s)} className="p-1 min-h-[48px] min-w-[48px] transition-transform hover:scale-110">
                <Star className="h-8 w-8" fill={s <= rating ? "hsl(37 40% 60%)" : "transparent"} stroke={s <= rating ? "hsl(37 40% 60%)" : "hsl(var(--portal-muted))"} />
              </button>
            ))}
          </div>
          {rating > 0 && rating <= 3 && (
            <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Tell us how we can improve..."
              className="min-h-[60px] bg-[hsl(var(--portal-surface))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text))]" />
          )}
          {rating > 0 && (
            <Button onClick={handleSubmit} disabled={saving} className="w-full min-h-[48px] gap-2 bg-[hsl(var(--portal-gold))] text-[hsl(0_0%_4%)]">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {rating >= 4 ? "Submit & Leave a Google Review" : "Submit Feedback"}
            </Button>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-base font-medium text-[hsl(var(--portal-gold))]">Thank you for your feedback! ✨</p>
        </div>
      )}

      {/* Rework Request */}
      {canRequestRework && (
        <Button
          variant="outline"
          onClick={async () => {
            setReworking(true);
            await onAction?.("request_rework", { orderId: order.id });
            setReworking(false);
          }}
          disabled={reworking}
          className="w-full min-h-[48px] gap-2 border-[hsl(var(--portal-border))] text-[hsl(var(--portal-muted))]"
        >
          {reworking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          Request Rework ({7 - daysSinceDelivery} days left)
        </Button>
      )}
    </div>
  );
});
DeliveredSection.displayName = "DeliveredSection";

export default PortalOrderCard;
