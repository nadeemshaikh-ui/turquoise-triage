import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Crown, Clock, IndianRupee } from "lucide-react";
import type { Service } from "./ServiceSelection";

type Props = {
  service: Service;
  quotedPrice: string;
  onPriceChange: (v: string) => void;
  tatMin: number;
  tatMax: number;
  onTatMinChange: (v: number) => void;
  onTatMaxChange: (v: number) => void;
  isGoldTier: boolean;
  customerName: string;
  priceError?: string;
};

const TatConfirmation = ({
  service,
  quotedPrice,
  onPriceChange,
  tatMin,
  tatMax,
  onTatMinChange,
  onTatMaxChange,
  isGoldTier,
  customerName,
  priceError,
}: Props) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">Confirm & Submit</h2>
        <p className="text-sm text-muted-foreground">Review pricing and turnaround time</p>
      </div>

      {/* Summary card */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{service.name}</span>
          <Badge variant="outline" className="text-xs">{service.category}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Customer: {customerName}</p>
        {isGoldTier && (
          <Badge className="gap-1 bg-gold text-gold-foreground">
            <Crown className="h-3 w-3" />
            Gold Tier
          </Badge>
        )}
      </div>

      {/* Price */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1">
          <IndianRupee className="h-3.5 w-3.5" />
          Quoted Price *
        </Label>
        {service.price_range_min && service.price_range_max && (
          <p className="text-xs text-muted-foreground">
            Consultative range: ₹{service.price_range_min.toLocaleString()} – ₹{service.price_range_max.toLocaleString()}
          </p>
        )}
        <Input
          type="number"
          placeholder={service.default_price ? String(service.default_price) : "Enter price"}
          value={quotedPrice}
          onChange={(e) => onPriceChange(e.target.value)}
        />
        {priceError && <p className="text-xs text-destructive">{priceError}</p>}
      </div>

      {/* TAT */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          Turnaround Time (days)
        </Label>
        <p className="text-xs text-muted-foreground">
          Default: {service.default_tat_min}–{service.default_tat_max} days. Override if needed.
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={tatMin}
            onChange={(e) => onTatMinChange(Number(e.target.value))}
            className="w-20 text-center"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="number"
            min={1}
            value={tatMax}
            onChange={(e) => onTatMaxChange(Number(e.target.value))}
            className="w-20 text-center"
          />
          <span className="text-sm text-muted-foreground">days</span>
        </div>
      </div>
    </div>
  );
};

export default TatConfirmation;
