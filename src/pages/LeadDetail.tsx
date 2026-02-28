import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Crown, Clock, Phone, Mail, Camera, MessageSquare, CheckCircle2, Loader2, Upload, ImagePlus, Trash2, X, Award, ClipboardList, Plus, MapPin, Save, Send, ExternalLink, Info, Copy, Eye, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useLeadDetail } from "@/hooks/useLeadDetail";
import { useLeadItemPhotos, useOrphanedPhotos } from "@/hooks/useLeadItemPhotos";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

// PhotoThumb sub-component: handles broken image gracefully
const PhotoThumb = ({ url, fileName }: { url: string; fileName: string }) => {
  const [failed, setFailed] = useState(false);
  if (failed || !url) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-muted">
        <Camera className="h-6 w-6 text-muted-foreground/50" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={fileName}
      className="h-full w-full object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
};

const statusColor: Record<string, string> = {
  New: "bg-primary/15 text-primary border-primary/30",
  Quoted: "bg-blue-100 text-blue-800 border-blue-300",
  Assigned: "bg-accent text-accent-foreground border-accent",
  "In Progress": "bg-gold/15 text-gold-foreground border-gold/30",
  QC: "bg-secondary text-secondary-foreground border-border",
  "Ready for Pickup": "bg-green-100 text-green-800 border-green-300",
  Completed: "bg-muted text-muted-foreground border-border",
};

const actionIcons: Record<string, typeof CheckCircle2> = {
  status_change: CheckCircle2,
  note: MessageSquare,
  photo_upload: Camera,
};

// Map UI pill labels → DB category names in service_pricing_master
const CATEGORY_DB_MAP: Record<string, string> = {
  Bag: "Luxury Handbags",
  Shoe: "Sneakers",
  Belt: "Belt",
  Wallet: "Wallet",
  Others: "Others",
};

const CATEGORY_PILLS = ["Bag", "Shoe", "Belt", "Wallet", "Others"] as const;

const LeadDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { lead, photos, activity, isLoading, updateStatus, updateTat, addNote, uploadPhotos, deletePhoto } = useLeadDetail(id!);
  const [note, setNote] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Items form state
  const [newBrandId, setNewBrandId] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [selectedPill, setSelectedPill] = useState("");
  const [newServiceType, setNewServiceType] = useState("");
  const [manualPrice, setManualPrice] = useState(0);
  const [itemDescription, setItemDescription] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  // Add New Brand state
  const [isAddingBrand, setIsAddingBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [brandError, setBrandError] = useState("");
  const [manualServiceText, setManualServiceText] = useState(""); // kept for legacy compat but canonical pills preferred

  // Dynamic TAT state
  const [tatMin, setTatMin] = useState(4);
  const [tatMax, setTatMax] = useState(5);
  const [tatOverridden, setTatOverridden] = useState(false);

  // Address state
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Populate address from lead data
  useEffect(() => {
    if (lead) {
      setAddressLine1(lead.customerAddress || "");
      setCity(lead.customerCity || "");
      setState(lead.customerState || "");
      setPincode(lead.customerPincode || "");
    }
  }, [lead]);

  const { data: leadItems } = useQuery({
    queryKey: ["lead-items", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lead_items")
        .select("*, service_categories(name), brands(name, tier)")
        .eq("lead_id", id!)
        .order("sort_order");
      return (data as any[]) || [];
    },
    enabled: !!id,
  });

  const { data: brandsOptions } = useQuery({
    queryKey: ["brands-options"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const { data: categoriesOptions } = useQuery({
    queryKey: ["categories-options"],
    queryFn: async () => {
      const { data } = await supabase.from("service_categories").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
  });

  // Dynamic service types from service_pricing_master
  const dbCategory = selectedPill ? CATEGORY_DB_MAP[selectedPill] : "";
  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["pricing-service-types", dbCategory],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_pricing_master")
        .select("service_type")
        .ilike("category", dbCategory);
      return [...new Set((data || []).map((r: any) => r.service_type))];
    },
    enabled: !!dbCategory,
  });

  // Dynamic price lookup
  const activeServiceType = newServiceType || manualServiceText;
  useEffect(() => {
    if (!dbCategory || !activeServiceType) return;
    (async () => {
      const { data } = await supabase
        .from("service_pricing_master")
        .select("base_price")
        .ilike("category", dbCategory)
        .ilike("service_type", activeServiceType)
        .limit(1);
      if (data && data.length > 0) {
        setManualPrice(Number(data[0].base_price));
      }
    })();
  }, [dbCategory, activeServiceType]);

  // Dynamic TAT computation — only when not manually overridden
  useEffect(() => {
    if (tatOverridden || !leadItems || leadItems.length === 0) return;
    const hasRestoration = leadItems.some((i: any) =>
      (i.service_type || "").toLowerCase() === "restoration"
    );
    const allCleaning = leadItems.every((i: any) =>
      (i.service_type || "").toLowerCase() === "cleaning"
    );
    if (hasRestoration) {
      setTatMin(10);
      setTatMax(15);
    } else if (allCleaning) {
      setTatMin(3);
      setTatMax(5);
    } else {
      setTatMin(4);
      setTatMax(5);
    }
  }, [leadItems, tatOverridden]);

  // Initialize TAT from lead data (including manual lock)
  useEffect(() => {
    if (lead) {
      setTatOverridden(lead.tatIsManual);
      if (!lead.tatIsManual) {
        setTatMin(lead.tatDaysMin);
        setTatMax(lead.tatDaysMax);
      } else {
        setTatMin(lead.tatDaysMin);
        setTatMax(lead.tatDaysMax);
      }
    }
  }, [lead]);

  // Map pill to category UUID
  const getCategoryIdForPill = (pill: string) => {
    const dbName = CATEGORY_DB_MAP[pill];
    // Try exact match first, then case-insensitive
    return categoriesOptions?.find(
      (c) => c.name === dbName || c.name === pill || c.name.toLowerCase() === dbName?.toLowerCase()
    )?.id || "";
  };

  const handlePillSelect = (pill: string) => {
    const catId = getCategoryIdForPill(pill);
    setSelectedPill(pill);
    setNewCategoryId(catId);
    setNewServiceType("");
    setManualPrice(0);
    setItemDescription("");
    setNewBrandId("");
    setIsAddingBrand(false);
    setNewBrandName("");
  };

  const showDescriptionField = true; // Show custom label for all categories

  // Orphaned photos
  const { photos: orphanedPhotos } = useOrphanedPhotos(id!);

  const addItemMutation = useMutation({
    mutationFn: async () => {
      const insertData: any = {
        lead_id: id!,
        brand_id: newBrandId,
        category_id: newCategoryId,
        service_type: newServiceType.toLowerCase(),
        manual_price: manualPrice,
        sort_order: leadItems?.length || 0,
      };
      if (itemDescription.trim()) {
        insertData.description = itemDescription.trim();
      }
      const { error } = await supabase.from("lead_items").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-items", id] });
      setNewBrandId("");
      setNewCategoryId("");
      setSelectedPill("");
      setNewServiceType("");
      setManualPrice(0);
      setItemDescription("");
      setIsAddingBrand(false);
      setNewBrandName("");
      setManualServiceText("");
      toast.success("Item added");
    },
    onError: (err: any) => toast.error(err.message || "Failed to add item"),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("lead_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-items", id] });
      setConfirmingDeleteId(null);
      toast.success("Item removed");
    },
  });

  const saveBrandMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .insert({ name: newBrandName.trim() })
        .select("id, name")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["brands-options"] });
      setNewBrandId(data.id);
      setIsAddingBrand(false);
      setNewBrandName("");
      setBrandError("");
      toast.success(`Brand "${data.name}" created`);
    },
    onError: () => setBrandError("Could not save brand. Try again."),
  });

  const { data: customerLegacy } = useQuery({
    queryKey: ["customer-legacy", lead?.customerId],
    queryFn: async () => {
      if (!lead?.customerId) return null;
      const { data } = await supabase
        .from("customers")
        .select("legacy_ltv, legacy_source, service_affinity, historical_context")
        .eq("id", lead.customerId)
        .single();
      return data;
    },
    enabled: !!lead?.customerId,
  });

  if (isLoading || !lead) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasItems = leadItems && leadItems.length > 0;
  const pincodeValid = /^\d{6}$/.test(pincode);
  const canConvert = hasItems && pincodeValid;
  const isConverted = !!lead.convertedOrderId;
  const isQuoted = lead.status === "Quoted";

  // Pre-quote validation
  const validateForQuote = (): string | null => {
    if (!leadItems || leadItems.length === 0) return "Add at least one item before sending to portal";
    for (let i = 0; i < leadItems.length; i++) {
      const item = leadItems[i];
      const catName = item.service_categories?.name || "";
      const isBagOrShoe = ["Bag", "Shoe", "Luxury Handbags", "Sneakers", "Heels", "Stilettos"].some(
        (c) => catName.toLowerCase().includes(c.toLowerCase())
      );
      if (!item.service_type) return `Item ${i + 1} (${catName}) is missing service type`;
      if (Number(item.manual_price) <= 0) return `Item ${i + 1} (${catName}) is missing price`;
      if (isBagOrShoe && !item.brand_id) return `Item ${i + 1} (${catName}) is missing brand`;
    }
    return null;
  };

  const handleSendToPortal = () => {
    const validationError = validateForQuote();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    updateStatus.mutate("Quoted", {
      onSuccess: (data: any) => {
        if (data?.status === "Quoted") {
          toast.success("Lead sent to customer portal");
        } else {
          toast.error("Status update did not confirm — please retry");
        }
      },
      onError: (err: any) => toast.error(err.message || "Failed to send to portal"),
    });
  };

  const handleRecallFromPortal = () => {
    updateStatus.mutate("New", {
      onSuccess: () => toast.success("Lead recalled from portal"),
      onError: (err: any) => toast.error(err.message || "Failed to recall from portal"),
    });
  };

  const handleCopyPortalLink = async () => {
    const url = `${window.location.origin}/portal/${lead.customerId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Portal link copied!");
    } catch {
      toast.info(url);
    }
  };

  const handleAddNote = () => {
    if (!note.trim()) return;
    addNote.mutate(note.trim(), {
      onSuccess: () => {
        setNote("");
        toast.success("Note added");
      },
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    uploadPhotos.mutate(files, {
      onSuccess: () => toast.success(`${files.length} photo${files.length > 1 ? "s" : ""} uploaded`),
      onError: () => toast.error("Upload failed"),
    });
    e.target.value = "";
  };

  const handleConvertToOrder = async () => {
    if (!lead || !canConvert || !user?.id) return;
    setConverting(true);
    try {
      const { data, error } = await supabase.rpc('convert_lead_to_order', { 
        p_lead_id: lead.id,
        p_actor_user_id: user.id,
      } as any);
      if (error) throw error;
      toast.success("Order created!");
      navigate(`/orders/${data}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create order");
    } finally {
      setConverting(false);
    }
  };

  const handleSaveLead = async () => {
    if (!addressLine1.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
      toast.error("Please fill Address Line 1, City, State, and Pincode");
      return;
    }
    if (!/^\d{6}$/.test(pincode)) {
      toast.error("Pincode must be a 6-digit number");
      return;
    }
    setIsSaving(true);
    try {
      const fullAddress = `${addressLine1.trim()}${addressLine2.trim() ? ', ' + addressLine2.trim() : ''}, ${city.trim()}, ${state.trim()} - ${pincode.trim()}`;
      const { error } = await supabase
        .from("customers")
        .update({ address: fullAddress, city: city.trim(), state: state.trim(), pincode: pincode.trim() })
        .eq("id", lead.customerId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      toast.success("Lead saved successfully");
    } catch {
      toast.error("Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const pincodeError = pincode.length > 0 && !/^\d{6}$/.test(pincode);

  const handleAddItem = () => {
    const missing: string[] = [];
    if (!newBrandId) missing.push("Brand");
    if (!newCategoryId) missing.push("Category");
    if (!newServiceType) missing.push("Service Type");
    if (manualPrice <= 0 || isNaN(manualPrice)) missing.push("Price (must be > 0)");
    if (missing.length > 0) {
      toast.error(`Please select: ${missing.join(", ")}`);
      return;
    }
    addItemMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-bold text-foreground">{lead.customerName}</h1>
              {lead.isGoldTier && <Crown className="h-4 w-4 shrink-0 text-gold" />}
              {customerLegacy && Number(customerLegacy.legacy_ltv) > 25000 && (
                <Badge className="text-[8px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 gap-0.5">
                  <Award className="h-2.5 w-2.5" />Legacy VIP
                </Badge>
              )}
            </div>
            <p className="truncate text-sm text-muted-foreground">{lead.serviceName}</p>
          </div>
          <Badge variant="outline" className={`shrink-0 rounded-full text-xs ${statusColor[lead.status] || ""}`}>
            {lead.status}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        {/* Converted Banner */}
        {isConverted && (
          <div className="rounded-[var(--radius)] border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">This lead has been converted to an Order</p>
            </div>
            <Link to={`/orders/${lead.convertedOrderId}`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> View Order
              </Button>
            </Link>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InfoCard label="Quoted Price" value={`₹${lead.quotedPrice.toLocaleString("en-IN")}`} />
          <div className="rounded-[var(--radius)] border border-border bg-card p-3">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">TAT</span>
              {tatOverridden && <Badge variant="outline" className="text-[8px]">Manual</Badge>}
            </div>
            <div className="mt-1 flex items-center gap-1">
              <Input
                type="number"
                min={1}
                value={tatMin}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setTatMin(val);
                  setTatOverridden(true);
                  updateTat.mutate({ tat_days_min: val, tat_days_max: tatMax, tat_is_manual: true });
                }}
                className="h-7 w-12 text-center text-sm font-semibold p-0"
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="number"
                min={1}
                value={tatMax}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setTatMax(val);
                  setTatOverridden(true);
                  updateTat.mutate({ tat_days_min: tatMin, tat_days_max: val, tat_is_manual: true });
                }}
                className="h-7 w-12 text-center text-sm font-semibold p-0"
              />
              <span className="text-xs text-muted-foreground">days</span>
            </div>
            {tatOverridden && (
              <button
                className="mt-1 text-[10px] text-primary hover:underline"
                onClick={() => {
                  setTatOverridden(false);
                  // Recompute from items
                  const hasRestoration = leadItems?.some((i: any) => (i.service_type || "").toLowerCase() === "restoration");
                  const allCleaning = leadItems?.every((i: any) => (i.service_type || "").toLowerCase() === "cleaning") && (leadItems?.length ?? 0) > 0;
                  const newMin = hasRestoration ? 10 : allCleaning ? 3 : 4;
                  const newMax = hasRestoration ? 15 : allCleaning ? 5 : 5;
                  setTatMin(newMin);
                  setTatMax(newMax);
                  updateTat.mutate({ tat_days_min: newMin, tat_days_max: newMax, tat_is_manual: false });
                }}
              >
                Reset to Auto
              </button>
            )}
          </div>
          <InfoCard label="Phone" value={lead.customerPhone} icon={<Phone className="h-3.5 w-3.5 text-muted-foreground" />} />
          <InfoCard label="Category" value={lead.category} />
        </div>

        {lead.notes && (
          <div className="rounded-[var(--radius)] border border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">{lead.notes}</p>
          </div>
        )}

        {/* Legacy Context */}
        {customerLegacy?.historical_context && (
          <div className="rounded-[var(--radius)] border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10 p-4 space-y-1">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Historical Context</p>
              {customerLegacy.legacy_source && (
                <Badge variant="outline" className="text-[9px]">{customerLegacy.legacy_source}</Badge>
              )}
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300/80">{customerLegacy.historical_context}</p>
            {customerLegacy.service_affinity && (customerLegacy.service_affinity as string[]).length > 0 && (
              <div className="flex gap-1 pt-1">
                {(customerLegacy.service_affinity as string[]).map((a: string) => (
                  <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Structured Address Block */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Address</h2>
          </div>
          <div className="rounded-[var(--radius)] border border-border bg-card p-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Address Line 1 *</Label>
              <Input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="House/flat no, building, street" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Address Line 2 (Optional)</Label>
              <Input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} placeholder="Landmark, area" className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">City *</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">State *</Label>
                <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="State" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pincode *</Label>
                <Input
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="6 digits"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className={`h-9 text-sm ${pincodeError ? "border-destructive" : ""}`}
                />
                {pincodeError && <p className="text-[11px] text-destructive">Must be a 6-digit number</p>}
              </div>
            </div>
            {!isConverted && (
              <Button onClick={handleSaveLead} disabled={isSaving} className="w-full gap-2" size="sm">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Lead
              </Button>
            )}
          </div>
        </section>

        {/* Lead Items Manager */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Items</h2>
            <Badge variant="secondary" className="text-[10px]">{leadItems?.length || 0}</Badge>
          </div>

          {leadItems && leadItems.length > 0 && (
            <div className="space-y-2">
              {leadItems.map((item: any) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  leadId={id!}
                  isConverted={isConverted}
                  confirmingDeleteId={confirmingDeleteId}
                  onConfirmDelete={setConfirmingDeleteId}
                  onDelete={(itemId) => deleteItemMutation.mutate(itemId)}
                  deleteIsPending={deleteItemMutation.isPending}
                />
              ))}
            </div>
          )}

          {(!leadItems || leadItems.length === 0) && (
            <p className="text-sm text-muted-foreground">No items yet. Add at least one item below.</p>
          )}

          {/* Add Item Form — hidden when converted */}
          {!isConverted && (
            <div className="rounded-[var(--radius)] border border-dashed border-border bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Add Item</p>

              {/* Category Pills */}
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_PILLS.map((pill) => (
                  <button
                    key={pill}
                    onClick={() => handlePillSelect(pill)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                      selectedPill === pill
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border hover:border-primary/40"
                    )}
                  >
                    {pill}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Brand dropdown */}
                {!isAddingBrand ? (
                  <Select value={newBrandId} onValueChange={(val) => {
                    if (val === "__add_new__") {
                      setIsAddingBrand(true);
                      setNewBrandId("");
                    } else {
                      setNewBrandId(val);
                    }
                  }}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brandsOptions?.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                      <SelectItem value="__add_new__">+ Add New Brand</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-1">
                    <Input
                      value={newBrandName}
                      onChange={(e) => { setNewBrandName(e.target.value); setBrandError(""); }}
                      placeholder="New brand name"
                      className="h-9 text-xs flex-1"
                    />
                    <Button size="sm" className="h-9 text-xs px-2" disabled={!newBrandName.trim() || saveBrandMutation.isPending} onClick={() => saveBrandMutation.mutate()}>
                      {saveBrandMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                    </Button>
                    <button className="text-xs text-muted-foreground hover:text-foreground px-1" onClick={() => { setIsAddingBrand(false); setNewBrandName(""); setBrandError(""); }}>Cancel</button>
                  </div>
                )}
                {brandError && <p className="text-[11px] text-destructive col-span-full">{brandError}</p>}

              {/* Service Type — canonical Cleaning/Restoration pills */}
                <div className="flex gap-1.5 items-center col-span-full sm:col-span-1">
                  {["cleaning", "restoration"].map((st) => (
                    <button
                      key={st}
                      onClick={() => { setNewServiceType(st); setManualServiceText(""); }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                        newServiceType === st
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-border hover:border-primary/40"
                      )}
                    >
                      {st.charAt(0).toUpperCase() + st.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price field — editable suggestion */}
              {selectedPill && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Price (Rs.) — editable</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(Number(e.target.value))}
                    className="h-9 text-sm"
                  />
                </div>
              )}

              {/* Custom label (optional) */}
              {selectedPill && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Custom Label (optional)</Label>
                  <Input
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    placeholder="e.g. deep cleaning, full restoration + dye"
                    className="h-9 text-sm"
                  />
                </div>
              )}

              <Button size="sm" className="gap-1.5" onClick={handleAddItem} disabled={addItemMutation.isPending}>
                {addItemMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add
              </Button>
            </div>
          )}
        </section>

        {/* 3-State Portal Workflow */}
        {!isConverted && (
          <section className="space-y-2">
            {!isQuoted && (
              <Button onClick={handleSendToPortal} disabled={updateStatus.isPending} className="w-full gap-2">
                {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send to Portal
              </Button>
            )}
            {isQuoted && (
              <div className="space-y-2">
                {hasItems ? null : (
                  <div className="rounded-[var(--radius)] border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3">
                    <p className="text-xs text-amber-700 dark:text-amber-300">⚠ Quote is live but has 0 items</p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" onClick={handleCopyPortalLink} className="gap-1.5 text-xs">
                    <Copy className="h-3.5 w-3.5" /> Copy Link
                  </Button>
                  <Button variant="outline" onClick={() => window.open(`/portal/${lead.customerId}`, "_blank")} className="gap-1.5 text-xs">
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </Button>
                  <Button variant="outline" onClick={handleRecallFromPortal} disabled={updateStatus.isPending} className="gap-1.5 text-xs">
                    {updateStatus.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    Recall
                  </Button>
                </div>
                {/* Convert to Order */}
                <Button
                  onClick={handleConvertToOrder}
                  disabled={!canConvert || converting}
                  variant="outline"
                  className="w-full gap-2 border-primary/30"
                >
                  {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                  Convert to Order
                </Button>
                {!hasItems && <p className="text-center text-xs text-amber-600">⚠ Add at least 1 item to convert</p>}
                {!pincodeValid && <p className="text-center text-xs text-amber-600">⚠ A valid 6-digit Pincode is required to convert</p>}
              </div>
            )}
          </section>
        )}

        {/* Photo Gallery */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Photos</h2>
              <span className="text-xs text-muted-foreground">({photos.length})</span>
            </div>
            <div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
              <Button variant="outline" size="sm" className="gap-1.5 rounded-[var(--radius)]" onClick={() => fileInputRef.current?.click()} disabled={uploadPhotos.isPending}>
                {uploadPhotos.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                Upload
              </Button>
            </div>
          </div>
          {photos.length === 0 ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-[var(--radius)] border border-dashed border-border bg-muted/30 p-8 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50"
            >
              <ImagePlus className="h-8 w-8" />
              <span className="text-sm">Click to upload photos</span>
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((p) => (
                <div key={p.id} className="group relative aspect-square overflow-hidden rounded-[calc(var(--radius)/2)] border border-border bg-muted transition-shadow hover:shadow-md">
                  <button onClick={() => setSelectedPhoto(p.url)} className="h-full w-full">
                    <PhotoThumb url={p.url} fileName={p.fileName} />
                  </button>
                  <button
                    onClick={() => deletePhoto.mutate({ id: p.id, storagePath: p.storagePath }, { onSuccess: () => toast.success("Photo deleted") })}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Orphaned Photos */}
        {orphanedPhotos.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Unassigned Photos</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {orphanedPhotos.map((p) => (
                <div key={p.id} className="relative aspect-square overflow-hidden rounded-[calc(var(--radius)/2)] border border-dashed border-amber-300 bg-muted">
                  <PhotoThumb url={p.url} fileName={p.fileName} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Photo Lightbox */}
        {selectedPhoto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSelectedPhoto(null)}>
            <img src={selectedPhoto} alt="Lead photo" className="max-h-[85vh] max-w-full rounded-[var(--radius)] object-contain" />
          </div>
        )}

        {/* Add Note */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Add a Note</h2>
          <div className="flex gap-2">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Type a note…" className="min-h-[60px] rounded-[calc(var(--radius)/2)]" />
            <Button onClick={handleAddNote} disabled={!note.trim() || addNote.isPending} size="icon" className="shrink-0 self-end rounded-[var(--radius)]">
              {addNote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
            </Button>
          </div>
        </section>

        {/* Activity Timeline */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Activity</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="space-y-0">
              {activity.map((item, i) => {
                const Icon = actionIcons[item.action] || MessageSquare;
                return (
                  <div key={item.id} className="relative flex gap-3 pb-4">
                    {i < activity.length - 1 && <div className="absolute left-[13px] top-7 h-full w-px bg-border" />}
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-sm text-foreground">{item.details || item.action}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.userName && `${item.userName} · `}
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-center text-xs text-muted-foreground">
          Created {format(new Date(lead.createdAt), "MMM d, yyyy 'at' h:mm a")}
        </p>
      </main>
    </div>
  );
};

/* ---- Item Card with inline delete + per-item photos ---- */
function ItemCard({
  item,
  leadId,
  isConverted,
  confirmingDeleteId,
  onConfirmDelete,
  onDelete,
  deleteIsPending,
}: {
  item: any;
  leadId: string;
  isConverted: boolean;
  confirmingDeleteId: string | null;
  onConfirmDelete: (id: string | null) => void;
  onDelete: (id: string) => void;
  deleteIsPending: boolean;
}) {
  const { photos: itemPhotos, upload, remove } = useLeadItemPhotos(leadId, item.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const tierBadge: Record<string, string> = {
    standard: "bg-muted text-muted-foreground",
    luxury: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    ultra_luxury: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  };
  const tierLabel: Record<string, string> = { standard: "Standard", luxury: "Luxury", ultra_luxury: "Ultra-Luxury" };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      upload.mutate(files, {
        onSuccess: () => toast.success("Photos uploaded"),
        onError: () => toast.error("Photo upload failed"),
      });
    }
    e.target.value = "";
  };

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-foreground">{item.service_categories?.name || "Item"}</p>
          {item.brands?.name && (
            <>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="text-xs font-medium text-foreground">{item.brands.name}</span>
              <Badge className={`text-[9px] ${tierBadge[item.brands?.tier] || ""}`}>{tierLabel[item.brands?.tier] || item.brands?.tier}</Badge>
            </>
          )}
          <Badge variant="outline" className="text-[9px]">{item.service_type || "restoration"}</Badge>
          {item.description && <span className="text-[10px] text-muted-foreground italic">— {item.description}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">₹{Number(item.manual_price || 0).toLocaleString()}</span>
          {!isConverted && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onConfirmDelete(item.id)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      {/* Inline delete confirmation */}
      {confirmingDeleteId === item.id && (
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <p className="text-xs text-muted-foreground flex-1">Remove this item?</p>
          <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={() => onDelete(item.id)} disabled={deleteIsPending}>
            {deleteIsPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => onConfirmDelete(null)}>Cancel</Button>
        </div>
      )}

      {/* Per-item photos */}
      {!isConverted && (
        <div className="flex items-center gap-2 flex-wrap">
          {itemPhotos.map((p) => (
            <div key={p.id} className="group relative h-12 w-12 rounded border border-border overflow-hidden">
              <PhotoThumb url={p.url} fileName={p.fileName} />
              <button
                onClick={() => remove.mutate({ id: p.id, storagePath: p.storagePath })}
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handlePhotoUpload} />
          <button
            onClick={() => fileRef.current?.click()}
            className="h-12 w-12 rounded border border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary/40 transition-colors"
          >
            {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  );
}

const InfoCard = ({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) => (
  <div className="rounded-[var(--radius)] border border-border bg-card p-3">
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
    <p className="mt-1 text-sm font-semibold text-card-foreground">{value}</p>
  </div>
);

export default LeadDetail;
