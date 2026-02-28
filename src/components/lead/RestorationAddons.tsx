import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface RestorationAddonsProps {
  leadItemId: string;
  categoryName: string;
}

const RestorationAddons = ({ leadItemId, categoryName }: RestorationAddonsProps) => {
  const queryClient = useQueryClient();

  // Fetch available addons for this category
  const { data: availableAddons = [] } = useQuery({
    queryKey: ["pricing-addons", categoryName],
    queryFn: async () => {
      const { data } = await supabase
        .from("pricing_addons_master")
        .select("id, price, addon_id, addons_master(id, name)")
        .ilike("category", categoryName)
        .eq("is_active", true);
      return (data || []).map((r: any) => ({
        pricingId: r.id,
        addonId: r.addon_id,
        name: r.addons_master?.name || "Unknown",
        price: Number(r.price),
      }));
    },
    enabled: !!categoryName,
  });

  // Fetch selected addons for this lead item
  const { data: selectedAddons = [] } = useQuery({
    queryKey: ["lead-item-addons", leadItemId],
    queryFn: async () => {
      const { data } = await supabase
        .from("lead_item_addons")
        .select("id, addon_id, price_at_time")
        .eq("lead_item_id", leadItemId);
      return (data || []).map((r: any) => ({
        id: r.id,
        addonId: r.addon_id,
        priceAtTime: Number(r.price_at_time),
      }));
    },
    enabled: !!leadItemId,
  });

  const toggleAddon = useMutation({
    mutationFn: async ({ addonId, price }: { addonId: string; price: number }) => {
      const existing = selectedAddons.find((s) => s.addonId === addonId);
      if (existing) {
        await supabase.from("lead_item_addons").delete().eq("id", existing.id);
      } else {
        await supabase.from("lead_item_addons").insert({
          lead_item_id: leadItemId,
          addon_id: addonId,
          price_at_time: price,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-item-addons", leadItemId] });
    },
  });

  if (availableAddons.length === 0) return null;

  const selectedSet = new Set(selectedAddons.map((s) => s.addonId));
  const addonsTotal = selectedAddons.reduce((sum, s) => sum + s.priceAtTime, 0);

  return (
    <div className="space-y-1.5 pt-1 border-t border-border">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Add-ons</p>
      {availableAddons.map((addon) => (
        <label key={addon.addonId} className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={selectedSet.has(addon.addonId)}
            onCheckedChange={() => toggleAddon.mutate({ addonId: addon.addonId, price: addon.price })}
            disabled={toggleAddon.isPending}
          />
          <span className="text-xs text-foreground flex-1">{addon.name}</span>
          <span className="text-xs text-muted-foreground">₹{addon.price.toLocaleString()}</span>
        </label>
      ))}
      {addonsTotal > 0 && (
        <div className="flex justify-end">
          <Badge variant="outline" className="text-[10px]">
            Add-ons: +₹{addonsTotal.toLocaleString()}
          </Badge>
        </div>
      )}
      {toggleAddon.isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
    </div>
  );
};

export default RestorationAddons;
