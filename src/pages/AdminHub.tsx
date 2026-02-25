import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import BrandsTab from "@/components/admin/BrandsTab";
import CampaignsTab from "@/components/admin/CampaignsTab";

const ICON_OPTIONS = [
  "Footprints", "ShoppingBag", "Shirt", "Sparkles", "Wrench", "Palette",
  "Crown", "Gem", "Star", "Scissors", "Watch", "Briefcase",
];

type Category = { id: string; name: string; icon_name: string; sort_order: number; is_active: boolean };
type Issue = { id: string; category_id: string; name: string; suggestive_price: number; description: string | null; sort_order: number; is_active: boolean };
type Package = { id: string; category_id: string; name: string; suggestive_price: number; includes: string[]; description: string | null; sort_order: number; is_active: boolean };

const AdminHub = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [catDialog, setCatDialog] = useState<{ open: boolean; editing: Category | null }>({ open: false, editing: null });
  const [issueDialog, setIssueDialog] = useState<{ open: boolean; editing: Issue | null }>({ open: false, editing: null });
  const [pkgDialog, setPkgDialog] = useState<{ open: boolean; editing: Package | null }>({ open: false, editing: null });

  const fetchAll = async () => {
    setLoading(true);
    const [catRes, issRes, pkgRes] = await Promise.all([
      supabase.from("service_categories").select("*").order("sort_order"),
      supabase.from("category_issues").select("*").order("sort_order"),
      supabase.from("category_packages").select("*").order("sort_order"),
    ]);
    setCategories((catRes.data as any[]) || []);
    setIssues((issRes.data as any[]) || []);
    setPackages((pkgRes.data as any[]) || []);
    if (!selectedCatId && catRes.data?.length) setSelectedCatId(catRes.data[0].id);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filteredIssues = issues.filter((i) => i.category_id === selectedCatId);
  const filteredPackages = packages.filter((p) => p.category_id === selectedCatId);

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Admin Hub</h1>
        <p className="text-sm text-muted-foreground">Manage categories, issues, packages, brands & campaigns</p>
      </div>

      <Tabs defaultValue="categories">
        <TabsList className="flex-wrap">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="packages">Packages</TabsTrigger>
          <TabsTrigger value="brands">Brands</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>

        {/* CATEGORIES TAB */}
        <TabsContent value="categories" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setCatDialog({ open: true, editing: null })}><Plus className="h-4 w-4 mr-1" />Add Category</Button>
          </div>
          <div className="grid gap-2">
            {categories.map((c) => (
              <Card key={c.id} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">{c.icon_name}</Badge>
                  <span className="font-medium text-sm text-foreground">{c.name}</span>
                  <span className="text-xs text-muted-foreground">Order: {c.sort_order}</span>
                  {!c.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCatDialog({ open: true, editing: c })}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => {
                    await supabase.from("service_categories").delete().eq("id", c.id);
                    fetchAll();
                    toast({ title: "Category deleted" });
                  }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ISSUES TAB */}
        <TabsContent value="issues" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Select value={selectedCatId || ""} onValueChange={setSelectedCatId}>
              <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" onClick={() => setIssueDialog({ open: true, editing: null })} disabled={!selectedCatId}><Plus className="h-4 w-4 mr-1" />Add Issue</Button>
          </div>
          <div className="grid gap-2">
            {filteredIssues.map((i) => (
              <Card key={i.id} className="flex items-center justify-between p-3">
                <div>
                  <span className="font-medium text-sm text-foreground">{i.name}</span>
                  <span className="ml-2 text-xs text-primary font-semibold">₹{i.suggestive_price}</span>
                  {i.description && <p className="text-xs text-muted-foreground">{i.description}</p>}
                  {!i.is_active && <Badge variant="secondary" className="text-[10px] ml-2">Inactive</Badge>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIssueDialog({ open: true, editing: i })}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => {
                    await supabase.from("category_issues").delete().eq("id", i.id);
                    fetchAll();
                    toast({ title: "Issue deleted" });
                  }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </Card>
            ))}
            {filteredIssues.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No issues for this category yet.</p>}
          </div>
        </TabsContent>

        {/* PACKAGES TAB */}
        <TabsContent value="packages" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Select value={selectedCatId || ""} onValueChange={setSelectedCatId}>
              <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" onClick={() => setPkgDialog({ open: true, editing: null })} disabled={!selectedCatId}><Plus className="h-4 w-4 mr-1" />Add Package</Button>
          </div>
          <div className="grid gap-2">
            {filteredPackages.map((p) => (
              <Card key={p.id} className="flex items-center justify-between p-3">
                <div>
                  <span className="font-medium text-sm text-foreground">{p.name}</span>
                  <span className="ml-2 text-xs text-primary font-semibold">₹{p.suggestive_price}</span>
                  {p.includes.length > 0 && <p className="text-xs text-muted-foreground">Includes: {p.includes.join(", ")}</p>}
                  {!p.is_active && <Badge variant="secondary" className="text-[10px] ml-2">Inactive</Badge>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPkgDialog({ open: true, editing: p })}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => {
                    await supabase.from("category_packages").delete().eq("id", p.id);
                    fetchAll();
                    toast({ title: "Package deleted" });
                  }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </Card>
            ))}
            {filteredPackages.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No packages for this category yet.</p>}
          </div>
        </TabsContent>

        {/* BRANDS TAB */}
        <TabsContent value="brands">
          <BrandsTab categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
        </TabsContent>

        {/* CAMPAIGNS TAB */}
        <TabsContent value="campaigns">
          <CampaignsTab />
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <CategoryDialog open={catDialog.open} editing={catDialog.editing} onClose={() => setCatDialog({ open: false, editing: null })} onSaved={fetchAll} />
      <IssueDialog open={issueDialog.open} editing={issueDialog.editing} categoryId={selectedCatId} onClose={() => setIssueDialog({ open: false, editing: null })} onSaved={fetchAll} />
      <PackageDialog open={pkgDialog.open} editing={pkgDialog.editing} categoryId={selectedCatId} onClose={() => setPkgDialog({ open: false, editing: null })} onSaved={fetchAll} />
    </div>
  );
};

