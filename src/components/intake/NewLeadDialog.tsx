import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, MessageSquare, Check, Plus, X, ChevronDown, ChevronUp, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import CustomerDetails, { type CustomerData } from "./CustomerDetails";
import PhotoUpload from "./PhotoUpload";
import QuotePreview from "./QuotePreview";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type Category = { id: string; name: string; icon_name: string; sort_order: number; is_active: boolean };
type CatIssue = { id: string; category_id: string; name: string; suggestive_price: number; description: string | null; is_active: boolean };
type CatPackage = { id: string; category_id: string; name: string; suggestive_price: number; includes: string[]; description: string | null; is_active: boolean };

export type QuoteItem = {
  categoryId: string;
  categoryName: string;
  mode: "alacarte" | "package";
  selectedIssues: { id: string; name: string; suggestive_price: number }[];
  selectedPackageId: string | null;
  selectedPackageName: string;
  suggestivePrice: number;
  manualPrice: number;
  description: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
};

const emptyItem = (): QuoteItem => ({
  categoryId: "",
  categoryName: "",
  mode: "alacarte",
  selectedIssues: [],
  selectedPackageId: null,
  selectedPackageName: "",
  suggestivePrice: 0,
  manualPrice: 0,
  description: "",
});

const NewLeadDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Master data
  const [categories, setCategories] = useState<Category[]>([]);
  const [allIssues, setAllIssues] = useState<CatIssue[]>([]);
  const [allPackages, setAllPackages] = useState<CatPackage[]>([]);

  // Items
  const [items, setItems] = useState<QuoteItem[]>([emptyItem()]);

  // Photos
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState("");

  // Customer
  const [customer, setCustomer] = useState<CustomerData>({ name: "", phone: "", email: "", notes: "", campaign: "", city: "", address: "" });
  const [customerErrors, setCustomerErrors] = useState<Partial<Record<keyof CustomerData, string>>>({});

  useEffect(() => {
    if (!open) return;
    Promise.all([
      supabase.from("service_categories").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("category_issues").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("category_packages").select("*").eq("is_active", true).order("sort_order"),
    ]).then(([catRes, issRes, pkgRes]) => {
      setCategories((catRes.data as any[]) || []);
      setAllIssues((issRes.data as any[]) || []);
      setAllPackages((pkgRes.data as any[]) || []);
    });
  }, [open]);

  useEffect(() => {
    if (!open) {
      setItems([emptyItem()]);
      setPhotos([]);
      setPhotoError("");
      setCustomer({ name: "", phone: "", email: "", notes: "", campaign: "", city: "", address: "" });
      setCustomerErrors({});
      setShowPreview(false);
      setAdvancedOpen(false);
    }
  }, [open]);

  const updateItem = (index: number, updates: Partial<QuoteItem>) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  // Totals
  const premiumTotal = useMemo(() => items.reduce((sum, i) => sum + i.manualPrice, 0) + 200, [items]);
  const eliteTotal = useMemo(() => Math.round(items.reduce((sum, i) => sum + i.manualPrice, 0) * 1.4), [items]);
  const rawTotal = useMemo(() => items.reduce((sum, i) => sum + i.manualPrice, 0), [items]);

  const validate = (): boolean => {
    const errors: Partial<Record<keyof CustomerData, string>> = {};
    if (!customer.name.trim()) errors.name = "Required";
    if (!customer.phone.trim()) errors.phone = "Required";
    else if (!/^\d{10}$/.test(customer.phone.trim())) errors.phone = "10 digits";
    if (!customer.campaign) errors.campaign = "Required";
    if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) errors.email = "Invalid email";
    setCustomerErrors(errors);
    if (Object.keys(errors).length > 0) return false;

    for (const item of items) {
      if (!item.categoryId) {
        toast({ title: "Select a category for each item", variant: "destructive" });
        return false;
      }
      if (item.manualPrice <= 0) {
        toast({ title: "Set a price for each item", variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const handleGenerateQuote = () => {
    if (validate()) setShowPreview(true);
  };

  const handleSubmit = async (mode: "create" | "whatsapp" | "interakt" = "create") => {
    setSubmitting(true);
    try {
      // Upsert customer
      const { data: existingCustomers } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", customer.phone.trim())
        .limit(1);

      let customerId: string;
      const custPayload: any = {
        name: customer.name.trim(),
        email: customer.email || null,
        city: customer.city || null,
        address: customer.address || null,
      };

      if (existingCustomers && existingCustomers.length > 0) {
        customerId = existingCustomers[0].id;
        await supabase.from("customers").update(custPayload).eq("id", customerId);
      } else {
        const { data: newCust, error: custErr } = await supabase
          .from("customers")
          .insert({ ...custPayload, phone: customer.phone.trim() })
          .select("id")
          .single();
        if (custErr) throw custErr;
        customerId = newCust.id;
      }

      // Insert lead
      const { data: lead, error: leadErr } = await supabase
        .from("leads")
        .insert({
          customer_id: customerId,
          service_id: null as any,
          quoted_price: rawTotal,
          tat_days_min: 8,
          tat_days_max: 20,
          is_gold_tier: rawTotal > 6000,
          notes: customer.notes || null,
          status: "New",
          tier: "Elite",
          meta_campaign_name: customer.campaign || null,
        })
        .select("id")
        .single();
      if (leadErr) throw leadErr;

      // Insert lead_items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await supabase.from("lead_items").insert({
          lead_id: lead.id,
          category_id: item.categoryId,
          mode: item.mode,
          selected_issues: item.selectedIssues as any,
          selected_package_id: item.selectedPackageId,
          selected_package_name: item.selectedPackageName || null,
          suggestive_price: item.suggestivePrice,
          manual_price: item.manualPrice,
          description: item.description || null,
          sort_order: i,
        });
      }

      // Upload photos
      for (const file of photos) {
        const path = `${lead.id}/${Date.now()}_${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("lead-photos").upload(path, file);
        if (uploadErr) throw uploadErr;
        await supabase.from("lead_photos").insert({ lead_id: lead.id, storage_path: path, file_name: file.name });
      }

      // Quote record
      const quoteToken = crypto.randomUUID().slice(0, 8);
      await supabase.from("lead_quotes").insert({
        lead_id: lead.id,
        quote_token: quoteToken,
        premium_price: premiumTotal,
        elite_price: eliteTotal,
        premium_tat_min: 15,
        premium_tat_max: 20,
        elite_tat_min: 8,
        elite_tat_max: 12,
      });

      const quoteUrl = `${window.location.origin}/quote/${quoteToken}`;

      if (mode === "whatsapp") {
        try {
          await supabase.functions.invoke("send-whatsapp", {
            body: { lead_id: lead.id, customer_phone: customer.phone.trim(), customer_name: customer.name.trim(), service_name: items.map((i) => i.categoryName).join(" + "), template_type: "digital_quote", quote_url: quoteUrl },
          });
          toast({ title: "Quote sent via WhatsApp!", description: quoteUrl });
        } catch {
          await navigator.clipboard.writeText(quoteUrl);
          toast({ title: "WhatsApp unavailable — link copied!", description: quoteUrl });
        }
      } else if (mode === "interakt") {
        const message = `Hi ${customer.name.trim()}! Here is your bespoke restoration quote from Restoree: ${quoteUrl}`;
        await navigator.clipboard.writeText(message);
        toast({ title: "Copied for Interakt!" });
      } else {
        toast({ title: "Lead created!", description: `${customer.name} — ${items.length} item(s)` });
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground text-sm">Multi-Item Quote Builder</DialogTitle>
        </DialogHeader>

        {showPreview ? (
          <QuotePreview
            items={items}
            onItemsChange={setItems}
            eliteTotal={eliteTotal}
            premiumTotal={premiumTotal}
            customerName={customer.name}
            customerPhone={customer.phone}
            photos={photos}
            submitting={submitting}
            onConfirmCreate={() => handleSubmit("create")}
            onConfirmWhatsApp={() => handleSubmit("whatsapp")}
            onCopyInterakt={() => handleSubmit("interakt")}
            onBack={() => setShowPreview(false)}
          />
        ) : (
          <div className="space-y-4">
            {/* Customer */}
            <Card className="p-4 border-primary/20">
              <CustomerDetails data={customer} onChange={setCustomer} errors={customerErrors} />
            </Card>

            {/* Items */}
            {items.map((item, idx) => (
              <ItemCard
                key={idx}
                item={item}
                index={idx}
                categories={categories}
                allIssues={allIssues}
                allPackages={allPackages}
                canRemove={items.length > 1}
                onUpdate={(updates) => updateItem(idx, updates)}
                onRemove={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
              />
            ))}

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1"
              onClick={() => setItems((prev) => [...prev, emptyItem()])}
            >
              <Plus className="h-4 w-4" /> Add Another Item
            </Button>

            {/* Photos */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground">
                  Photos
                  {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card className="p-4 border-primary/20 mt-2">
                  <PhotoUpload files={photos} onFilesChange={setPhotos} required={false} error={photoError} />
                </Card>
              </CollapsibleContent>
            </Collapsible>

            {/* Running Total */}
            <Card className="p-3 border-primary/20 bg-muted/30">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Premium Total (+ ₹200 shipping)</span>
                <span className="font-semibold text-foreground">₹{premiumTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-primary font-medium">Elite Total (×1.4, free shipping)</span>
                <span className="font-bold text-primary">₹{eliteTotal.toLocaleString()}</span>
              </div>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => { if (validate()) handleSubmit("create"); }} disabled={submitting} className="min-h-[48px] text-base">
                {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                Create
              </Button>
              <Button onClick={handleGenerateQuote} disabled={submitting} className="min-h-[48px] text-base">
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

/* ---- Item Card ---- */
function ItemCard({
  item, index, categories, allIssues, allPackages, canRemove, onUpdate, onRemove,
}: {
  item: QuoteItem; index: number; categories: Category[]; allIssues: CatIssue[]; allPackages: CatPackage[];
  canRemove: boolean; onUpdate: (u: Partial<QuoteItem>) => void; onRemove: () => void;
}) {
  const catIssues = allIssues.filter((i) => i.category_id === item.categoryId);
  const catPackages = allPackages.filter((p) => p.category_id === item.categoryId);

  const handleCategoryChange = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    onUpdate({
      categoryId: catId,
      categoryName: cat?.name || "",
      selectedIssues: [],
      selectedPackageId: null,
      selectedPackageName: "",
      suggestivePrice: 0,
      manualPrice: 0,
      description: "",
    });
  };

  const toggleIssue = (issue: CatIssue) => {
    const exists = item.selectedIssues.find((i) => i.id === issue.id);
    let newIssues: QuoteItem["selectedIssues"];
    if (exists) {
      newIssues = item.selectedIssues.filter((i) => i.id !== issue.id);
    } else {
      newIssues = [...item.selectedIssues, { id: issue.id, name: issue.name, suggestive_price: issue.suggestive_price }];
    }
    const suggestive = newIssues.reduce((s, i) => s + i.suggestive_price, 0);
    const desc = newIssues.map((i) => i.name).join(" + ");
    onUpdate({ selectedIssues: newIssues, suggestivePrice: suggestive, manualPrice: suggestive, description: desc });
  };

  const selectPackage = (pkg: CatPackage) => {
    onUpdate({
      selectedPackageId: pkg.id,
      selectedPackageName: pkg.name,
      suggestivePrice: pkg.suggestive_price,
      manualPrice: pkg.suggestive_price,
      description: `${pkg.name} (${pkg.includes.join(", ")})`,
    });
  };

  return (
    <Card className="p-4 border-primary/20 space-y-3 relative">
      {canRemove && (
        <button onClick={onRemove} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive">
          <X className="h-4 w-4" />
        </button>
      )}
      <p className="text-xs font-semibold text-muted-foreground">Item {index + 1}</p>

      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => handleCategoryChange(c.id)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
              item.categoryId === c.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-primary/50"
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      {item.categoryId && (
        <>
          {/* Mode toggle */}
          <div className="flex items-center gap-2">
            <span className={cn("text-xs font-medium", item.mode === "alacarte" ? "text-primary" : "text-muted-foreground")}>Alacarte</span>
            <Switch
              checked={item.mode === "package"}
              onCheckedChange={(v) => onUpdate({
                mode: v ? "package" : "alacarte",
                selectedIssues: [],
                selectedPackageId: null,
                selectedPackageName: "",
                suggestivePrice: 0,
                manualPrice: 0,
                description: "",
              })}
            />
            <span className={cn("text-xs font-medium", item.mode === "package" ? "text-primary" : "text-muted-foreground")}>Package</span>
          </div>

          {/* Alacarte issues */}
          {item.mode === "alacarte" && (
            <div className="flex flex-wrap gap-1.5">
              {catIssues.map((issue) => {
                const isActive = item.selectedIssues.some((i) => i.id === issue.id);
                return (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => toggleIssue(issue)}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-all",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:border-primary/50"
                    )}
                  >
                    {issue.name} <span className="opacity-75">₹{issue.suggestive_price}</span>
                  </button>
                );
              })}
              {catIssues.length === 0 && <p className="text-xs text-muted-foreground">No issues defined for this category.</p>}
            </div>
          )}

          {/* Package selection */}
          {item.mode === "package" && (
            <div className="space-y-1.5">
              {catPackages.map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => selectPackage(pkg)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border p-2.5 text-left transition-all",
                    item.selectedPackageId === pkg.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div>
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1"><Package className="h-3 w-3" />{pkg.name}</p>
                    {pkg.includes.length > 0 && <p className="text-[10px] text-muted-foreground">{pkg.includes.join(", ")}</p>}
                  </div>
                  <Badge variant="outline" className="text-xs font-semibold">₹{pkg.suggestive_price}</Badge>
                </button>
              ))}
              {catPackages.length === 0 && <p className="text-xs text-muted-foreground">No packages defined for this category.</p>}
            </div>
          )}

          {/* Pricing row */}
          <div className="flex items-center gap-3">
            {item.suggestivePrice > 0 && (
              <Badge variant="secondary" className="text-[10px]">Suggested: ₹{item.suggestivePrice}</Badge>
            )}
            <div className="flex-1">
              <Label className="text-[10px] text-muted-foreground">Final Price</Label>
              <Input
                type="number"
                value={item.manualPrice || ""}
                onChange={(e) => onUpdate({ manualPrice: Number(e.target.value) })}
                className="h-8 text-sm"
                placeholder="₹"
              />
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

export default NewLeadDialog;
