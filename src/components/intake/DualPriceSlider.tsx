import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Truck, Zap, Crown, Shield, Gem } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  basePrice: number;
  onBasePriceChange: (price: number) => void;
  selectedTier: "Premium" | "Elite";
  onTierChange: (tier: "Premium" | "Elite") => void;
  minPrice: number;
  error?: string;
};

const SHIPPING_FLAT = 200;

const DualPriceSlider = ({ basePrice, onBasePriceChange, selectedTier, onTierChange, minPrice, error }: Props) => {
  const premiumTotal = basePrice + SHIPPING_FLAT;
  const eliteTotal = Math.round(basePrice * 1.4);

  const handleChange = (v: number) => {
    onBasePriceChange(Math.max(v, minPrice));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">₹{(minPrice / 1000).toFixed(0)}K</span>
        <Slider
          min={minPrice}
          max={50000}
          step={500}
          value={[basePrice]}
          onValueChange={([v]) => handleChange(v)}
          className="flex-1 [&_[role=slider]]:h-7 [&_[role=slider]]:w-7"
        />
        <span className="text-[10px] text-muted-foreground">₹50K</span>
        <Input
          type="number"
          min={minPrice}
          max={50000}
          step={500}
          value={basePrice || ""}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v >= minPrice && v <= 50000) onBasePriceChange(v);
          }}
          className="w-20 text-center text-sm font-semibold"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Side-by-side tier cards — Elite is DOMINANT */}
      <div className="grid grid-cols-5 gap-2">
        {/* Elite — 3/5 width, dominant */}
        <button
          type="button"
          onClick={() => onTierChange("Elite")}
          className="col-span-3 text-left"
        >
          <Card className={cn(
            "p-4 space-y-2 relative overflow-hidden transition-all",
            selectedTier === "Elite"
              ? "border-primary bg-primary/10 ring-2 ring-primary shadow-[0_0_24px_-4px_hsl(var(--primary)/0.4)]"
              : "border-primary/30 bg-primary/5 hover:border-primary/50"
          )}>
            <Badge className="absolute top-0 right-0 rounded-none rounded-bl-lg text-[9px] bg-primary text-primary-foreground px-2">
              RECOMMENDED
            </Badge>
            <div className="flex items-center gap-1.5">
              <Zap className="h-5 w-5 text-primary" />
              <span className="text-sm font-extrabold text-foreground">Elite Artisan</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-1"><Shield className="h-3 w-3 text-primary" /> Master Artisan Dual-Stage Check</p>
              <p className="flex items-center gap-1"><Gem className="h-3 w-3 text-primary" /> Imported Italian Pigments</p>
              <p>Nano-Ceramic Shield Protection</p>
              <p>8–12 Day Express Delivery</p>
              <p className="text-primary font-medium flex items-center gap-1"><Truck className="h-3 w-3" /> FREE Pan-India Shipping</p>
            </div>
            <p className="text-2xl font-black text-primary">₹{eliteTotal.toLocaleString()}</p>
          </Card>
        </button>

        {/* Premium — 2/5 width, muted */}
        <button
          type="button"
          onClick={() => onTierChange("Premium")}
          className="col-span-2 text-left"
        >
          <Card className={cn(
            "p-3 space-y-1.5 transition-all h-full",
            selectedTier === "Premium"
              ? "border-primary bg-primary/5 ring-2 ring-primary/30"
              : "border-border opacity-50 hover:opacity-70"
          )}>
            <div className="flex items-center gap-1">
              <Crown className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-bold text-foreground">Premium</span>
            </div>
            <div className="text-[10px] text-muted-foreground space-y-0.5">
              <p>Professional Grade</p>
              <p>Standard Materials</p>
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
