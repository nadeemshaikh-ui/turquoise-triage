import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Hammer, Package } from "lucide-react";
import { useSystemToggles } from "@/hooks/useSystemToggles";
import { toast } from "@/hooks/use-toast";

const SystemTab = () => {
  const { workshopEnabled, inventoryEnabled, isLoading, updateToggle } = useSystemToggles();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const handleToggle = (key: string, value: boolean, label: string) => {
    updateToggle.mutate(
      { key, value },
      {
        onSuccess: () => toast({ title: `${label} ${value ? "enabled" : "disabled"}` }),
        onError: () => toast({ title: "Failed to update setting", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-4 pt-2">
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Hammer className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">Workshop Tracking Mode</CardTitle>
          </div>
          <CardDescription className="text-xs">
            When OFF, the Workshop and Inventory links are hidden. The app functions as a simple CRM.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              checked={workshopEnabled}
              onCheckedChange={(v) => handleToggle("workshop_tracking_enabled", v, "Workshop Tracking")}
              disabled={updateToggle.isPending}
            />
            <Label className="text-sm">{workshopEnabled ? "Enabled" : "Disabled"}</Label>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">Inventory Automation</CardTitle>
          </div>
          <CardDescription className="text-xs">
            When OFF, stock deductions are skipped when items move to "Ready for Pickup".
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              checked={inventoryEnabled}
              onCheckedChange={(v) => handleToggle("inventory_automation_enabled", v, "Inventory Automation")}
              disabled={updateToggle.isPending || !workshopEnabled}
            />
            <Label className="text-sm">
              {!workshopEnabled ? "Requires Workshop Mode" : inventoryEnabled ? "Enabled" : "Disabled"}
            </Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemTab;
