import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useSystemToggles = () => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["system-toggles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["workshop_tracking_enabled", "inventory_automation_enabled"]);
      if (error) throw error;
      const map = new Map((data || []).map((r) => [r.key, r.value]));
      return {
        workshopEnabled: map.get("workshop_tracking_enabled") !== "false",
        inventoryEnabled: map.get("inventory_automation_enabled") !== "false",
      };
    },
    staleTime: 30_000,
  });

  const updateToggle = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value: String(value) }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-toggles"] });
    },
  });

  return {
    workshopEnabled: data?.workshopEnabled ?? true,
    inventoryEnabled: data?.inventoryEnabled ?? true,
    isLoading,
    updateToggle,
  };
};
