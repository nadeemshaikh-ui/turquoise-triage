import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { IndianRupee, Truck, Zap, Crown } from "lucide-react";

type Props = {
  basePrice: number;
  onBasePriceChange: (price: number) => void;
  error?: string;
};

const SHIPPING_FLAT = 200;

const DualPriceSlider = ({ basePrice, onBasePriceChange, error }: Props) => {
  const premiumTotal = basePrice + SHIPPING_FLAT;
  const eliteTotal = Math.round(basePrice * 1.4);

  return (
    <div className="space-y-4">
      <div>
        <Label className="flex items-center gap-1 mb-2">
          <IndianRupee className="h-3.5 w-3.5" />
          Base Price
        </Label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground whitespace-nowrap">₹1,000</span>
          <Slider
            min={1000}
            max={50000}
            step={500}
            value={[basePrice]}
            onValueChange={([v]) => onBasePriceChange(v)}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap">₹50,000</span>
        </div>
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
          className="mt-2 text-center font-semibold"
          placeholder="Enter price"
        />
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>

      {/* Side-by-side tier comparison */}
      <div className="grid grid-cols-2 gap-3">
        {/* Premium */}
        <Card className="p-3 space-y-2 border-border">
          <div className="flex items-center gap-1.5">
            <Crown className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Premium</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>15–20 Day Standard</p>
            <p>Professional Grade</p>
            <p className="flex items-center gap-1"><Truck className="h-3 w-3" /> +₹{SHIPPING_FLAT} Shipping</p>
          </div>
          <p className="text-lg font-bold text-foreground">₹{premiumTotal.toLocaleString()}</p>
        </Card>

        {/* Elite */}
        <Card className="p-3 space-y-2 border-primary bg-primary/5 relative overflow-hidden">
          <Badge className="absolute -top-0 right-0 rounded-none rounded-bl-lg text-[10px] bg-primary text-primary-foreground">
            RECOMMENDED
          </Badge>
          <div className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Elite Artisan</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>8–12 Day Express</p>
            <p>Master Artisan Check</p>
            <p className="flex items-center gap-1 text-primary"><Truck className="h-3 w-3" /> FREE Shipping</p>
          </div>
          <p className="text-lg font-bold text-primary">₹{eliteTotal.toLocaleString()}</p>
        </Card>
      </div>
    </div>
  );
};

export default DualPriceSlider;
