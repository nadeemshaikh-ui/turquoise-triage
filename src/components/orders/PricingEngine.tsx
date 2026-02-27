import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save } from "lucide-react";
import type { ExpertTask, OrderDetail } from "@/hooks/useOrderDetail";

interface PricingEngineProps {
  order: OrderDetail;
  expertTasks: ExpertTask[];
  onSave: (updates: Record<string, any>) => Promise<void>;
  recalcTotalPrice: (tasks: ExpertTask[], tier: string, shipping: number, cleaning: number, bundle: boolean, discount?: number, gst?: boolean) => number;
}

const PricingEngine = ({ order, expertTasks, onSave, recalcTotalPrice }: PricingEngineProps) => {
  const [tier, setTier] = useState(order.packageTier);
  const [shippingFee, setShippingFee] = useState(String(order.shippingFee));
  const [isBundleApplied, setIsBundleApplied] = useState(order.isBundleApplied);
  const [discountAmount, setDiscountAmount] = useState(String((order as any).discountAmount ?? 0));
  const [isGstApplicable, setIsGstApplicable] = useState((order as any).isGstApplicable ?? false);
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

  const total = useMemo(
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
        is_gst_applicable: isGstApplicable,
        total_price: total,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="neu-raised-sm p-4 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">Pricing Engine</h2>

      {/* Tier Toggle */}
      <div className="flex gap-2">
        {["standard", "elite"].map((t) => (
          <button
            key={t}
            onClick={() => setTier(t)}
            className={`flex-1 rounded-[var(--radius)] py-2 text-sm font-medium transition-all ${
              tier === t
                ? t === "elite"
                  ? "neu-pressed text-amber-700"
                  : "neu-pressed text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "elite" ? "✨ Elite" : "Standard"}
          </button>
        ))}
      </div>

      {isElite && (
        <div className="rounded-[calc(var(--radius)/2)] bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
          <p className="font-medium">Elite Package Active</p>
          <p>Shipping: ₹0 · Cleaning: Waived · Warranty: 6 months</p>
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
              onCheckedChange={(checked) => setIsBundleApplied(!!checked)}
            />
            <label htmlFor="bundle" className="text-xs font-medium text-foreground cursor-pointer">
              Apply Repair-Cleaning Bundle (50% Off Cleaning — ₹299)
            </label>
          </div>
        )}

        {/* Discount */}
        {!isElite && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-foreground">Discount</span>
            <Input
              type="number"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              className="h-8 w-24 text-right text-sm"
              placeholder="0"
            />
          </div>
        )}

        {/* GST Toggle */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="gst"
            checked={isGstApplicable}
            onCheckedChange={(checked) => setIsGstApplicable(!!checked)}
          />
          <label htmlFor="gst" className="text-xs font-medium text-foreground cursor-pointer">
            Apply GST (18%)
          </label>
        </div>

        {/* Divider + Total */}
        <div className="border-t border-border pt-2 flex items-center justify-between">
          <span className="font-semibold text-foreground">Total</span>
          <span className="text-lg font-bold text-primary">₹{total.toLocaleString()}</span>
        </div>

        {/* Warranty */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Warranty</span>
          <span>{warrantyMonths} months</span>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save Pricing
      </Button>
    </section>
  );
};

export default PricingEngine;
