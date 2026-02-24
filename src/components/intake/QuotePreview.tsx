import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Copy, Zap, Crown, Truck, Shield, Gem, Sparkles } from "lucide-react";

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
  onCopyInterakt: () => void;
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
  onCopyInterakt,
  onBack,
}: Props) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Luxury Quote Preview</h3>
          <p className="text-[10px] text-muted-foreground">Verify before sending to customer</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Edit
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Prepared for <span className="font-semibold text-foreground">{customerName}</span> ({customerPhone})
      </p>

      {/* Luxury preview card */}
      <Card className="p-4 space-y-4 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
        {/* Service & Condition */}
        <div>
          <p className="text-sm font-bold text-foreground">{serviceName}</p>
          {conditionNote && (
            <p className="text-xs text-muted-foreground mt-1 italic">{conditionNote}</p>
          )}
        </div>

        {/* Photos */}
        {photos.length > 0 && (
          <div className="flex gap-2">
            {photos.slice(0, 4).map((f, i) => (
              <div key={i} className="h-14 w-14 rounded-lg border border-border overflow-hidden">
                <img
                  src={URL.createObjectURL(f)}
                  alt={`Photo ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
            {photos.length > 4 && (
              <div className="h-14 w-14 rounded-lg border border-border flex items-center justify-center text-[10px] text-muted-foreground">
                +{photos.length - 4}
              </div>
            )}
          </div>
        )}

        {/* Luxury tier comparison table */}
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-2 text-muted-foreground font-medium">Feature</th>
                <th className="p-2 text-center">
                  <span className="flex items-center justify-center gap-1 font-bold text-primary">
                    <Zap className="h-3 w-3" /> Elite Artisan
                  </span>
                </th>
                <th className="p-2 text-center">
                  <span className="flex items-center justify-center gap-1 font-medium text-muted-foreground">
                    <Crown className="h-3 w-3" /> Premium
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="p-2 text-muted-foreground">Delivery</td>
                <td className="p-2 text-center font-medium text-foreground">8–12 Day Express</td>
                <td className="p-2 text-center text-muted-foreground">15–20 Day Standard</td>
              </tr>
              <tr>
                <td className="p-2 text-muted-foreground">Quality Check</td>
                <td className="p-2 text-center font-medium text-foreground">
                  <span className="flex items-center justify-center gap-1"><Shield className="h-3 w-3 text-primary" /> Master Artisan</span>
                </td>
                <td className="p-2 text-center text-muted-foreground">Professional Grade</td>
              </tr>
              <tr>
                <td className="p-2 text-muted-foreground">Materials</td>
                <td className="p-2 text-center font-medium text-foreground">
                  <span className="flex items-center justify-center gap-1"><Gem className="h-3 w-3 text-primary" /> Italian Pigments</span>
                </td>
                <td className="p-2 text-center text-muted-foreground">Standard Materials</td>
              </tr>
              <tr>
                <td className="p-2 text-muted-foreground">Protection</td>
                <td className="p-2 text-center font-medium text-foreground">
                  <span className="flex items-center justify-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> Nano-Ceramic Shield</span>
                </td>
                <td className="p-2 text-center text-muted-foreground">Standard Finish</td>
              </tr>
              <tr>
                <td className="p-2 text-muted-foreground">Shipping</td>
                <td className="p-2 text-center font-medium text-primary">
                  <span className="flex items-center justify-center gap-1"><Truck className="h-3 w-3" /> FREE Pan-India</span>
                </td>
                <td className="p-2 text-center text-muted-foreground">+₹200</td>
              </tr>
              <tr className="bg-muted/30">
                <td className="p-2 font-semibold text-foreground">Price</td>
                <td className="p-2 text-center">
                  <span className="text-lg font-black text-primary">₹{elitePrice.toLocaleString()}</span>
                  {selectedTier === "Elite" && <Badge className="ml-1 text-[8px] h-4 bg-primary text-primary-foreground">SELECTED</Badge>}
                </td>
                <td className="p-2 text-center">
                  <span className="text-sm font-bold text-foreground">₹{premiumPrice.toLocaleString()}</span>
                  {selectedTier === "Premium" && <Badge className="ml-1 text-[8px] h-4 bg-primary text-primary-foreground">SELECTED</Badge>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Confirm buttons */}
      <div className="flex flex-col gap-2">
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
            <Copy className="mr-1.5 h-4 w-4" />
            Generate Quote
          </Button>
        </div>
        <Button
          variant="secondary"
          onClick={onCopyInterakt}
          className="w-full min-h-[48px] text-sm"
        >
          <Copy className="mr-1.5 h-4 w-4" />
          Copy for Interakt
        </Button>
      </div>
    </div>
  );
};

export default QuotePreview;
