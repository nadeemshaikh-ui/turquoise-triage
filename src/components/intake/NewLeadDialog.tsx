import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
};

const normalizePhone = (raw: string): string | null => {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.length === 10 ? digits : null;
};

const NewLeadDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setPhone("");
      setNameError("");
      setPhoneError("");
    }
  }, [open]);

  const handleCreate = async () => {
    setSubmitting(true);
    setNameError("");
    setPhoneError("");

    // Validate
    let valid = true;
    if (!name.trim()) { setNameError("Name is required"); valid = false; }
    const normalized = normalizePhone(phone);
    if (!normalized) { setPhoneError("Enter a valid 10-digit phone number"); valid = false; }
    if (!valid) { setSubmitting(false); return; }

    if (!user) {
      toast.error("Not logged in");
      setSubmitting(false);
      return;
    }

    try {
      // Upsert customer by phone
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", normalized!)
        .limit(1);

      let customerId: string;
      if (existing && existing.length > 0) {
        customerId = existing[0].id;
        await supabase.from("customers").update({ name: name.trim() }).eq("id", customerId);
      } else {
        const { data: newCust, error: custErr } = await supabase
          .from("customers")
          .insert({ name: name.trim(), phone: normalized! })
          .select("id")
          .single();
        if (custErr) throw custErr;
        customerId = newCust.id;
      }

      // Create lead
      const { data: lead, error: leadErr } = await supabase
        .from("leads")
        .insert({
          customer_id: customerId,
          quoted_price: 0,
          status: "New",
          created_by: user.id,
        })
        .select("id")
        .single();
      if (leadErr) throw leadErr;

      onOpenChange(false);
      onCreated?.();
      navigate(`/leads/${lead.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create lead");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">New Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Name *</Label>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(""); }}
              placeholder="Customer name"
              className="h-10 text-sm"
            />
            {nameError && <p className="text-[11px] text-destructive">{nameError}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Phone *</Label>
            <Input
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }}
              placeholder="10-digit mobile number"
              type="tel"
              inputMode="numeric"
              className="h-10 text-sm"
            />
            {phoneError && <p className="text-[11px] text-destructive">{phoneError}</p>}
          </div>
          <Button
            onClick={handleCreate}
            disabled={submitting}
            className="w-full gap-1.5 min-h-[48px]"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Lead
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewLeadDialog;
