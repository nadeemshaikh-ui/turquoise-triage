import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
}

const PortalOrderCard = ({
  order, tasks, photos, discoveries, markers,
  onApproveDiscovery, onDeclineDiscovery, onConfirmAddress, onSubmitRating,
  beforePhotoUrl, afterPhotoUrl,
}: PortalOrderCardProps) => {
  const status = order.status;
  const isPending = order.discovery_pending;
  const isQuoted = status === "quoted";
  const isWorkshop = status === "workshop" || status === "qc";
  const isDelivered = status === "delivered";
  const isTriage = status === "triage" || status === "consult";
  const isQcReady = status === "qc" && !isPending;

  const orderPhotos = photos.filter((p: any) => p.order_id === order.id);
  const orderTasks = tasks.filter((t: any) => t.order_id === order.id);
  const orderDiscoveries = discoveries.filter((d: any) => d.order_id === order.id);
  const primaryPhoto = orderPhotos[0];
  const primaryMarkers = primaryPhoto
    ? markers.filter((m: any) => m.photo_id === primaryPhoto.id).map((m: any) => ({
        id: m.id, x: Number(m.x_coordinate), y: Number(m.y_coordinate), label: m.label,
      }))
    : [];

  return (
    <div
      className={`portal-raised p-5 space-y-4 transition-all duration-300 ${
        (isQuoted || isPending) ? "ring-1 ring-[hsl(37_40%_60%/0.4)] animate-pulse" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: "hsl(var(--portal-muted))" }}>
          {order.unique_asset_signature || "Restoration"}
        </span>
        <Badge
          className="text-[10px] rounded-full border"
          style={{
            background: "hsl(var(--portal-surface))",
            color: "hsl(var(--portal-gold))",
            borderColor: "hsl(var(--portal-gold) / 0.3)",
          }}
        >
          {status}
        </Badge>
      </div>

      {/* State A: Triage/Consult */}
      {isTriage && (
        <div className="py-8 text-center space-y-2">
          <div className="inline-block portal-shimmer rounded-full px-6 py-2 text-sm font-medium" style={{ color: "hsl(var(--portal-gold))" }}>
            Being evaluated by our Elite Artisans
          </div>
        </div>
      )}

      {/* State B: Quoted */}
      {isQuoted && (
        <div className="space-y-4">
          {primaryPhoto && (
            <PortalPhotoViewer photoUrl={primaryPhoto.url} markers={primaryMarkers} />
          )}

          {/* Pricing breakdown */}
          <div className="space-y-1 text-xs" style={{ color: "hsl(var(--portal-text))" }}>
            {orderTasks.map((t: any) => (
              <div key={t.id} className="flex justify-between">
                <span className="capitalize">{t.expert_type}</span>
                <span>₹{Number(t.estimated_price || 0).toLocaleString()}</span>
              </div>
            ))}
            {Number(order.discount_amount) > 0 && (
              <div className="flex justify-between" style={{ color: "hsl(140 50% 50%)" }}>
                <span>Discount</span>
                <span className="line-through">-₹{Number(order.discount_amount).toLocaleString()}</span>
              </div>
            )}
            {Number(order.tax_amount) > 0 && (
              <div className="flex justify-between">
                <span>GST (18%)</span>
                <span>₹{Number(order.tax_amount).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold pt-1 border-t" style={{ borderColor: "hsl(var(--portal-border))" }}>
              <span>Total</span>
              <span style={{ color: "hsl(var(--portal-gold))" }}>₹{Number(order.total_amount_due || order.total_price || 0).toLocaleString()}</span>
            </div>
            {Number(order.advance_required) > 0 && (
              <div className="flex justify-between font-medium" style={{ color: "hsl(var(--portal-gold))" }}>
                <span>Advance Required</span>
                <span>₹{Number(order.advance_required).toLocaleString()}</span>
              </div>
            )}
          </div>

          {order.auto_sweetener_value && (
            <div className="text-xs font-medium px-3 py-1.5 rounded-full inline-block" style={{ background: "hsl(var(--portal-gold) / 0.15)", color: "hsl(var(--portal-gold))" }}>
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
          <div className="portal-shimmer text-center text-sm font-medium py-3 rounded-xl" style={{ color: "hsl(var(--portal-gold))" }}>
            ✨ Your item is being lovingly restored by our artisans
          </div>
          <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: "hsl(var(--portal-surface))" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: status === "qc" ? "85%" : "50%",
                background: "linear-gradient(90deg, hsl(var(--portal-gold-dim)), hsl(var(--portal-gold)))",
              }}
            />
          </div>
          <p className="text-center text-[10px]" style={{ color: "hsl(var(--portal-muted))" }}>
            {status === "qc" ? "Quality check in progress" : "Restoration underway"}
          </p>
        </div>
      )}

      {/* State E: QC Ready — balance + address */}
      {isQcReady && (
        <QcReadySection
          order={order}
          onConfirmAddress={onConfirmAddress}
        />
      )}

      {/* State F: Delivered */}
      {isDelivered && (
        <DeliveredSection
          order={order}
          beforePhotoUrl={beforePhotoUrl}
          afterPhotoUrl={afterPhotoUrl}
          onSubmitRating={onSubmitRating}
        />
      )}
    </div>
  );
};

// Discovery sub-card
const DiscoveryCard = ({ discovery, onApprove, onDecline }: { discovery: any; onApprove: () => Promise<void>; onDecline: () => Promise<void> }) => {
  const [loading, setLoading] = useState("");

  return (
    <div className="portal-raised p-4 space-y-3" style={{ borderColor: "hsl(37 40% 60% / 0.3)", borderWidth: "1px" }}>
      {discovery.discovery_photo_url && (
        <img src={discovery.discovery_photo_url} alt="Discovery" className="w-full rounded-lg object-cover max-h-40" />
      )}
      <p className="text-xs" style={{ color: "hsl(var(--portal-text))" }}>{discovery.description}</p>
      {Number(discovery.extra_price) > 0 && (
        <p className="text-sm font-semibold" style={{ color: "hsl(var(--portal-gold))" }}>
          +₹{Number(discovery.extra_price).toLocaleString()}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 gap-1.5"
          style={{ background: "hsl(var(--portal-gold))", color: "hsl(0 0% 4%)" }}
          disabled={!!loading}
          onClick={async () => { setLoading("approve"); await onApprove(); setLoading(""); }}
        >
          {loading === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
          Approve
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          style={{ borderColor: "hsl(var(--portal-border))", color: "hsl(var(--portal-muted))" }}
          disabled={!!loading}
          onClick={async () => { setLoading("decline"); await onDecline(); setLoading(""); }}
        >
          {loading === "decline" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
          Decline
        </Button>
      </div>
    </div>
  );
};

// QC Ready section
const QcReadySection = ({ order, onConfirmAddress }: { order: any; onConfirmAddress: (orderId: string, address: string) => Promise<void> }) => {
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
          <p className="text-xs" style={{ color: "hsl(var(--portal-muted))" }}>Balance Due</p>
          <p className="text-2xl font-bold" style={{ color: "hsl(var(--portal-gold))" }}>
            ₹{Number(order.balance_remaining).toLocaleString()}
          </p>
        </div>
      )}
      {!hasConfirmed ? (
        <div className="space-y-2">
          <label className="text-xs font-medium" style={{ color: "hsl(var(--portal-muted))" }}>
            Confirm Delivery Address
          </label>
          <Textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter your full delivery address..."
            className="min-h-[60px] border"
            style={{
              background: "hsl(var(--portal-surface))",
              borderColor: "hsl(var(--portal-border))",
              color: "hsl(var(--portal-text))",
            }}
          />
          <Button
            onClick={async () => {
              if (!address.trim()) return;
              setSaving(true);
              await onConfirmAddress(order.id, address.trim());
              setSaving(false);
            }}
            disabled={saving || !address.trim()}
            className="w-full gap-2"
            style={{ background: "hsl(var(--portal-gold))", color: "hsl(0 0% 4%)" }}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm Address
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs" style={{ color: "hsl(140 50% 50%)" }}>
          <CheckCircle className="h-4 w-4" /> Address confirmed
        </div>
      )}
    </div>
  );
};

// Delivered section with delight loop
const DeliveredSection = ({ order, beforePhotoUrl, afterPhotoUrl, onSubmitRating }: {
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
          <p className="text-sm font-medium" style={{ color: "hsl(var(--portal-text))" }}>
            How was your experience?
          </p>
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setRating(s)}
                className="p-1 transition-transform hover:scale-110"
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
              className="min-h-[60px]"
              style={{
                background: "hsl(var(--portal-surface))",
                borderColor: "hsl(var(--portal-border))",
                color: "hsl(var(--portal-text))",
              }}
            />
          )}
          {rating > 0 && (
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full gap-2"
              style={{ background: "hsl(var(--portal-gold))", color: "hsl(0 0% 4%)" }}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {rating >= 4 ? "Submit & Leave a Google Review" : "Submit Feedback"}
            </Button>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm font-medium" style={{ color: "hsl(var(--portal-gold))" }}>
            Thank you for your feedback! ✨
          </p>
        </div>
      )}
    </div>
  );
};

export default PortalOrderCard;
