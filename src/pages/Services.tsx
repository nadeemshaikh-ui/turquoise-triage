import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Sparkles, Wrench, Paintbrush, ShoppingBag } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";

interface ServiceRow {
  id: string;
  name: string;
  category: string;
  default_price: number | null;
  price_range_min: number | null;
  price_range_max: number | null;
  default_tat_min: number;
  default_tat_max: number;
  requires_photos: boolean;
  is_active: boolean;
}

const CATEGORIES = ["Cleaning", "Repair & Structural", "Restoration & Color", "Luxury Bags", "Custom"];

const categoryIcons: Record<string, React.ReactNode> = {
  Cleaning: <Sparkles className="h-4 w-4" />,
  "Repair & Structural": <Wrench className="h-4 w-4" />,
  "Restoration & Color": <Paintbrush className="h-4 w-4" />,
  "Luxury Bags": <ShoppingBag className="h-4 w-4" />,
};

const Services = () => {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editService, setEditService] = useState<ServiceRow | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Redirect non-admins
  useEffect(() => {
    if (!roleLoading && !isAdmin) navigate("/");
  }, [isAdmin, roleLoading, navigate]);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("category")
        .order("name");
      if (error) throw error;
      return data as ServiceRow[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services-admin"] });
      toast({ title: "Service deleted" });
    },
  });

  const filtered = activeCategory ? services.filter((s) => s.category === activeCategory) : services;
  const categories = [...new Set(services.map((s) => s.category))];

  if (isLoading || roleLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">Services Catalog</h1>
        <Button className="rounded-[28px] gap-2" onClick={() => { setEditService(null); setShowDialog(true); }}>
          <Plus className="h-4 w-4" /> Add Service
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge
          variant={activeCategory === null ? "default" : "outline"}
          className="cursor-pointer px-3 py-1.5 text-xs"
          onClick={() => setActiveCategory(null)}
        >
          All ({services.length})
        </Badge>
        {categories.map((cat) => (
          <Badge
            key={cat}
            variant={activeCategory === cat ? "default" : "outline"}
            className="cursor-pointer gap-1.5 px-3 py-1.5 text-xs"
            onClick={() => setActiveCategory(cat)}
          >
            {categoryIcons[cat]} {cat}
          </Badge>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((svc) => (
          <div
            key={svc.id}
            className="flex items-center gap-4 rounded-[28px] border border-border bg-card p-4 shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-card-foreground">{svc.name}</p>
                {!svc.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                {svc.requires_photos && <Badge variant="outline" className="text-[10px]">📷</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{svc.category}</p>
              <div className="mt-1 flex items-center gap-3 text-sm">
                <span className="font-medium text-primary">
                  {svc.price_range_min && svc.price_range_max
                    ? `₹${svc.price_range_min}–₹${svc.price_range_max}`
                    : svc.default_price
                      ? `₹${svc.default_price}`
                      : "Quote"}
                </span>
                <span className="text-muted-foreground">TAT: {svc.default_tat_min}–{svc.default_tat_max}d</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => { setEditService(svc); setShowDialog(true); }}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(svc.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <ServiceDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        service={editService}
      />
    </div>
  );
};

const ServiceDialog = ({
  open,
  onOpenChange,
  service,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ServiceRow | null;
}) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Cleaning");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [tatMin, setTatMin] = useState("4");
  const [tatMax, setTatMax] = useState("5");
  const [requiresPhotos, setRequiresPhotos] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (service) {
      setName(service.name);
      setCategory(service.category);
      setDefaultPrice(service.default_price ? String(service.default_price) : "");
      setPriceMin(service.price_range_min ? String(service.price_range_min) : "");
      setPriceMax(service.price_range_max ? String(service.price_range_max) : "");
      setTatMin(String(service.default_tat_min));
      setTatMax(String(service.default_tat_max));
      setRequiresPhotos(service.requires_photos);
      setIsActive(service.is_active);
    } else {
      setName(""); setCategory("Cleaning"); setDefaultPrice(""); setPriceMin(""); setPriceMax("");
      setTatMin("4"); setTatMax("5"); setRequiresPhotos(false); setIsActive(true);
    }
  }, [service, open]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        default_price: defaultPrice ? Number(defaultPrice) : null,
        price_range_min: priceMin ? Number(priceMin) : null,
        price_range_max: priceMax ? Number(priceMax) : null,
        default_tat_min: Number(tatMin),
        default_tat_max: Number(tatMax),
        requires_photos: requiresPhotos,
        is_active: isActive,
      };
      if (service) {
        const { error } = await supabase.from("services").update(payload).eq("id", service.id);
        if (error) throw error;
        toast({ title: "Service updated" });
      } else {
        const { error } = await supabase.from("services").insert(payload);
        if (error) throw error;
        toast({ title: "Service added" });
      }
      queryClient.invalidateQueries({ queryKey: ["services-admin"] });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{service ? "Edit Service" : "Add Service"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Service Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Deep Clean" />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Default Price (₹)</Label>
            <Input type="number" value={defaultPrice} onChange={(e) => setDefaultPrice(e.target.value)} placeholder="Fixed price" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Price Range Min</Label>
              <Input type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Price Range Max</Label>
              <Input type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>TAT Min (days)</Label>
              <Input type="number" value={tatMin} onChange={(e) => setTatMin(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>TAT Max (days)</Label>
              <Input type="number" value={tatMax} onChange={(e) => setTatMax(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>Requires Photos</Label>
            <Switch checked={requiresPhotos} onCheckedChange={setRequiresPhotos} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full rounded-[28px]">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {service ? "Update Service" : "Add Service"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Services;
