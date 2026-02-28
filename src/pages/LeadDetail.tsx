import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Crown, Clock, Phone, Mail, Camera, MessageSquare, CheckCircle2, Loader2, Upload, ImagePlus, Trash2, X, Award, ClipboardList, Plus, MapPin, Save, Send, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useLeadDetail } from "@/hooks/useLeadDetail";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const statusColor: Record<string, string> = {
  New: "bg-primary/15 text-primary border-primary/30",
  quoted: "bg-accent text-accent-foreground border-accent",
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

// Category service type filtering
const CATEGORY_SERVICE_TYPES: Record<string, string[]> = {
  Bag: ["restoration", "cleaning", "hardware", "dye", "spa"],
  Shoe: ["restoration", "cleaning", "repair", "spa"],
  Belt: ["restoration", "cleaning", "repair", "dye"],
  Wallet: ["restoration", "cleaning", "repair"],
};

const ALL_SERVICE_TYPES = ["restoration", "cleaning", "repair", "dye", "hardware", "spa"];

// Map DB category names to valid display names
const CATEGORY_NAME_MAP: Record<string, string> = {
  "Luxury Handbags": "Bag",
  "Sneakers": "Shoe",
  "Sneaker": "Shoe",
  "Heels": "Shoe",
  "Bag": "Bag",
  "Shoe": "Shoe",
  "Belt": "Belt",
  "Wallet": "Wallet",
  "Accessories": "Belt", // fallback mapping
  "Leather Jackets": "Bag", // fallback mapping
};

const mapCategoryName = (name: string) => CATEGORY_NAME_MAP[name] || name;

const LeadDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { lead, photos, activity, isLoading, updateStatus, addNote, uploadPhotos, deletePhoto } = useLeadDetail(id!);
  const [note, setNote] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Items form state
  const [newBrandId, setNewBrandId] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newServiceType, setNewServiceType] = useState("");
  const [itemDescription, setItemDescription] = useState("");

  // Add New Brand state
  const [isAddingBrand, setIsAddingBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [brandError, setBrandError] = useState("");

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

  // Map DB categories to valid display names, deduplicate
  const mappedCategories = (categoriesOptions || []).map((c) => ({
    ...c,
    displayName: mapCategoryName(c.name),
  })).filter((c) => ["Bag", "Shoe", "Belt", "Wallet"].includes(c.displayName));

  // Resolve selected category display name for filtering
  const selectedCategoryDisplay = mappedCategories.find((c) => c.id === newCategoryId)?.displayName || "";
  const showDescriptionField = selectedCategoryDisplay === "Belt" || selectedCategoryDisplay === "Wallet";

  // Service type options filtered by selected category
  const serviceTypeOptions = selectedCategoryDisplay
    ? (CATEGORY_SERVICE_TYPES[selectedCategoryDisplay] || ALL_SERVICE_TYPES)
    : ALL_SERVICE_TYPES;

  const addItemMutation = useMutation({
    mutationFn: async () => {
      const insertData: any = {
        lead_id: id!,
        brand_id: newBrandId,
        category_id: newCategoryId,
        service_type: newServiceType,
        sort_order: leadItems?.length || 0,
      };
      if (showDescriptionField && itemDescription.trim()) {
        insertData.description = itemDescription.trim();
      }
      const { error } = await supabase.from("lead_items").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-items", id] });
      setNewBrandId("");
      setNewCategoryId("");
      setNewServiceType("");
      setItemDescription("");
      toast({ title: "Item added" });
    },
    onError: (err: any) => toast({ title: err.message || "Failed to add item", variant: "destructive" }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("lead_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-items", id] });
      toast({ title: "Item removed" });
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
      toast({ title: `Brand "${data.name}" created` });
    },
    onError: () => {
      setBrandError("Could not save brand. Try again.");
    },
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

  // 4-stage workflow
  const hasItems = leadItems && leadItems.length > 0;
  const pincodeValid = /^\d{6}$/.test(pincode);
  const canConvert = hasItems && pincodeValid;
  const isConverted = !!lead.convertedOrderId;
  const isQuoted = lead.status === "quoted";
  const isDraft = lead.status === "New" && !hasItems;
  const isReadyToQuote = lead.status === "New" && hasItems;

  const handleSendToPortal = () => {
    updateStatus.mutate("quoted", {
      onSuccess: () => toast({ title: "Lead sent to customer portal" }),
    });
  };

  const handleAddNote = () => {
    if (!note.trim()) return;
    addNote.mutate(note.trim(), {
      onSuccess: () => {
        setNote("");
        toast({ title: "Note added" });
      },
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    uploadPhotos.mutate(files, {
      onSuccess: () => toast({ title: `${files.length} photo${files.length > 1 ? "s" : ""} uploaded` }),
      onError: () => toast({ title: "Upload failed", variant: "destructive" }),
    });
    e.target.value = "";
  };

  const handleConvertToOrder = async () => {
    if (!lead || !canConvert) return;
    setConverting(true);
    try {
      const { data, error } = await supabase.rpc('convert_lead_to_order', {
        p_lead_id: lead.id,
      });
      if (error) throw error;
      toast({ title: "Order created!" });
      navigate(`/orders/${data}`);
    } catch (err: any) {
      toast({ title: err.message || "Failed to create order", variant: "destructive" });
    } finally {
      setConverting(false);
    }
  };

  const handleSaveLead = async () => {
    if (!addressLine1.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
      toast({ title: "Please fill Address Line 1, City, State, and Pincode", variant: "destructive" });
      return;
    }
    if (!/^\d{6}$/.test(pincode)) {
      toast({ title: "Pincode must be a 6-digit number", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const fullAddress = `${addressLine1.trim()}${addressLine2.trim() ? ', ' + addressLine2.trim() : ''}, ${city.trim()}, ${state.trim()} - ${pincode.trim()}`;
      const { error } = await supabase
        .from("customers")
        .update({
          address: fullAddress,
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
        })
        .eq("id", lead.customerId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      toast({ title: "Lead saved successfully" });
    } catch {
      toast({ title: "Save failed. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const pincodeError = pincode.length > 0 && !/^\d{6}$/.test(pincode);

  // Add item validation helper
  const handleAddItem = () => {
    const missing: string[] = [];
    if (!newBrandId) missing.push("Brand");
    if (!newCategoryId) missing.push("Category");
    if (!newServiceType) missing.push("Service Type");
    if (missing.length > 0) {
      toast({ title: `Please select: ${missing.join(", ")}`, variant: "destructive" });
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
          <InfoCard label="TAT" value={`${lead.tatDaysMin}–${lead.tatDaysMax} days`} icon={<Clock className="h-3.5 w-3.5 text-muted-foreground" />} />
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
              {leadItems.map((item: any) => {
                const tierBadge: Record<string, string> = {
                  standard: "bg-muted text-muted-foreground",
                  luxury: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
                  ultra_luxury: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
                };
                const tierLabel: Record<string, string> = { standard: "Standard", luxury: "Luxury", ultra_luxury: "Ultra-Luxury" };
                const displayCategory = mapCategoryName(item.service_categories?.name || "Item");
                return (
                  <div key={item.id} className="rounded-[var(--radius)] border border-border bg-card p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{displayCategory}</p>
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => deleteItemMutation.mutate(item.id)}
                            disabled={deleteItemMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(!leadItems || leadItems.length === 0) && (
            <p className="text-sm text-muted-foreground">No items yet. Add at least one item below.</p>
          )}

          {/* Add Item Form — hidden when converted */}
          {!isConverted && (
            <div className="rounded-[var(--radius)] border border-dashed border-border bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Add Item</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* Brand dropdown with "+ Add New Brand" */}
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
                      placeholder="Enter new brand name"
                      className="h-9 text-xs flex-1"
                    />
                    <Button
                      size="sm"
                      className="h-9 text-xs px-2"
                      disabled={!newBrandName.trim() || saveBrandMutation.isPending}
                      onClick={() => saveBrandMutation.mutate()}
                    >
                      {saveBrandMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                    </Button>
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground px-1"
                      onClick={() => { setIsAddingBrand(false); setNewBrandName(""); setBrandError(""); }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {brandError && <p className="text-[11px] text-destructive col-span-full">{brandError}</p>}

                {/* Category dropdown — maps DB names to Bag/Shoe/Belt/Wallet */}
                <Select value={newCategoryId} onValueChange={(val) => {
                  setNewCategoryId(val);
                  setNewServiceType("");
                  setItemDescription("");
                }}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {mappedCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Service Type dropdown — filtered by category */}
                <Select value={newServiceType} onValueChange={setNewServiceType}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Service Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTypeOptions.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Belt/Wallet description field */}
              {showDescriptionField && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Specific Item Description</Label>
                  <Input
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    placeholder={selectedCategoryDisplay === "Belt" ? "e.g. Thin leather belt" : "e.g. Bifold wallet"}
                    className="h-9 text-sm"
                  />
                </div>
              )}

              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleAddItem}
                disabled={addItemMutation.isPending}
              >
                {addItemMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add
              </Button>
            </div>
          )}
        </section>

        {/* 4-Stage Workflow Actions */}
        {!isConverted && (
          <section className="space-y-2">
            {/* Stage 2: Ready to Quote → Send to Portal */}
            {isReadyToQuote && (
              <Button
                onClick={handleSendToPortal}
                disabled={updateStatus.isPending}
                className="w-full gap-2"
              >
                {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send to Portal
              </Button>
            )}

            {/* Stage 3: Quoted → Convert to Order */}
            {isQuoted && (
              <div className="space-y-2">
                <div className="rounded-[var(--radius)] border border-border bg-muted/30 p-3 flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-sm text-muted-foreground">Awaiting customer approval via portal</p>
                </div>
                <Button
                  onClick={handleConvertToOrder}
                  disabled={!canConvert || converting}
                  variant="outline"
                  className="w-full gap-2 border-primary/30"
                >
                  {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                  Convert to Order
                </Button>
                {!hasItems && (
                  <p className="text-center text-xs text-amber-600">⚠ Add at least 1 item to convert</p>
                )}
                {!pincodeValid && (
                  <p className="text-center text-xs text-amber-600">⚠ A valid 6-digit Pincode is required to convert</p>
                )}
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-[var(--radius)]"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadPhotos.isPending}
              >
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
                  <button
                    onClick={() => setSelectedPhoto(p.url)}
                    className="h-full w-full"
                  >
                    <img
                      src={p.url}
                      alt={p.fileName}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder.svg";
                      }}
                    />
                  </button>
                  <button
                    onClick={() => deletePhoto.mutate({ id: p.id, storagePath: p.storagePath }, {
                      onSuccess: () => toast({ title: "Photo deleted" }),
                    })}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Photo Lightbox */}
        {selectedPhoto && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <img
              src={selectedPhoto}
              alt="Lead photo"
              className="max-h-[85vh] max-w-full rounded-[var(--radius)] object-contain"
            />
          </div>
        )}

        {/* Add Note */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Add a Note</h2>
          <div className="flex gap-2">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Type a note…"
              className="min-h-[60px] rounded-[calc(var(--radius)/2)]"
            />
            <Button
              onClick={handleAddNote}
              disabled={!note.trim() || addNote.isPending}
              size="icon"
              className="shrink-0 self-end rounded-[var(--radius)]"
            >
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
                    {i < activity.length - 1 && (
                      <div className="absolute left-[13px] top-7 h-full w-px bg-border" />
                    )}
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

        {/* Created date */}
        <p className="text-center text-xs text-muted-foreground">
          Created {format(new Date(lead.createdAt), "MMM d, yyyy 'at' h:mm a")}
        </p>
      </main>
    </div>
  );
};

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
