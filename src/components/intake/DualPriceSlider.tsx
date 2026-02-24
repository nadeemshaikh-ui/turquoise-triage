import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Truck, Zap, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  basePrice: number;
  onBasePriceChange: (price: number) => void;
  selectedTier: "Premium" | "Elite";
  onTierChange: (tier: "Premium" | "Elite") => void;
  error?: string;
};

const SHIPPING_FLAT = 200;

const DualPriceSlider = ({ basePrice, onBasePriceChange, selectedTier, onTierChange, error }: Props) => {
  const premiumTotal = basePrice + SHIPPING_FLAT;
  const eliteTotal = Math.round(basePrice * 1.4);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">₹1K</span>
        <Slider
          min={1000}
          max={50000}
          step={500}
          value={[basePrice]}
          onValueChange={([v]) => onBasePriceChange(v)}
          className="flex-1 [&_[role=slider]]:h-7 [&_[role=slider]]:w-7"
        />
        <span className="text-[10px] text-muted-foreground">₹50K</span>
        <Input
          type="number"
          min={1000}
          max={50000}
          step={500}
          value={basePrice || ""}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v >= 0 && v <= 50000) onBasePriceChange(v);
          }}
          className="w-20 text-center text-sm font-semibold"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Side-by-side tier cards */}
      <div className="grid grid-cols-2 gap-2">
        {/* Elite */}
        <button
          type="button"
          onClick={() => onTierChange("Elite")}
          className="text-left"
        >
          <Card className={cn(
            "p-2.5 space-y-1 relative overflow-hidden transition-all",
            selectedTier === "Elite"
              ? "border-primary bg-primary/5 ring-2 ring-primary/30 shadow-lg"
              : "border-border opacity-60"
          )}>
            <Badge className="absolute -top-0 right-0 rounded-none rounded-bl-lg text-[9px] bg-primary text-primary-foreground">
              RECOMMENDED
            </Badge>
            <div className="flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold text-foreground">Elite Artisan</span>
            </div>
            <div className="text-[10px] text-muted-foreground space-y-0.5">
              <p>8–12 Day Express</p>
              <p className="text-primary flex items-center gap-0.5"><Truck className="h-2.5 w-2.5" /> FREE Shipping</p>
            </div>
            <p className="text-base font-bold text-primary">₹{eliteTotal.toLocaleString()}</p>
          </Card>
        </button>

        {/* Premium */}
        <button
          type="button"
          onClick={() => onTierChange("Premium")}
          className="text-left"
        >
          <Card className={cn(
            "p-2.5 space-y-1 transition-all",
            selectedTier === "Premium"
              ? "border-primary bg-primary/5 ring-2 ring-primary/30 shadow-lg"
              : "border-border opacity-60"
          )}>
            <div className="flex items-center gap-1">
              <Crown className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-bold text-foreground">Premium</span>
            </div>
            <div className="text-[10px] text-muted-foreground space-y-0.5">
              <p>15–20 Day Standard</p>
              <p className="flex items-center gap-0.5"><Truck className="h-2.5 w-2.5" /> +₹{SHIPPING_FLAT}</p>
            </div>
            <p className="text-base font-bold text-foreground">₹{premiumTotal.toLocaleString()}</p>
          </Card>
        </button>
      </div>
    </div>
  );
};

export default DualPriceSlider;
