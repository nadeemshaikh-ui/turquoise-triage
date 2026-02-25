import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Brand = { id: string; name: string; tier: string; is_active: boolean; sort_order: number };
type Category = { id: string; name: string };
type BrandTag = { id: string; brand_id: string; category_id: string };

const TIER_BADGE: Record<string, string> = {
  standard: "bg-muted text-muted-foreground",
  luxury: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  ultra_luxury: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

const TIER_LABEL: Record<string, string> = {
  standard: "Standard",
  luxury: "Luxury",
  ultra_luxury: "Ultra-Luxury",
};

type Props = { categories: Category[] };

const BrandsTab = ({ categories }: Props) => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [tags, setTags] = useState<BrandTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; editing: Brand | null }>({ open: false, editing: null });

  const fetchBrands = async () => {
    setLoading(true);
    const [bRes, tRes] = await Promise.all([
      supabase.from("brands").select("*").order("sort_order"),
      supabase.from("brand_category_tags").select("*"),
    ]);
    setBrands((bRes.data as any[]) || []);
    setTags((tRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchBrands(); }, []);

  const getBrandTags = (brandId: string) =>
    tags.filter((t) => t.brand_id === brandId).map((t) => categories.find((c) => c.id === t.category_id)?.name).filter(Boolean);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialog({ open: true, editing: null })}><Plus className="h-4 w-4 mr-1" />Add Brand</Button>
      </div>
      <div className="grid gap-2">
        {brands.map((b) => (
          <Card key={b.id} className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-foreground">{b.name}</span>
              <Badge className={`text-[10px] ${TIER_BADGE[b.tier] || ""}`}>{TIER_LABEL[b.tier] || b.tier}</Badge>
              {getBrandTags(b.id).map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
              ))}
              {!b.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDialog({ open: true, editing: b })}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => {
                await supabase.from("brands").delete().eq("id", b.id);
                fetchBrands();
                toast({ title: "Brand deleted" });
              }}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </Card>
        ))}
      </div>
      <BrandDialog open={dialog.open} editing={dialog.editing} categories={categories} existingTags={tags} onClose={() => setDialog({ open: false, editing: null })} onSaved={fetchBrands} />
    </div>
  );
};

function BrandDialog({ open, editing, categories, existingTags, onClose, onSaved }: {
  open: boolean; editing: Brand | null; categories: Category[]; existingTags: BrandTag[]; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [tier, setTier] = useState("standard");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name); setTier(editing.tier); setSortOrder(editing.sort_order); setIsActive(editing.is_active);
      setSelectedCats(existingTags.filter((t) => t.brand_id === editing.id).map((t) => t.category_id));
    } else {
      setName(""); setTier("standard"); setSortOrder(0); setIsActive(true); setSelectedCats([]);
    }
  }, [editing, open]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    let brandId = editing?.id;
    if (editing) {
      await supabase.from("brands").update({ name: name.trim(), tier, sort_order: sortOrder, is_active: isActive }).eq("id", editing.id);
    } else {
      const { data } = await supabase.from("brands").insert({ name: name.trim(), tier, sort_order: sortOrder, is_active: isActive }).select("id").single();
      brandId = data?.id;
    }
    if (brandId) {
      await supabase.from("brand_category_tags").delete().eq("brand_id", brandId);
      if (selectedCats.length > 0) {
        await supabase.from("brand_category_tags").insert(selectedCats.map((cid) => ({ brand_id: brandId!, category_id: cid })));
      }
    }
    setSaving(false);
    onSaved();
    onClose();
    toast({ title: editing ? "Brand updated" : "Brand created" });
  };

  const toggleCat = (catId: string) => {
    setSelectedCats((prev) => prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Brand</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label className="text-xs">Tier</Label>
            <Select value={tier} onValueChange={setTier}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="luxury">Luxury</SelectItem>
                <SelectItem value="ultra_luxury">Ultra-Luxury</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Sort Order</Label><Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} /></div>
          <div className="flex items-center gap-2"><Switch checked={isActive} onCheckedChange={setIsActive} /><Label className="text-xs">Active</Label></div>
          <div>
            <Label className="text-xs">Category Tags</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={selectedCats.includes(c.id)} onCheckedChange={() => toggleCat(c.id)} />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BrandsTab;
