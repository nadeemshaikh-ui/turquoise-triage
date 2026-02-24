import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, MessageSquare, Zap, Crown, Truck } from "lucide-react";

type Props = {
  serviceName: string;
  conditionNote: string;
  elitePrice: number;
  premiumPrice: number;
  customerName: string;
  customerPhone: string;
  selectedTier: "Premium" | "Elite";
  photos: File[];
  submitting: boolean;
  onConfirmCreate: () => void;
  onConfirmWhatsApp: () => void;
  onBack: () => void;
};

const QuotePreview = ({
  serviceName,
  conditionNote,
  elitePrice,
  premiumPrice,
  customerName,
  customerPhone,
  selectedTier,
  photos,
  submitting,
  onConfirmCreate,
  onConfirmWhatsApp,
  onBack,
}: Props) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Quote Preview</h3>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Edit
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        This is what <span className="font-semibold text-foreground">{customerName}</span> ({customerPhone}) will see:
      </p>

      {/* Mini quote preview */}
      <Card className="p-3 space-y-3 border-border bg-muted/20">
        <div>
          <p className="text-xs font-semibold text-foreground">{serviceName}</p>
          {conditionNote && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{conditionNote}</p>
          )}
        </div>

        {photos.length > 0 && (
          <div className="flex gap-1.5">
            {photos.slice(0, 3).map((f, i) => (
              <div key={i} className="h-12 w-12 rounded border border-border overflow-hidden">
                <img
                  src={URL.createObjectURL(f)}
                  alt={`Photo ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
            {photos.length > 3 && (
              <div className="h-12 w-12 rounded border border-border flex items-center justify-center text-[10px] text-muted-foreground">
                +{photos.length - 3}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Card className={`p-2 space-y-1 ${selectedTier === "Elite" ? "border-primary bg-primary/5" : "border-border opacity-60"}`}>
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-bold">Elite</span>
              {selectedTier === "Elite" && <Badge className="text-[8px] h-4 bg-primary text-primary-foreground">SELECTED</Badge>}
            </div>
            <p className="text-[10px] text-muted-foreground">8–12 Days · Free Ship</p>
            <p className="text-sm font-bold text-primary">₹{elitePrice.toLocaleString()}</p>
          </Card>
          <Card className={`p-2 space-y-1 ${selectedTier === "Premium" ? "border-primary bg-primary/5" : "border-border opacity-60"}`}>
            <div className="flex items-center gap-1">
              <Crown className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-bold">Premium</span>
              {selectedTier === "Premium" && <Badge className="text-[8px] h-4 bg-primary text-primary-foreground">SELECTED</Badge>}
            </div>
            <p className="text-[10px] text-muted-foreground">15–20 Days · +₹200</p>
            <p className="text-sm font-bold text-foreground">₹{premiumPrice.toLocaleString()}</p>
          </Card>
        </div>
      </Card>

      {/* Confirm buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={onConfirmCreate}
          disabled={submitting}
          className="flex-1 min-h-[52px] text-base"
        >
          <Check className="mr-1.5 h-4 w-4" />
          Create Lead
        </Button>
        <Button
          onClick={onConfirmWhatsApp}
          disabled={submitting}
          className="flex-1 min-h-[52px] text-base"
        >
          <MessageSquare className="mr-1.5 h-4 w-4" />
          WhatsApp Quote
        </Button>
      </div>
    </div>
  );
};

export default QuotePreview;
