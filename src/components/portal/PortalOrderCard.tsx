import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle, XCircle, Star } from "lucide-react";
import PortalPhotoViewer, { BeforeAfterSlider } from "./PortalPhotoViewer";

interface PortalOrderCardProps {
  order: any;
  tasks: any[];
  photos: any[];
  discoveries: any[];
  markers: any[];
  onApproveDiscovery: (discoveryId: string) => Promise<void>;
  onDeclineDiscovery: (discoveryId: string) => Promise<void>;
  onConfirmAddress: (orderId: string, address: string) => Promise<void>;
  onSubmitRating: (orderId: string, rating: number, feedback: string) => Promise<void>;
  selectedTier?: string;
  onTierChange?: (tier: string) => void;
  excludedTaskIds?: Set<string>;
  onExcludedChange?: (excluded: Set<string>) => void;
}

const PortalOrderCard = React.memo(({
  order, tasks, photos, discoveries, markers,
  onApproveDiscovery, onDeclineDiscovery, onConfirmAddress, onSubmitRating,
  selectedTier = "standard", onTierChange, excludedTaskIds = new Set(), onExcludedChange,
}: PortalOrderCardProps) => {
  const status = order.status;
  const isPending = order.discovery_pending;
  const isQuoted = status === "quoted";
  const isWorkshop = status === "workshop" || status === "qc";
  const isDelivered = status === "delivered";
  const isTriage = status === "triage" || status === "consult";
  const isQcReady = status === "qc" && !isPending;
  const isApproved = !!order.customer_approved_at;

  const orderPhotos = photos.filter((p: any) => p.order_id === order.id);
  const orderTasks = tasks.filter((t: any) => t.order_id === order.id);
  const orderDiscoveries = discoveries.filter((d: any) => d.order_id === order.id);
  const orderMarkers = markers.filter((m: any) =>
    orderPhotos.some((p: any) => p.id === m.photo_id)
  );

  // Derive before/after photos for delivered slider
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

      {/* State A: Triage/Consult */}
      {isTriage && (
        <div className="py-8 text-center space-y-2">
          <div className="inline-block portal-shimmer rounded-full px-6 py-2 text-base font-medium text-[hsl(var(--portal-gold))]">
            Being evaluated by our Restoree 360 artisans
          </div>
        </div>
      )}

      {/* State B: Quoted — Interactive Sales Engine */}
      {isQuoted && (
        <div className="space-y-4">
          {/* Photo Gallery */}
          {orderPhotos.length > 0 && (
            <PortalPhotoViewer
              photos={orderPhotos.map((p: any) => ({ id: p.id, url: p.url }))}
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

          {/* Pricing breakdown with optional task toggles */}
          <div className="space-y-1.5 text-base text-[hsl(var(--portal-text))]">
            {orderTasks.map((t: any) => {
              const isOpt = t.is_optional;
              const isExcluded = excludedTaskIds.has(t.id);
              const isBundledCleaning = order.is_bundle_applied && tier === "standard" && t.expert_type === "cleaning";
              return (
                <div key={t.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isOpt && !isApproved && (
                      <Checkbox
                        checked={!isExcluded}
                        onCheckedChange={() => toggleExcluded(t.id)}
                        className="h-5 w-5"
                      />
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
                <span>Shipping</span>
                <span>₹{pricing.shippingFee.toLocaleString()}</span>
              </div>
            )}
            {pricing.cleaningFee > 0 && (
              <div className="flex justify-between text-sm text-[hsl(var(--portal-muted))]">
                <span>Cleaning Fee (Bundle 50% off)</span>
                <span>₹{pricing.cleaningFee.toLocaleString()}</span>
              </div>
            )}

            {pricing.discount > 0 && (
              <div className="flex justify-between text-sm" style={{ color: "hsl(140 50% 50%)" }}>
                <span>Discount</span>
                <span>-₹{pricing.discount.toLocaleString()}</span>
              </div>
            )}

            {pricing.gst > 0 && (
              <div className="flex justify-between text-sm text-[hsl(var(--portal-muted))]">
                <span>GST (18%)</span>
                <span>₹{pricing.gst.toLocaleString()}</span>
              </div>
            )}

            <div className="flex justify-between font-semibold pt-2 border-t border-[hsl(var(--portal-border))]">
              <span>Total</span>
              <span className="text-lg text-[hsl(var(--portal-gold))]">₹{pricing.total.toLocaleString()}</span>
            </div>

            <div className="flex justify-between text-sm text-[hsl(var(--portal-muted))]">
              <span>Estimated Delivery</span>
              <span>{pricing.slaLabel}</span>
            </div>
            <div className="flex justify-between text-sm text-[hsl(var(--portal-muted))]">
              <span>Warranty</span>
              <span>{pricing.warrantyMonths} months</span>
            </div>

            {Number(order.advance_required) > 0 && (
              <div className="flex justify-between font-medium text-[hsl(var(--portal-gold))]">
                <span>Advance Required</span>
                <span>₹{Number(order.advance_required).toLocaleString()}</span>
              </div>
            )}
          </div>

          {order.auto_sweetener_value && (
            <div className="text-base font-medium px-3 py-1.5 rounded-full inline-block bg-[hsl(var(--portal-gold)/0.15)] text-[hsl(var(--portal-gold))]">
              🎁 Bonus: {order.auto_sweetener_value}
            </div>
          )}
        </div>
      )}

      {/* State C: Discovery Pending */}
      {isPending && orderDiscoveries.filter((d: any) => !d.approved_at).length > 0 && (
        <div className="space-y-3">
          {orderDiscoveries.filter((d: any) => !d.approved_at).map((d: any) => (
            <DiscoveryCard
              key={d.id}
              discovery={d}
              onApprove={() => onApproveDiscovery(d.id)}
              onDecline={() => onDeclineDiscovery(d.id)}
            />
          ))}
        </div>
      )}

      {/* State D: Workshop/QC Progress */}
      {isWorkshop && !isPending && (
        <div className="space-y-3 py-4">
          <div className="portal-shimmer text-center text-base font-medium py-3 rounded-xl text-[hsl(var(--portal-gold))]">
            ✨ Your item is being lovingly restored by our artisans
          </div>
          <div className="w-full rounded-full h-2 overflow-hidden bg-[hsl(var(--portal-border))]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: status === "qc" ? "85%" : "50%",
                background: "linear-gradient(90deg, hsl(var(--portal-gold-dim)), hsl(var(--portal-gold)))",
              }}
            />
          </div>
          <p className="text-center text-xs text-[hsl(var(--portal-muted))]">
            {status === "qc" ? "Quality check in progress" : "Restoration underway"}
          </p>
        </div>
      )}

      {/* State E: QC Ready */}
      {isQcReady && (
        <QcReadySection order={order} onConfirmAddress={onConfirmAddress} />
      )}

      {/* State F: Delivered */}
      {isDelivered && (
        <DeliveredSection
          order={order}
          beforePhotoUrl={beforePhoto?.url}
          afterPhotoUrl={afterPhoto?.url}
          onSubmitRating={onSubmitRating}
        />
      )}
    </div>
  );
});

PortalOrderCard.displayName = "PortalOrderCard";

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
        <p className="text-lg font-semibold text-[hsl(var(--portal-gold))]">
          +₹{Number(discovery.extra_price).toLocaleString()}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 min-h-[48px] gap-1.5 bg-[hsl(var(--portal-gold))] text-[hsl(0_0%_4%)]"
          disabled={!!loading}
          onClick={async () => { setLoading("approve"); await onApprove(); setLoading(""); }}
        >
          {loading === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
          Approve
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 min-h-[48px] gap-1.5 border-[hsl(var(--portal-border))] text-[hsl(var(--portal-muted))]"
          disabled={!!loading}
          onClick={async () => { setLoading("decline"); await onDecline(); setLoading(""); }}
        >
          {loading === "decline" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
          Decline
        </Button>
      </div>
    </div>
  );
});

DiscoveryCard.displayName = "DiscoveryCard";

// QC Ready section
const QcReadySection = React.memo(({ order, onConfirmAddress }: { order: any; onConfirmAddress: (orderId: string, address: string) => Promise<void> }) => {
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const hasConfirmed = !!order.delivery_address_confirmed_at;

  return (
    <div className="space-y-3">
      {order.final_qc_video_url && (
        <video controls className="w-full rounded-xl" style={{ maxHeight: 300 }}>
          <source src={order.final_qc_video_url} />
        </video>
      )}
      {Number(order.balance_remaining) > 0 && (
        <div className="text-center py-2">
          <p className="text-base text-[hsl(var(--portal-muted))]">Balance Due</p>
          <p className="text-2xl font-bold text-[hsl(var(--portal-gold))]">
            ₹{Number(order.balance_remaining).toLocaleString()}
          </p>
        </div>
      )}
      {!hasConfirmed ? (
        <div className="space-y-2">
          <label className="text-base font-medium text-[hsl(var(--portal-muted))]">
            Confirm Delivery Address
          </label>
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

QcReadySection.displayName = "QcReadySection";

// Delivered section with delight loop
const DeliveredSection = React.memo(({ order, beforePhotoUrl, afterPhotoUrl, onSubmitRating }: {
  order: any;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
  onSubmitRating: (orderId: string, rating: number, feedback: string) => Promise<void>;
}) => {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

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
          <p className="text-base font-medium text-[hsl(var(--portal-text))]">
            How was your experience?
          </p>
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setRating(s)}
                className="p-1 min-h-[48px] min-w-[48px] transition-transform hover:scale-110"
              >
                <Star
                  className="h-8 w-8"
                  fill={s <= rating ? "hsl(37 40% 60%)" : "transparent"}
                  stroke={s <= rating ? "hsl(37 40% 60%)" : "hsl(var(--portal-muted))"}
                />
              </button>
            ))}
          </div>
          {rating > 0 && rating <= 3 && (
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us how we can improve..."
              className="min-h-[60px] bg-[hsl(var(--portal-surface))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text))]"
            />
          )}
          {rating > 0 && (
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full min-h-[48px] gap-2 bg-[hsl(var(--portal-gold))] text-[hsl(0_0%_4%)]"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {rating >= 4 ? "Submit & Leave a Google Review" : "Submit Feedback"}
            </Button>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-base font-medium text-[hsl(var(--portal-gold))]">
            Thank you for your feedback! ✨
          </p>
        </div>
      )}
    </div>
  );
});

DeliveredSection.displayName = "DeliveredSection";

export default PortalOrderCard;
