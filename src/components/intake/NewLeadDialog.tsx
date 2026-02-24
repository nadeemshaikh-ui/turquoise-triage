import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import ServiceSelection, { type Service } from "./ServiceSelection";
import CustomerDetails, { type CustomerData } from "./CustomerDetails";
import PhotoUpload from "./PhotoUpload";
import TatConfirmation from "./TatConfirmation";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
};

const STEPS = ["Service", "Customer", "Photos", "Confirm"];

const NewLeadDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — Service
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // Step 2 — Customer
  const [customer, setCustomer] = useState<CustomerData>({ name: "", phone: "", email: "", notes: "" });
  const [customerErrors, setCustomerErrors] = useState<Partial<Record<keyof CustomerData, string>>>({});

  // Step 3 — Photos
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState("");

  // Step 4 — TAT & Price & Tier
  const [quotedPrice, setQuotedPrice] = useState("");
  const [tatMin, setTatMin] = useState(4);
  const [tatMax, setTatMax] = useState(5);
  const [priceError, setPriceError] = useState("");
  const [tier, setTier] = useState<"Premium" | "Elite">("Premium");

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
      setCustomer({ name: "", phone: "", email: "", notes: "" });
      setCustomerErrors({});
      setPhotos([]);
      setPhotoError("");
      setQuotedPrice("");
      setPriceError("");
      setTier("Premium");
    }
  }, [open]);

  // Pre-fill TAT when service changes
  useEffect(() => {
    if (selectedService) {
      setTatMin(selectedService.default_tat_min);
      setTatMax(selectedService.default_tat_max);
      setQuotedPrice(selectedService.default_price ? String(selectedService.default_price) : "");
    }
  }, [selectedService]);

  const isGoldTier =
    selectedService?.category === "Luxury Bags" ||
    (quotedPrice ? Number(quotedPrice) > 6000 : false);

  const handleTierChange = (newTier: "Premium" | "Elite") => {
    setTier(newTier);
    if (!selectedService) return;
    const basePrice = selectedService.default_price ?? 0;
    if (newTier === "Elite") {
      setQuotedPrice(String(Math.round(basePrice * 1.4)));
      setTatMin(8);
      setTatMax(12);
    } else {
      setQuotedPrice(basePrice ? String(basePrice) : "");
      setTatMin(selectedService.default_tat_min);
      setTatMax(selectedService.default_tat_max);
    }
  };

  const validateStep = (): boolean => {
    if (step === 0) return !!selectedService;

    if (step === 1) {
      const errors: Partial<Record<keyof CustomerData, string>> = {};
      if (!customer.name.trim()) errors.name = "Name is required";
      if (!customer.phone.trim()) errors.phone = "Phone is required";
      else if (!/^\d{10}$/.test(customer.phone.trim())) errors.phone = "Enter a valid 10-digit number";
      if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))
        errors.email = "Enter a valid email";
      setCustomerErrors(errors);
      return Object.keys(errors).length === 0;
    }

    if (step === 2) {
      if (selectedService?.requires_photos && photos.length < 3) {
        setPhotoError("Please upload at least 3 photos");
        return false;
      }
      setPhotoError("");
      return true;
    }

    if (step === 3) {
      if (!quotedPrice || Number(quotedPrice) <= 0) {
        setPriceError("Enter a valid price");
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

  const handleSubmit = async () => {
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

      // 2. Create lead
      const { data: lead, error: leadErr } = await supabase
        .from("leads")
        .insert({
          customer_id: customerId,
          service_id: selectedService.id,
          quoted_price: Number(quotedPrice),
          tat_days_min: tatMin,
          tat_days_max: tatMax,
          is_gold_tier: isGoldTier,
          notes: customer.notes || null,
          status: "New",
          tier,
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

      toast({ title: "Lead created!", description: `${customer.name} — ${selectedService.name}` });
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
          <DialogTitle className="text-foreground">New Lead</DialogTitle>
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
            <CustomerDetails data={customer} onChange={setCustomer} errors={customerErrors} />
          )}
          {step === 2 && (
            <PhotoUpload
              files={photos}
              onFilesChange={setPhotos}
              required={selectedService?.requires_photos ?? false}
              error={photoError}
            />
          )}
          {step === 3 && selectedService && (
          <TatConfirmation
              service={selectedService}
              quotedPrice={quotedPrice}
              onPriceChange={setQuotedPrice}
              tatMin={tatMin}
              tatMax={tatMax}
              onTatMinChange={setTatMin}
              onTatMaxChange={setTatMax}
              isGoldTier={isGoldTier}
              customerName={customer.name}
              priceError={priceError}
              tier={tier}
              onTierChange={handleTierChange}
            />
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
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
              Create Lead
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewLeadDialog;
