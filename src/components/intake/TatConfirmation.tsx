import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Crown, Clock, IndianRupee, Zap, Truck, Award } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  tier: "Premium" | "Elite";
  onTierChange: (tier: "Premium" | "Elite") => void;
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
  tier,
  onTierChange,
}: Props) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">Confirm & Submit</h2>
        <p className="text-sm text-muted-foreground">Review pricing and turnaround time</p>
      </div>

      {/* Tier selector */}
      <div className="space-y-2">
        <Label>Service Tier</Label>
        <ToggleGroup
          type="single"
          value={tier}
          onValueChange={(v) => { if (v) onTierChange(v as "Premium" | "Elite"); }}
          className="justify-start"
        >
          <ToggleGroupItem value="Premium" className="gap-1.5 px-4">
            <Crown className="h-3.5 w-3.5" />
            Premium
          </ToggleGroupItem>
          <ToggleGroupItem value="Elite" className="gap-1.5 px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <Zap className="h-3.5 w-3.5" />
            Elite
          </ToggleGroupItem>
        </ToggleGroup>

        {tier === "Elite" && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-1.5">
            <Badge className="gap-1 bg-primary text-primary-foreground">
              <Zap className="h-3 w-3" />
              ELITE
            </Badge>
            <ul className="text-xs text-muted-foreground space-y-1 ml-1">
              <li className="flex items-center gap-1.5"><IndianRupee className="h-3 w-3" /> 40% premium pricing applied</li>
              <li className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> 8–12 day express delivery</li>
              <li className="flex items-center gap-1.5"><Truck className="h-3 w-3" /> Free Pan-India shipping</li>
              <li className="flex items-center gap-1.5"><Award className="h-3 w-3" /> Artisan certification included</li>
            </ul>
          </div>
        )}
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
