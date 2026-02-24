import { useState } from "react";
import { cn } from "@/lib/utils";
import { ShoppingBag, Footprints, Shirt, Sparkles } from "lucide-react";

type Service = {
  id: string;
  name: string;
  category: string;
  default_price: number | null;
  price_range_min: number | null;
  price_range_max: number | null;
  default_tat_min: number;
  default_tat_max: number;
  requires_photos: boolean;
};

type Props = {
  services: Service[];
  selectedServiceId: string | null;
  onSelect: (service: Service) => void;
};

const CATEGORIES = [
  { key: "Luxury Bags", label: "Bag", icon: ShoppingBag },
  { key: "Cleaning", label: "Shoe", icon: Footprints },
  { key: "Repair & Structural", label: "Jacket", icon: Shirt },
  { key: "Restoration & Color", label: "Other", icon: Sparkles },
] as const;

const ServiceSelection = ({ services, selectedServiceId, onSelect }: Props) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = activeCategory
    ? services.filter((s) => s.category === activeCategory)
    : services;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">Select Category & Service</h2>
        <p className="text-sm text-muted-foreground">Tap a category, then pick the service</p>
      </div>

      {/* Large category tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CATEGORIES.map(({ key, label, icon: Icon }) => {
          const isActive = activeCategory === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveCategory(isActive ? null : key)}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 min-h-[96px] transition-all",
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <Icon className="h-10 w-10" />
              <span className="text-sm font-semibold">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Filtered service cards */}
      {filtered.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((svc) => {
            const isSelected = selectedServiceId === svc.id;
            const priceLabel = svc.default_price
              ? `₹${svc.default_price.toLocaleString()}`
              : "Quoted after review";

            return (
              <button
                key={svc.id}
                type="button"
                onClick={() => onSelect(svc)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border min-h-[48px] p-3 text-left transition-all",
                  isSelected
                    ? "border-primary bg-secondary shadow-sm"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <span className="text-sm font-semibold text-foreground">{svc.name}</span>
                <span className="text-xs text-muted-foreground">{svc.category}</span>
                <span className="text-sm font-medium text-primary">{priceLabel}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ServiceSelection;
export type { Service };
