import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "@/hooks/use-toast";

interface AdminOverrideProps {
  orderId: string;
  fieldName: string;
  fieldLabel: string;
  currentValue: string;
  onOverride: () => void;
}

const AdminOverride = ({ orderId, fieldName, fieldLabel, currentValue, onOverride }: AdminOverrideProps) => {
  const { isAdmin } = useUserRole();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [newValue, setNewValue] = useState(currentValue);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isAdmin) return null;

  const handleSubmit = async () => {
    if (reason.trim().length < 10) {
      toast({ title: "Reason must be at least 10 characters", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Update the order field
      const { error: updateError } = await supabase
        .from("orders")
        .update({ [fieldName]: fieldName.includes("price") || fieldName.includes("fee") ? Number(newValue) : newValue })
        .eq("id", orderId);
      if (updateError) throw updateError;

      // Insert audit log
      const { error: auditError } = await supabase.from("audit_logs").insert({
        order_id: orderId,
        admin_id: user!.id,
        action: "override",
        field_name: fieldLabel,
        old_value: currentValue,
        new_value: newValue,
        reason: reason.trim(),
      });
      if (auditError) throw auditError;

      toast({ title: `${fieldLabel} overridden` });
      setOpen(false);
      setReason("");
      onOverride();
    } catch {
      toast({ title: "Override failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-destructive hover:text-destructive">
          <ShieldAlert className="h-3 w-3" />
          Override
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Override {fieldLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Current Value</label>
            <p className="text-sm text-foreground font-medium">{currentValue}</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">New Value</label>
            <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Reason (min 10 chars) *</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this override necessary?"
              className="min-h-[80px]"
            />
            <p className="text-[10px] text-muted-foreground">{reason.length}/10 minimum</p>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={saving || reason.trim().length < 10}
            className="w-full gap-2"
            variant="destructive"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
            Confirm Override
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminOverride;
