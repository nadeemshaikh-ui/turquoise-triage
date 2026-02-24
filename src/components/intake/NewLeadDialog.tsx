import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import ServiceSelection, { type Service } from "./ServiceSelection";
import CustomerDetails, { type CustomerData } from "./CustomerDetails";
import PhotoUpload from "./PhotoUpload";
import IssueTagger, { generateConditionNote } from "./IssueTagger";
import DualPriceSlider from "./DualPriceSlider";
import QuotePreview from "./QuotePreview";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
};

const NewLeadDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Service
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // Issues + Photos
  const [issueTags, setIssueTags] = useState<string[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState("");

  // Pricing + Customer
  const [basePrice, setBasePrice] = useState(1000);
  const [priceError, setPriceError] = useState("");
  const [tier, setTier] = useState<"Premium" | "Elite">("Elite");
  const [customer, setCustomer] = useState<CustomerData>({ name: "", phone: "", email: "", notes: "" });
  const [customerErrors, setCustomerErrors] = useState<Partial<Record<keyof CustomerData, string>>>({});

  // Load services
  useEffect(() => {
    if (!open) return;
    supabase
      .from("services")
      .select("*")
      .eq("is_active", true)
      .order("category")
      .order("name")
      .then(({ data }) => {
        if (data) setServices(data as unknown as Service[]);
      });
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelectedService(null);
      setIssueTags([]);
      setPhotos([]);
      setPhotoError("");
      setBasePrice(1000);
      setPriceError("");
      setTier("Elite");
      setCustomer({ name: "", phone: "", email: "", notes: "" });
      setCustomerErrors({});
      setShowPreview(false);
    }
  }, [open]);

  // Pre-fill price when service changes
  useEffect(() => {
    if (selectedService?.default_price) {
      setBasePrice(selectedService.default_price);
    }
  }, [selectedService]);

  const isGoldTier = selectedService?.category === "Luxury Bags" || basePrice > 6000;
  const elitePrice = Math.round(basePrice * 1.4);
  const premiumPrice = basePrice + 200;

  const validate = (): boolean => {
    let valid = true;

    if (!selectedService) {
      toast({ title: "Select a service", variant: "destructive" });
      return false;
    }

    if (selectedService.requires_photos && photos.length < 3) {
      setPhotoError("Upload at least 3 photos");
      valid = false;
    } else {
      setPhotoError("");
    }

    const errors: Partial<Record<keyof CustomerData, string>> = {};
    if (!customer.name.trim()) errors.name = "Required";
    if (!customer.phone.trim()) errors.phone = "Required";
    else if (!/^\d{10}$/.test(customer.phone.trim())) errors.phone = "10 digits";
    if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))
      errors.email = "Invalid email";
    setCustomerErrors(errors);
    if (Object.keys(errors).length > 0) valid = false;

    if (!basePrice || basePrice < 1000) {
      setPriceError("Min ₹1,000");
      valid = false;
    } else {
      setPriceError("");
    }

    return valid;
  };

  const handleGenerateQuote = () => {
    if (validate()) setShowPreview(true);
  };

  const handleSubmit = async (sendWhatsApp = false) => {
    if (!selectedService) return;
    setSubmitting(true);

    try {
      // 1. Upsert customer
      const { data: existingCustomers } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", customer.phone.trim())
        .limit(1);

      let customerId: string;

      if (existingCustomers && existingCustomers.length > 0) {
        customerId = existingCustomers[0].id;
        await supabase
          .from("customers")
          .update({ name: customer.name.trim(), email: customer.email || null })
          .eq("id", customerId);
      } else {
        const { data: newCust, error: custErr } = await supabase
          .from("customers")
          .insert({ name: customer.name.trim(), phone: customer.phone.trim(), email: customer.email || null })
          .select("id")
          .single();
        if (custErr) throw custErr;
        customerId = newCust.id;
      }

      const conditionNote = generateConditionNote(issueTags);
      const finalPrice = tier === "Elite" ? elitePrice : premiumPrice;
      const tatMin = tier === "Elite" ? 8 : 15;
      const tatMax = tier === "Elite" ? 12 : 20;

      // 2. Create lead
      const { data: lead, error: leadErr } = await supabase
        .from("leads")
        .insert({
          customer_id: customerId,
          service_id: selectedService.id,
          quoted_price: finalPrice,
          tat_days_min: tatMin,
          tat_days_max: tatMax,
          is_gold_tier: isGoldTier,
          notes: customer.notes || null,
          status: "New",
          tier,
          issue_tags: issueTags as any,
          condition_note: conditionNote || null,
        })
        .select("id")
        .single();
      if (leadErr) throw leadErr;

      // 3. Upload photos
      for (const file of photos) {
        const path = `${lead.id}/${Date.now()}_${file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("lead-photos")
          .upload(path, file);
        if (uploadErr) throw uploadErr;

        await supabase.from("lead_photos").insert({
          lead_id: lead.id,
          storage_path: path,
          file_name: file.name,
        });
      }

      // 4. Create quote record
      const quoteToken = crypto.randomUUID().slice(0, 8);
      await supabase.from("lead_quotes").insert({
        lead_id: lead.id,
        quote_token: quoteToken,
        premium_price: premiumPrice,
        elite_price: elitePrice,
        premium_tat_min: 15,
        premium_tat_max: 20,
        elite_tat_min: 8,
        elite_tat_max: 12,
      });

      const quoteUrl = `${window.location.origin}/quote/${quoteToken}`;

      // 5. Send WhatsApp or copy link
      if (sendWhatsApp) {
        try {
          await supabase.functions.invoke("send-whatsapp", {
            body: {
              lead_id: lead.id,
              customer_phone: customer.phone.trim(),
              customer_name: customer.name.trim(),
              service_name: selectedService.name,
              template_type: "digital_quote",
              quote_url: quoteUrl,
            },
          });
          toast({ title: "Quote sent via WhatsApp!", description: quoteUrl });
        } catch {
          await navigator.clipboard.writeText(quoteUrl);
          toast({ title: "WhatsApp unavailable — link copied!", description: quoteUrl });
        }
      } else {
        toast({ title: "Lead created!", description: `${customer.name} — ${selectedService.name}` });
      }

      onOpenChange(false);
      onCreated?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const conditionNote = generateConditionNote(issueTags);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground text-sm">New Lead — Tap to Triage</DialogTitle>
        </DialogHeader>

        {showPreview ? (
          <QuotePreview
            serviceName={selectedService?.name ?? ""}
            conditionNote={conditionNote}
            elitePrice={elitePrice}
            premiumPrice={premiumPrice}
            customerName={customer.name}
            customerPhone={customer.phone}
            selectedTier={tier}
            photos={photos}
            submitting={submitting}
            onConfirmCreate={() => handleSubmit(false)}
            onConfirmWhatsApp={() => handleSubmit(true)}
            onBack={() => setShowPreview(false)}
          />
        ) : (
          <div className="space-y-4">
            {/* Section 1: Category + Service */}
            <ServiceSelection
              services={services}
              selectedServiceId={selectedService?.id ?? null}
              onSelect={setSelectedService}
            />

            {/* Section 2: Issue Tags + Photos */}
            {selectedService && (
              <>
                <IssueTagger selectedTags={issueTags} onTagsChange={setIssueTags} />

                {conditionNote && (
                  <div className="rounded-lg border border-border bg-muted/30 p-2">
                    <p className="text-[10px] font-semibold text-muted-foreground">Condition Report</p>
                    <p className="text-xs text-foreground">{conditionNote}</p>
                  </div>
                )}

                <PhotoUpload
                  files={photos}
                  onFilesChange={setPhotos}
                  required={selectedService.requires_photos}
                  error={photoError}
                />
              </>
            )}

            {/* Section 3: Pricing + Customer */}
            {selectedService && (
              <>
                <DualPriceSlider
                  basePrice={basePrice}
                  onBasePriceChange={setBasePrice}
                  selectedTier={tier}
                  onTierChange={setTier}
                  error={priceError}
                />

                <CustomerDetails data={customer} onChange={setCustomer} errors={customerErrors} />

                {/* Sticky CTA */}
                <div className="flex gap-2 pt-2 sticky bottom-0 bg-background pb-1">
                  <Button
                    variant="outline"
                    onClick={() => { if (validate()) handleSubmit(false); }}
                    disabled={submitting}
                    className="flex-1 min-h-[52px] text-base"
                  >
                    {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                    Create Lead
                  </Button>
                  <Button
                    onClick={handleGenerateQuote}
                    disabled={submitting}
                    className="flex-1 min-h-[52px] text-base"
                  >
                    {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-1.5 h-4 w-4" />}
                    Generate Quote
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NewLeadDialog;
