import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { usePhoneLookup } from "@/hooks/usePhoneLookup";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
};

const normalizePhone = (raw: string): string | null => {
  const digits = raw.replace(/\D/g, "");
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  return last10.length === 10 ? last10 : null;
};

const NewLeadDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { result: phoneResult, lookup, reset: resetLookup } = usePhoneLookup();

  useEffect(() => {
    if (!open) {
      setName("");
      setPhone("");
      setNameError("");
      setPhoneError("");
      resetLookup();
    }
  }, [open, resetLookup]);

  const handlePhoneBlur = () => {
    if (phone.trim()) {
      lookup(phone, name);
    }
  };

  const handleNameBlur = () => {
    // Re-check when name changes and phone is already entered
    const norm = normalizePhone(phone);
    if (norm) {
      lookup(phone, name);
    }
  };

  const isConflict = phoneResult.status === "conflict";
  const isMatch = phoneResult.status === "match";

  const handleCreate = async () => {
    if (submitting) return;
    setSubmitting(true);
    setNameError("");
    setPhoneError("");

    let valid = true;
    if (!name.trim()) { setNameError("Name is required"); valid = false; }
    const normalized = normalizePhone(phone);
    if (!normalized) { setPhoneError("Enter a valid 10-digit phone number"); valid = false; }
    if (isConflict) {
      toast.error(`Blocked: This number belongs to "${phoneResult.dbName}". Verify the name or number.`, { duration: 6000 });
      valid = false;
    }
    if (!valid) { setSubmitting(false); return; }

    if (!user) {
      toast.error("Not logged in");
      setSubmitting(false);
      return;
    }

    try {
      let customerId: string;

      if (isMatch && phoneResult.customerId) {
        // Use existing customer, update name
        customerId = phoneResult.customerId;
        await supabase.from("customers").update({ name: name.trim() }).eq("id", customerId);
      } else {
        // Upsert by phone
        const { data: existing } = await supabase
          .from("customers")
          .select("id")
          .eq("phone", normalized!)
          .limit(1);

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
      }

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
      toast.error(err.message || "Failed to create lead", { duration: 5000 });
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
              onBlur={handleNameBlur}
              placeholder="Customer name"
              className="h-10 text-sm"
            />
            {nameError && <p className="text-[11px] text-destructive">{nameError}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Phone *</Label>
            <Input
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneError(""); resetLookup(); }}
              onBlur={handlePhoneBlur}
              placeholder="10-digit mobile number"
              type="tel"
              inputMode="numeric"
              className="h-10 text-sm"
            />
            {phoneError && <p className="text-[11px] text-destructive">{phoneError}</p>}

            {/* Phone lookup feedback */}
            {phoneResult.status === "checking" && (
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Checking…
              </p>
            )}
            {isMatch && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 dark:border-emerald-800 dark:bg-emerald-950/30">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Returning Customer: {phoneResult.dbName} Found.
                </p>
                <p className="mt-0.5 text-[10px] text-emerald-600 dark:text-emerald-500">
                  {phoneResult.leadCount} existing {phoneResult.leadCount === 1 ? "order" : "orders"}
                </p>
              </div>
            )}
            {isConflict && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 dark:border-red-800 dark:bg-red-950/30">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Conflict: This number belongs to "{phoneResult.dbName}".
                </p>
                <p className="mt-0.5 text-[10px] text-red-600 dark:text-red-500">
                  Please check the name or verify the number. ({phoneResult.leadCount} existing {phoneResult.leadCount === 1 ? "order" : "orders"})
                </p>
              </div>
            )}
          </div>
          <Button
            onClick={handleCreate}
            disabled={submitting || isConflict}
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
