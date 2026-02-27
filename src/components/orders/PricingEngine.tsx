import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Shield } from "lucide-react";
import type { ExpertTask, OrderDetail } from "@/hooks/useOrderDetail";

interface PricingEngineProps {
  order: OrderDetail;
  expertTasks: ExpertTask[];
  onSave: (updates: Record<string, any>) => Promise<void>;
  recalcTotalPrice: (tasks: ExpertTask[], tier: string, shipping: number, cleaning: number, bundle: boolean, discount?: number, gst?: boolean) => { subtotal: number; discounted: number; taxAmount: number; total: number };
  canEdit?: boolean;
  isGodMode?: boolean;
}

const PricingEngine = ({ order, expertTasks, onSave, recalcTotalPrice, canEdit = true, isGodMode = false }: PricingEngineProps) => {
  const effectiveCanEdit = isGodMode || canEdit;

  const [tier, setTier] = useState(order.packageTier);
  const [shippingFee, setShippingFee] = useState(String(order.shippingFee));
  const [isBundleApplied, setIsBundleApplied] = useState(order.isBundleApplied);
  const [discountAmount, setDiscountAmount] = useState(String(order.discountAmount ?? 0));
  const [discountReason, setDiscountReason] = useState(order.discountReason || "");
  const [isGstApplicable, setIsGstApplicable] = useState(order.isGstApplicable ?? false);
  const [saving, setSaving] = useState(false);

  const hasRepairTask = expertTasks.some((t) => t.expertType === "repair");
  const showBundleOption = tier === "standard" && hasRepairTask;

  useEffect(() => {
    if (!showBundleOption) setIsBundleApplied(false);
  }, [showBundleOption]);

  const isElite = tier === "elite";
  const effectiveShipping = isElite ? 0 : Number(shippingFee) || 0;
  const effectiveCleaning = isElite ? 0 : isBundleApplied ? 299 : 0;
  const warrantyMonths = isElite ? 6 : 3;
  const effectiveDiscount = Number(discountAmount) || 0;

  const calc = useMemo(
    () => recalcTotalPrice(expertTasks, tier, effectiveShipping, effectiveCleaning, isBundleApplied, effectiveDiscount, isGstApplicable),
    [expertTasks, tier, effectiveShipping, effectiveCleaning, isBundleApplied, effectiveDiscount, isGstApplicable, recalcTotalPrice]
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        package_tier: tier,
        shipping_fee: effectiveShipping,
        cleaning_fee: effectiveCleaning,
        warranty_months: warrantyMonths,
        is_bundle_applied: isBundleApplied,
        discount_amount: effectiveDiscount,
        discount_reason: discountReason || null,
        is_gst_applicable: isGstApplicable,
        total_price: calc.total,
        tax_amount: calc.taxAmount,
        total_amount_due: calc.total,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="neu-raised-sm p-4 space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">Pricing Engine</h2>
        {isGodMode && !canEdit && (
          <Badge className="text-[9px] bg-amber-100 text-amber-800 border-amber-300 gap-1">
            <Shield className="h-3 w-3" /> God Mode
          </Badge>
        )}
      </div>

      {!effectiveCanEdit && (
        <div className="rounded-[calc(var(--radius)/2)] bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
          🔒 Contract locked — pricing is read-only
        </div>
      )}

      {/* Tier Toggle */}
      <div className="flex gap-2">
        {["standard", "elite"].map((t) => (
          <button
            key={t}
            onClick={() => effectiveCanEdit && setTier(t)}
            disabled={!effectiveCanEdit}
            className={`flex-1 rounded-[var(--radius)] py-2 text-sm font-medium transition-all ${
              tier === t
                ? t === "elite"
                  ? "neu-pressed text-amber-700"
                  : "neu-pressed text-primary"
                : "text-muted-foreground hover:text-foreground"
            } ${!effectiveCanEdit ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            {t === "elite" ? "✨ Elite" : "Standard"}
          </button>
        ))}
      </div>

      {isElite && (
        <div className="rounded-[calc(var(--radius)/2)] bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
          <p className="font-medium">Elite Package Active</p>
          <p>Shipping: ₹0 · Cleaning: Waived · Warranty: 6 months · 1.4× multiplier</p>
        </div>
      )}

      {/* Itemized Breakdown */}
      <div className="space-y-2 text-sm">
        {expertTasks.map((t) => {
          const excluded = isBundleApplied && t.expertType === "cleaning";
          return (
            <div key={t.id} className="flex items-center justify-between">
              <span className={`${excluded ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {t.expertType.charAt(0).toUpperCase() + t.expertType.slice(1)} Expert
              </span>
              <span className={`font-medium ${excluded ? "line-through text-muted-foreground" : "text-foreground"}`}>
                ₹{t.estimatedPrice.toLocaleString()}
              </span>
            </div>
          );
        })}

        {/* Shipping (standard only) */}
        {!isElite && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-foreground">Shipping Fee</span>
            <Input
              type="number"
              value={shippingFee}
              onChange={(e) => setShippingFee(e.target.value)}
              className="h-8 w-24 text-right text-sm"
              placeholder="0"
              disabled={!effectiveCanEdit}
            />
          </div>
        )}

        {/* Cleaning fee line */}
        {effectiveCleaning > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-foreground">
              Cleaning Fee {isBundleApplied && <Badge variant="secondary" className="text-[9px] ml-1">50% off</Badge>}
            </span>
            <span className="font-medium text-foreground">₹{effectiveCleaning.toLocaleString()}</span>
          </div>
        )}

        {/* Bundle checkbox */}
        {showBundleOption && (
          <div className="flex items-center gap-2 rounded-[calc(var(--radius)/2)] border border-dashed border-primary/30 bg-primary/5 p-2.5">
            <Checkbox
              id="bundle"
              checked={isBundleApplied}
              onCheckedChange={(checked) => effectiveCanEdit && setIsBundleApplied(!!checked)}
              disabled={!effectiveCanEdit}
            />
            <label htmlFor="bundle" className="text-xs font-medium text-foreground cursor-pointer">
              Apply Repair-Cleaning Bundle (50% Off Cleaning — ₹299)
            </label>
          </div>
        )}

        {/* Subtotal */}
        <div className="border-t border-border pt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Subtotal</span>
          <span>₹{calc.subtotal.toLocaleString()}</span>
        </div>

        {/* Discount */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-green-600 font-medium text-xs">Discount</span>
          <Input
            type="number"
            value={discountAmount}
            onChange={(e) => setDiscountAmount(e.target.value)}
            className="h-8 w-24 text-right text-sm"
            placeholder="0"
            disabled={!effectiveCanEdit}
          />
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={discountReason}
            onChange={(e) => setDiscountReason(e.target.value)}
            className="h-8 text-xs"
            placeholder="Discount reason..."
            disabled={!effectiveCanEdit}
          />
        </div>

        {/* After discount */}
        {effectiveDiscount > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>After Discount</span>
            <span>₹{calc.discounted.toLocaleString()}</span>
          </div>
        )}

        {/* GST Toggle */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="gst"
            checked={isGstApplicable}
            onCheckedChange={(checked) => effectiveCanEdit && setIsGstApplicable(!!checked)}
            disabled={!effectiveCanEdit}
          />
          <label htmlFor="gst" className="text-xs font-medium text-foreground cursor-pointer">
            Apply GST (18%)
          </label>
          {isGstApplicable && (
            <span className="ml-auto text-xs text-muted-foreground">₹{calc.taxAmount.toLocaleString()}</span>
          )}
        </div>

        {/* Total Due */}
        <div className="border-t border-border pt-2 flex items-center justify-between">
          <span className="font-semibold text-foreground">Total Due</span>
          <span className="text-lg font-bold text-primary">₹{calc.total.toLocaleString()}</span>
        </div>

        {/* Warranty */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Warranty</span>
          <span>{warrantyMonths} months</span>
        </div>
      </div>

      {effectiveCanEdit && (
        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Pricing
        </Button>
      )}
    </section>
  );
};

export default React.memo(PricingEngine);
