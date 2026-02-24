import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Check, Loader2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import ServiceSelection, { type Service } from "./ServiceSelection";
import CustomerDetails, { type CustomerData } from "./CustomerDetails";
import PhotoUpload from "./PhotoUpload";
import IssueTagger, { generateConditionNote } from "./IssueTagger";
import DualPriceSlider from "./DualPriceSlider";
import RecentTriages from "./RecentTriages";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
};

const STEPS = ["Category & Service", "Issues & Photos", "Pricing & Confirm"];

const NewLeadDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — Service
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // Step 2 — Issue Tags + Photos
  const [issueTags, setIssueTags] = useState<string[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState("");

  // Step 3 — Pricing + Customer
  const [basePrice, setBasePrice] = useState(1000);
  const [priceError, setPriceError] = useState("");
  const [customer, setCustomer] = useState<CustomerData>({ name: "", phone: "", email: "", notes: "" });
  const [customerErrors, setCustomerErrors] = useState<Partial<Record<keyof CustomerData, string>>>({});
  const [tier] = useState<"Premium" | "Elite">("Elite"); // Default Elite

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
      setStep(0);
      setSelectedService(null);
      setIssueTags([]);
      setPhotos([]);
      setPhotoError("");
      setBasePrice(1000);
      setPriceError("");
      setCustomer({ name: "", phone: "", email: "", notes: "" });
      setCustomerErrors({});
    }
  }, [open]);

  // Pre-fill price when service changes
  useEffect(() => {
    if (selectedService?.default_price) {
      setBasePrice(selectedService.default_price);
    }
  }, [selectedService]);

  const isGoldTier =
    selectedService?.category === "Luxury Bags" || basePrice > 6000;

  const validateStep = (): boolean => {
    if (step === 0) return !!selectedService;

    if (step === 1) {
      if (selectedService?.requires_photos && photos.length < 3) {
        setPhotoError("Please upload at least 3 photos");
        return false;
      }
      setPhotoError("");
      return true;
    }

    if (step === 2) {
      const errors: Partial<Record<keyof CustomerData, string>> = {};
      if (!customer.name.trim()) errors.name = "Name is required";
      if (!customer.phone.trim()) errors.phone = "Phone is required";
      else if (!/^\d{10}$/.test(customer.phone.trim())) errors.phone = "Enter a valid 10-digit number";
      if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))
        errors.email = "Enter a valid email";
      setCustomerErrors(errors);
      if (Object.keys(errors).length > 0) return false;

      if (!basePrice || basePrice < 1000) {
        setPriceError("Enter a price ≥ ₹1,000");
        return false;
      }
      setPriceError("");
      return true;
    }

    return true;
  };

  const next = () => {
    if (validateStep()) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const elitePrice = Math.round(basePrice * 1.4);
  const premiumPrice = basePrice + 200;

  const handleSubmit = async (sendWhatsApp = false) => {
    if (!validateStep() || !selectedService) return;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">New Lead — Tap to Triage</DialogTitle>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            {STEPS.map((label, i) => (
              <span key={label} className={i <= step ? "font-semibold text-primary" : ""}>
                {label}
              </span>
            ))}
          </div>
          <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />
        </div>

        {/* Steps */}
        <div className="py-2">
          {step === 0 && (
            <ServiceSelection
              services={services}
              selectedServiceId={selectedService?.id ?? null}
              onSelect={setSelectedService}
            />
          )}
          {step === 1 && (
            <div className="space-y-6">
              <IssueTagger selectedTags={issueTags} onTagsChange={setIssueTags} />
              <PhotoUpload
                files={photos}
                onFilesChange={setPhotos}
                required={selectedService?.requires_photos ?? false}
                error={photoError}
              />
            </div>
          )}
          {step === 2 && (
            <div className="space-y-6">
              <DualPriceSlider
                basePrice={basePrice}
                onBasePriceChange={setBasePrice}
                error={priceError}
              />
              <CustomerDetails data={customer} onChange={setCustomer} errors={customerErrors} />
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={prev} disabled={step === 0}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button onClick={next}>
              Next <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleSubmit(false)} disabled={submitting}>
                {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                Create Lead
              </Button>
              <Button onClick={() => handleSubmit(true)} disabled={submitting} className="sticky bottom-0">
                {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-1 h-4 w-4" />}
                WhatsApp Quote
              </Button>
            </div>
          )}
        </div>

        {/* Recent Triages */}
        <RecentTriages />
      </DialogContent>
    </Dialog>
  );
};

export default NewLeadDialog;
