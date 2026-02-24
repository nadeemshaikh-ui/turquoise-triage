import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ShoppingBag, Footprints, Shirt, Sparkles, Wrench, Palette } from "lucide-react";

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

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "Luxury Bags": ShoppingBag,
  "Cleaning": Footprints,
  "Repair & Structural": Wrench,
  "Restoration & Color": Palette,
};

const ServiceSelection = ({ services, selectedServiceId, onSelect }: Props) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(services.map((s) => s.category)));
    return unique.map((key) => ({
      key,
      label: key,
      icon: ICON_MAP[key] || Sparkles,
    }));
  }, [services]);

  const filtered = activeCategory
    ? services.filter((s) => s.category === activeCategory)
    : services;

  return (
    <div className="space-y-2">
      {/* Dynamic category tiles */}
      <div className="grid grid-cols-4 gap-2">
        {categories.map(({ key, label, icon: Icon }) => {
          const isActive = activeCategory === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveCategory(isActive ? null : key)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-2 min-h-[64px] transition-all",
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-card text-foreground hover:border-primary/50"
              )}
            >
              <Icon className="h-8 w-8" />
              <span className="text-[10px] font-semibold leading-tight text-center">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Service chips */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filtered.map((svc) => {
            const isSelected = selectedServiceId === svc.id;
            return (
              <button
                key={svc.id}
                type="button"
                onClick={() => onSelect(svc)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-all min-h-[36px]",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-foreground hover:border-primary/50"
                )}
              >
                {svc.name}
                {svc.default_price ? ` · ₹${svc.default_price.toLocaleString()}` : ""}
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
