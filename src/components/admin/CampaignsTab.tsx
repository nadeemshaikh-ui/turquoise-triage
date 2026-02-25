import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Campaign = { id: string; name: string; is_active: boolean; sort_order: number };

const CampaignsTab = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; editing: Campaign | null }>({ open: false, editing: null });

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data } = await supabase.from("marketing_campaigns").select("*").order("sort_order");
    setCampaigns((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchCampaigns(); }, []);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialog({ open: true, editing: null })}><Plus className="h-4 w-4 mr-1" />Add Campaign</Button>
      </div>
      <div className="grid gap-2">
        {campaigns.map((c) => (
          <Card key={c.id} className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-foreground">{c.name}</span>
              <span className="text-xs text-muted-foreground">Order: {c.sort_order}</span>
              {!c.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDialog({ open: true, editing: c })}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => {
                await supabase.from("marketing_campaigns").delete().eq("id", c.id);
                fetchCampaigns();
                toast({ title: "Campaign deleted" });
              }}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </Card>
        ))}
      </div>
      <CampaignDialog open={dialog.open} editing={dialog.editing} onClose={() => setDialog({ open: false, editing: null })} onSaved={fetchCampaigns} />
    </div>
  );
};

function CampaignDialog({ open, editing, onClose, onSaved }: {
  open: boolean; editing: Campaign | null; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) { setName(editing.name); setSortOrder(editing.sort_order); setIsActive(editing.is_active); }
    else { setName(""); setSortOrder(0); setIsActive(true); }
  }, [editing, open]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    if (editing) {
      await supabase.from("marketing_campaigns").update({ name: name.trim(), sort_order: sortOrder, is_active: isActive }).eq("id", editing.id);
    } else {
      await supabase.from("marketing_campaigns").insert({ name: name.trim(), sort_order: sortOrder, is_active: isActive });
    }
    setSaving(false);
    onSaved();
    onClose();
    toast({ title: editing ? "Campaign updated" : "Campaign created" });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Campaign</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label className="text-xs">Sort Order</Label><Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} /></div>
          <div className="flex items-center gap-2"><Switch checked={isActive} onCheckedChange={setIsActive} /><Label className="text-xs">Active</Label></div>
          <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CampaignsTab;
