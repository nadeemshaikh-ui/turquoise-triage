import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Package, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock_level: number;
  unit: string;
  min_stock_level: number;
  cost_per_unit: number;
}

const CATEGORIES = ["Chemicals", "Glue", "TPR Sheets", "Sanding Discs", "Dyes", "Hardware"];

const Inventory = () => {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("category")
        .order("name");
      if (error) throw error;
      return data as InventoryItem[];
    },
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("inventory-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items" }, () => {
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const filtered = activeCategory ? items.filter((i) => i.category === activeCategory) : items;
  const categories = [...new Set(items.map((i) => i.category))];

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">Inventory</h1>
        <Button className="rounded-[28px] gap-2" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" /> Add Material
        </Button>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={activeCategory === null ? "default" : "outline"}
          className="cursor-pointer px-3 py-1.5 text-xs"
          onClick={() => setActiveCategory(null)}
        >
          All ({items.length})
        </Badge>
        {categories.map((cat) => (
          <Badge
            key={cat}
            variant={activeCategory === cat ? "default" : "outline"}
            className="cursor-pointer px-3 py-1.5 text-xs"
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </Badge>
        ))}
      </div>

      {/* Items grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => {
          const isLow = item.stock_level <= item.min_stock_level && item.min_stock_level > 0;
          return (
            <button
              key={item.id}
              onClick={() => setEditItem(item)}
              className="flex items-start gap-3 rounded-[28px] border border-border bg-card p-4 text-left shadow-[0_2px_12px_-4px_hsl(174_72%_56%/0.10)] transition-all hover:border-primary/30 hover:shadow-[0_4px_20px_-4px_hsl(174_72%_56%/0.18)]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-card-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.category}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-lg font-bold text-primary">
                    {item.stock_level} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span>
                  </span>
                  {isLow && (
                    <Badge variant="destructive" className="gap-1 text-[10px]">
                      <AlertTriangle className="h-3 w-3" /> Low
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <InventoryDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        item={null}
      />
      <InventoryDialog
        open={!!editItem}
        onOpenChange={(open) => !open && setEditItem(null)}
        item={editItem}
      />
    </div>
  );
};

const InventoryDialog = ({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | null;
}) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Chemicals");
  const [stockLevel, setStockLevel] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [minStock, setMinStock] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategory(item.category);
      setStockLevel(String(item.stock_level));
      setUnit(item.unit);
      setMinStock(String(item.min_stock_level));
      setCostPerUnit(String(item.cost_per_unit));
    } else {
      setName("");
      setCategory("Chemicals");
      setStockLevel("");
      setUnit("pcs");
      setMinStock("0");
      setCostPerUnit("0");
    }
  }, [item, open]);

  const handleSave = async () => {
    if (!name.trim() || !stockLevel) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        stock_level: Number(stockLevel),
        unit,
        min_stock_level: Number(minStock) || 0,
        cost_per_unit: Number(costPerUnit) || 0,
      };
      if (item) {
        const { error } = await supabase.from("inventory_items").update(payload).eq("id", item.id);
        if (error) throw error;
        toast({ title: "Item updated" });
      } else {
        const { error } = await supabase.from("inventory_items").insert(payload);
        if (error) throw error;
        toast({ title: "Item added" });
      }
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Item" : "Add Inventory Item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Leather Cleaner" />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ml">ml</SelectItem>
                  <SelectItem value="pcs">pcs</SelectItem>
                  <SelectItem value="g">g</SelectItem>
                  <SelectItem value="sheets">sheets</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Stock Level</Label>
              <Input type="number" value={stockLevel} onChange={(e) => setStockLevel(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Min Stock Alert</Label>
              <Input type="number" value={minStock} onChange={(e) => setMinStock(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Cost/Unit (₹)</Label>
              <Input type="number" value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)} placeholder="0" />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full rounded-[28px]">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {item ? "Update" : "Add Item"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Inventory;
