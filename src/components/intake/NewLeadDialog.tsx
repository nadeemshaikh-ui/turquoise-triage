import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, MessageSquare, Check, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import ServiceSelection, { type Service } from "./ServiceSelection";
import CustomerDetails, { type CustomerData } from "./CustomerDetails";
import PhotoUpload from "./PhotoUpload";
import IssueTagger, { generateConditionNote } from "./IssueTagger";
import DualPriceSlider from "./DualPriceSlider";
import QuotePreview from "./QuotePreview";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
};

const NewLeadDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
  const [customer, setCustomer] = useState<CustomerData>({ name: "", phone: "", email: "", notes: "", campaign: "" });
  const [customerErrors, setCustomerErrors] = useState<Partial<Record<keyof CustomerData, string>>>({});

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

  useEffect(() => {
    if (!open) {
      setSelectedService(null);
      setIssueTags([]);
      setPhotos([]);
      setPhotoError("");
      setBasePrice(1000);
      setPriceError("");
      setTier("Elite");
      setCustomer({ name: "", phone: "", email: "", notes: "", campaign: "" });
      setCustomerErrors({});
      setShowPreview(false);
      setAdvancedOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (selectedService?.default_price) {
      setBasePrice(selectedService.default_price);
    }
  }, [selectedService]);

  const isGoldTier = selectedService?.category === "Luxury Bags" || basePrice > 6000;
  const elitePrice = Math.round(basePrice * 1.4);
  const premiumPrice = basePrice + 200;

  const validate = (): boolean => {
    const errors: Partial<Record<keyof CustomerData, string>> = {};
    if (!customer.name.trim()) errors.name = "Required";
    if (!customer.phone.trim()) errors.phone = "Required";
    else if (!/^\d{10}$/.test(customer.phone.trim())) errors.phone = "10 digits";
    if (!customer.campaign) errors.campaign = "Required";
    if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))
      errors.email = "Invalid email";
    setCustomerErrors(errors);
    if (Object.keys(errors).length > 0) return false;

    if (!selectedService) {
      toast({ title: "Select a service", variant: "destructive" });
      return false;
    }

    if (selectedService.requires_photos && photos.length < 3) {
      setPhotoError("Upload at least 3 photos");
      return false;
    }
    setPhotoError("");

    if (!basePrice || basePrice < 1000) {
      setPriceError("Min ₹1,000");
      return false;
    }
    setPriceError("");
    return true;
  };

  const handleGenerateQuote = () => {
    if (validate()) setShowPreview(true);
  };

  const handleSubmit = async (mode: "create" | "whatsapp" | "interakt" = "create") => {
    if (!selectedService) return;
    setSubmitting(true);

    try {
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
          meta_campaign_name: customer.campaign || null,
        })
        .select("id")
        .single();
      if (leadErr) throw leadErr;

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

      if (mode === "whatsapp") {
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
      } else if (mode === "interakt") {
        const message = `Hi ${customer.name.trim()}! Here is your bespoke restoration quote from Restoree: ${quoteUrl}`;
        await navigator.clipboard.writeText(message);
        toast({ title: "Copied for Interakt!", description: "Paste this message in your Interakt chat." });
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
          <DialogTitle className="text-foreground text-sm">Tap-to-Triage</DialogTitle>
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
            onConfirmCreate={() => handleSubmit("create")}
            onConfirmWhatsApp={() => handleSubmit("whatsapp")}
            onCopyInterakt={() => handleSubmit("interakt")}
            onBack={() => setShowPreview(false)}
          />
        ) : (
          <div className="space-y-4">
            {/* Customer + Campaign */}
            <Card className="p-4 border-primary/20">
              <CustomerDetails data={customer} onChange={setCustomer} errors={customerErrors} />
            </Card>

            {/* Service Selection */}
            <Card className="p-4 border-primary/20">
              <ServiceSelection
                services={services}
                selectedServiceId={selectedService?.id ?? null}
                onSelect={setSelectedService}
              />
            </Card>

            {/* Pricing + Tier */}
            <Card className="p-4 border-primary/20">
              <DualPriceSlider
                basePrice={basePrice}
                onBasePriceChange={setBasePrice}
                selectedTier={tier}
                onTierChange={setTier}
                error={priceError}
              />
            </Card>

            {/* Advanced: Issues + Photos (collapsed by default) */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground">
                  Advanced (Issues & Photos)
                  {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card className="p-4 border-primary/20 space-y-4 mt-2">
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
                    required={selectedService?.requires_photos ?? false}
                    error={photoError}
                  />
                </Card>
              </CollapsibleContent>
            </Collapsible>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => { if (validate()) handleSubmit("create"); }}
                disabled={submitting}
                className="min-h-[48px] text-base"
              >
                {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                Create
              </Button>
              <Button
                onClick={handleGenerateQuote}
                disabled={submitting}
                className="min-h-[48px] text-base"
              >
                {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-1.5 h-4 w-4" />}
                Generate Quote
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NewLeadDialog;
