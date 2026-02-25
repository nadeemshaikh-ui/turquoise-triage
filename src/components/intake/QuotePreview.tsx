import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Check, Copy, Zap, Crown, Truck } from "lucide-react";
import type { QuoteItem } from "./NewLeadDialog";

const TIER_BADGE: Record<string, string> = {
  standard: "bg-muted text-muted-foreground",
  luxury: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  ultra_luxury: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};
const TIER_LABEL: Record<string, string> = { standard: "Standard", luxury: "Luxury", ultra_luxury: "Ultra-Luxury" };

type Props = {
  items: QuoteItem[];
  onItemsChange: (items: QuoteItem[]) => void;
  eliteTotal: number;
  premiumTotal: number;
  customerName: string;
  customerPhone: string;
  submitting: boolean;
  onConfirmCreate: () => void;
  onConfirmWhatsApp: () => void;
  onCopyInterakt: () => void;
  onBack: () => void;
};

const QuotePreview = ({
  items, onItemsChange, eliteTotal, premiumTotal,
  customerName, customerPhone,
  submitting, onConfirmCreate, onConfirmWhatsApp, onCopyInterakt, onBack,
}: Props) => {
  const updateItem = (index: number, updates: Partial<QuoteItem>) => {
    onItemsChange(items.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Quote Preview</h3>
          <p className="text-[10px] text-muted-foreground">Review & edit before sending</p>
        </div>
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Edit
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        For <span className="font-semibold text-foreground">{customerName}</span> ({customerPhone})
      </p>

      {/* Items list — editable */}
      <div className="space-y-2">
        {items.map((item, idx) => (
          <Card key={idx} className="p-3 space-y-2 border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary">{item.categoryName}</span>
                {item.brandName && (
                  <>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-xs font-medium text-foreground">{item.brandName}</span>
                    <Badge className={`text-[9px] ${TIER_BADGE[item.brandTier] || ""}`}>{TIER_LABEL[item.brandTier]}</Badge>
                  </>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">{item.mode === "package" ? "Package" : "Alacarte"}</span>
            </div>
            {/* Per-item photo thumbnails */}
            {item.photos.length > 0 && (
              <div className="flex gap-1.5">
                {item.photos.slice(0, 3).map((f, i) => (
                  <div key={i} className="h-10 w-10 rounded border border-border overflow-hidden">
                    <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
                {item.photos.length > 3 && (
                  <div className="h-10 w-10 rounded border border-border flex items-center justify-center text-[10px] text-muted-foreground">+{item.photos.length - 3}</div>
                )}
              </div>
            )}
            <Textarea
              value={item.description}
              onChange={(e) => updateItem(idx, { description: e.target.value })}
              className="min-h-[40px] text-xs"
              placeholder="Item description…"
            />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">₹</span>
              <Input
                type="number"
                value={item.manualPrice || ""}
                onChange={(e) => updateItem(idx, { manualPrice: Number(e.target.value) })}
                className="h-7 text-sm w-28"
              />
              {item.suggestivePrice > 0 && item.suggestivePrice !== item.manualPrice && (
                <span className="text-[10px] text-muted-foreground line-through">₹{item.suggestivePrice}</span>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Totals comparison */}
      <Card className="p-3 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><Crown className="h-3 w-3" /> Premium</span>
          <span className="text-sm font-semibold text-foreground">₹{premiumTotal.toLocaleString()}</span>
        </div>
        <div className="text-[10px] text-muted-foreground">15–20 day standard + ₹200 shipping</div>
        <div className="border-t border-border pt-2 flex items-center justify-between">
          <span className="flex items-center gap-1 text-xs font-bold text-primary"><Zap className="h-3 w-3" /> Elite Artisan</span>
          <span className="text-lg font-black text-primary">₹{eliteTotal.toLocaleString()}</span>
        </div>
        <div className="text-[10px] text-primary/70 flex items-center gap-1"><Truck className="h-3 w-3" /> 8–12 day express, FREE shipping</div>
      </Card>

      {/* Confirm buttons */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button variant="outline" onClick={onConfirmCreate} disabled={submitting} className="flex-1 min-h-[52px] text-base">
            <Check className="mr-1.5 h-4 w-4" /> Create Lead
          </Button>
          <Button onClick={onConfirmWhatsApp} disabled={submitting} className="flex-1 min-h-[52px] text-base">
            <Copy className="mr-1.5 h-4 w-4" /> Generate Quote
          </Button>
        </div>
        <Button variant="secondary" onClick={onCopyInterakt} className="w-full min-h-[48px] text-sm">
          <Copy className="mr-1.5 h-4 w-4" /> Copy for Interakt
        </Button>
      </div>
    </div>
  );
};

export default QuotePreview;
