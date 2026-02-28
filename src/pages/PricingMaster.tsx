import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, IndianRupee } from "lucide-react";
import { toast } from "sonner";

type PricingRule = {
  id: string;
  category: string;
  service_type: string;
  base_price: number;
};

const PricingMaster = () => {
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  // Form state
  const [formCategory, setFormCategory] = useState("");
  const [formServiceType, setFormServiceType] = useState("");
  const [formBasePrice, setFormBasePrice] = useState("");

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["pricing-master"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_pricing_master")
        .select("*")
        .order("category")
        .order("service_type");
      if (error) throw error;
      return (data || []) as PricingRule[];
    },
  });

  const categories = [...new Set(rules.map((r) => r.category))].sort();
  const filtered = categoryFilter === "all" ? rules : rules.filter((r) => r.category === categoryFilter);

  const openAdd = () => {
    setEditingRule(null);
    setFormCategory("");
    setFormServiceType("");
    setFormBasePrice("");
    setDialogOpen(true);
  };

  const openEdit = (rule: PricingRule) => {
    setEditingRule(rule);
    setFormCategory(rule.category);
    setFormServiceType(rule.service_type);
    setFormBasePrice(String(rule.base_price));
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        category: formCategory.trim(),
        service_type: formServiceType.trim().toLowerCase(),
        base_price: Number(formBasePrice),
      };
      if (!payload.category || !payload.service_type || isNaN(payload.base_price) || payload.base_price < 0) {
        throw new Error("Fill all fields with valid values");
      }
      if (editingRule) {
        const { error } = await supabase
          .from("service_pricing_master")
          .update(payload)
          .eq("id", editingRule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("service_pricing_master")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing-master"] });
      setDialogOpen(false);
      toast.success(editingRule ? "Pricing rule updated" : "Pricing rule added");
    },
    onError: (err: any) => toast.error(err.message || "Failed to save"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_pricing_master").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing-master"] });
      setConfirmingDeleteId(null);
      toast.success("Pricing rule deleted");
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <IndianRupee className="h-6 w-6 text-primary" /> Pricing Master
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage service types and base prices per category</p>
        </div>
        <Button onClick={openAdd} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Rule
        </Button>
      </div>

      {/* Category filter */}
      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No pricing rules found.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((rule) => (
            <Card key={rule.id} className="relative">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">{rule.category}</Badge>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rule)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setConfirmingDeleteId(rule.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm font-medium text-foreground capitalize">{rule.service_type}</p>
                <p className="text-lg font-bold text-primary">₹{Number(rule.base_price).toLocaleString("en-IN")}</p>

                {confirmingDeleteId === rule.id && (
                  <div className="flex items-center gap-2 pt-1 border-t border-border mt-2">
                    <p className="text-xs text-muted-foreground flex-1">Remove this rule?</p>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs px-2"
                      onClick={() => deleteMutation.mutate(rule.id)}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs px-2"
                      onClick={() => setConfirmingDeleteId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Pricing Rule" : "Add Pricing Rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Input
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="e.g. Luxury Handbags, Sneakers"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Service Type</Label>
              <Input
                value={formServiceType}
                onChange={(e) => setFormServiceType(e.target.value)}
                placeholder="e.g. restoration, cleaning"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Base Price (Rs.)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formBasePrice}
                onChange={(e) => setFormBasePrice(e.target.value)}
                placeholder="0"
                className="h-9 text-sm"
              />
            </div>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="w-full gap-1.5"
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingRule ? "Update" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PricingMaster;
