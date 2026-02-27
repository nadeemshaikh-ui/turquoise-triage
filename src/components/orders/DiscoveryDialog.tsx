import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle } from "lucide-react";

interface DiscoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { description: string; extraPrice: number }) => Promise<void>;
}

const DiscoveryDialog = ({ open, onOpenChange, onSubmit }: DiscoveryDialogProps) => {
  const [description, setDescription] = useState("");
  const [extraPrice, setExtraPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setSaving(true);
    try {
      await onSubmit({ description: description.trim(), extraPrice: Number(extraPrice) || 0 });
      setDescription("");
      setExtraPrice("");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Add Workshop Discovery
          </DialogTitle>
          <DialogDescription>
            Document extra damage found during workshop. This will pause the SLA timer and notify the customer for approval.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the additional damage or issue found..."
              className="min-h-[80px]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Extra Cost (₹)</label>
            <Input
              type="number"
              value={extraPrice}
              onChange={(e) => setExtraPrice(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !description.trim()} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Add Discovery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DiscoveryDialog;