/* ---- Category Dialog ---- */
function CategoryDialog({ open, editing, onClose, onSaved }: { open: boolean; editing: Category | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [iconName, setIconName] = useState("Sparkles");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) { setName(editing.name); setIconName(editing.icon_name); setSortOrder(editing.sort_order); setIsActive(editing.is_active); }
    else { setName(""); setIconName("Sparkles"); setSortOrder(0); setIsActive(true); }
  }, [editing, open]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    if (editing) {
      await supabase.from("service_categories").update({ name: name.trim(), icon_name: iconName, sort_order: sortOrder, is_active: isActive }).eq("id", editing.id);
    } else {
      await supabase.from("service_categories").insert({ name: name.trim(), icon_name: iconName, sort_order: sortOrder, is_active: isActive });
    }
    setSaving(false);
    onSaved();
    onClose();
    toast({ title: editing ? "Category updated" : "Category created" });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Category</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label className="text-xs">Icon</Label>
            <Select value={iconName} onValueChange={setIconName}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ICON_OPTIONS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Sort Order</Label><Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} /></div>
          <div className="flex items-center gap-2"><Switch checked={isActive} onCheckedChange={setIsActive} /><Label className="text-xs">Active</Label></div>
          <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Issue Dialog ---- */
function IssueDialog({ open, editing, categoryId, onClose, onSaved }: { open: boolean; editing: Issue | null; categoryId: string | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [desc, setDesc] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) { setName(editing.name); setPrice(editing.suggestive_price); setDesc(editing.description || ""); setSortOrder(editing.sort_order); setIsActive(editing.is_active); }
    else { setName(""); setPrice(0); setDesc(""); setSortOrder(0); setIsActive(true); }
  }, [editing, open]);

  const handleSave = async () => {
    if (!name.trim() || !categoryId) return;
    setSaving(true);
    const payload = { name: name.trim(), suggestive_price: price, description: desc || null, sort_order: sortOrder, is_active: isActive, category_id: categoryId };
    if (editing) {
      await supabase.from("category_issues").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("category_issues").insert(payload);
    }
    setSaving(false);
    onSaved();
    onClose();
    toast({ title: editing ? "Issue updated" : "Issue created" });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Issue</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label className="text-xs">Suggestive Price (₹)</Label><Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} /></div>
          <div><Label className="text-xs">Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div><Label className="text-xs">Sort Order</Label><Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} /></div>
          <div className="flex items-center gap-2"><Switch checked={isActive} onCheckedChange={setIsActive} /><Label className="text-xs">Active</Label></div>
          <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Package Dialog ---- */
function PackageDialog({ open, editing, categoryId, onClose, onSaved }: { open: boolean; editing: Package | null; categoryId: string | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [includes, setIncludes] = useState("");
  const [desc, setDesc] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) { setName(editing.name); setPrice(editing.suggestive_price); setIncludes(editing.includes.join(", ")); setDesc(editing.description || ""); setSortOrder(editing.sort_order); setIsActive(editing.is_active); }
    else { setName(""); setPrice(0); setIncludes(""); setDesc(""); setSortOrder(0); setIsActive(true); }
  }, [editing, open]);

  const handleSave = async () => {
    if (!name.trim() || !categoryId) return;
    setSaving(true);
    const includesArr = includes.split(",").map((s) => s.trim()).filter(Boolean);
    const payload = { name: name.trim(), suggestive_price: price, includes: includesArr, description: desc || null, sort_order: sortOrder, is_active: isActive, category_id: categoryId };
    if (editing) {
      await supabase.from("category_packages").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("category_packages").insert(payload);
    }
    setSaving(false);
    onSaved();
    onClose();
    toast({ title: editing ? "Package updated" : "Package created" });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Package</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label className="text-xs">Suggestive Price (₹)</Label><Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} /></div>
          <div><Label className="text-xs">Includes (comma-separated)</Label><Input value={includes} onChange={(e) => setIncludes(e.target.value)} placeholder="Deep Clean, Color Restore, Polish" /></div>
          <div><Label className="text-xs">Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div><Label className="text-xs">Sort Order</Label><Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} /></div>
          <div className="flex items-center gap-2"><Switch checked={isActive} onCheckedChange={setIsActive} /><Label className="text-xs">Active</Label></div>
          <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AdminHub;
