import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DiscoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  onSubmit: (data: { description: string; extraPrice: number; discoveryPhotoUrl?: string }) => Promise<void>;
}

const DiscoveryDialog = ({ open, onOpenChange, orderId, onSubmit }: DiscoveryDialogProps) => {
  const [description, setDescription] = useState("");
  const [extraPrice, setExtraPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim() || !photoFile) return;
    setSaving(true);
    try {
      // Upload photo first
      setUploading(true);
      const path = `discoveries/${orderId}/${Date.now()}-${photoFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("order-photos")
        .upload(path, photoFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("order-photos").getPublicUrl(path);
      setUploading(false);

      await onSubmit({
        description: description.trim(),
        extraPrice: Number(extraPrice) || 0,
        discoveryPhotoUrl: urlData.publicUrl,
      });
      setDescription("");
      setExtraPrice("");
      setPhotoFile(null);
      onOpenChange(false);
    } finally {
      setSaving(false);
      setUploading(false);
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
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Discovery Photo (required)</label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer rounded-[var(--radius)] border border-dashed border-border px-4 py-3 text-xs text-muted-foreground hover:border-primary/50 transition-colors flex-1">
                <Camera className="h-4 w-4" />
                {photoFile ? photoFile.name : "Tap to attach proof photo"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !description.trim() || !photoFile} className="gap-2">
            {(saving || uploading) && <Loader2 className="h-4 w-4 animate-spin" />}
            Add Discovery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DiscoveryDialog;
