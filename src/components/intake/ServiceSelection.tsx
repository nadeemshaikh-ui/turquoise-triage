import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Sparkles, Wrench, Paintbrush, ShoppingBag } from "lucide-react";

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

const categoryIcons: Record<string, React.ReactNode> = {
  Cleaning: <Sparkles className="h-4 w-4" />,
  "Repair & Structural": <Wrench className="h-4 w-4" />,
  "Restoration & Color": <Paintbrush className="h-4 w-4" />,
  "Luxury Bags": <ShoppingBag className="h-4 w-4" />,
};

const ServiceSelection = ({ services, selectedServiceId, onSelect }: Props) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = [...new Set(services.map((s) => s.category))];
  const filtered = activeCategory
    ? services.filter((s) => s.category === activeCategory)
    : services;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">Select Service</h2>
        <p className="text-sm text-muted-foreground">Choose a category, then pick the service</p>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={activeCategory === null ? "default" : "outline"}
          className="cursor-pointer px-3 py-1.5 text-xs"
          onClick={() => setActiveCategory(null)}
        >
          All
        </Badge>
        {categories.map((cat) => (
          <Badge
            key={cat}
            variant={activeCategory === cat ? "default" : "outline"}
            className="cursor-pointer gap-1.5 px-3 py-1.5 text-xs"
            onClick={() => setActiveCategory(cat)}
          >
            {categoryIcons[cat]}
            {cat}
          </Badge>
        ))}
      </div>

      {/* Service cards */}
      <div className="grid gap-2 sm:grid-cols-2">
        {filtered.map((svc) => {
          const isSelected = selectedServiceId === svc.id;
          const priceLabel = svc.price_range_min && svc.price_range_max
            ? `₹${svc.price_range_min.toLocaleString()} – ₹${svc.price_range_max.toLocaleString()}`
            : svc.default_price
              ? `₹${svc.default_price.toLocaleString()}`
              : "Quoted after review";

          return (
            <button
              key={svc.id}
              type="button"
              onClick={() => onSelect(svc)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all",
                isSelected
                  ? "border-primary bg-secondary shadow-sm"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{svc.name}</span>
                {svc.requires_photos && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">📷</Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{svc.category}</span>
              <span className="text-sm font-medium text-primary">{priceLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ServiceSelection;
export type { Service };
