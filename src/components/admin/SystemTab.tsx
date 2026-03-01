import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Hammer, Package, AlertTriangle } from "lucide-react";
import { useSystemToggles } from "@/hooks/useSystemToggles";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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


      <DangerZoneReset />
    </div>
  );
};

function DangerZoneReset() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [resetting, setResetting] = useState(false);
  const queryClient = useQueryClient();

  const isValid = password === "RESTOREE_RESET_360" && confirm === "DELETE";

  const handleReset = async () => {
    if (!isValid) return;
    setResetting(true);
    const { error } = await supabase.rpc("reset_test_data");
    setResetting(false);
    if (error) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Database Reset Successful" });
      queryClient.invalidateQueries();
      setOpen(false);
      setPassword("");
      setConfirm("");
    }
  };

  return (
    <>
      <Card className="rounded-2xl border-destructive/30">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-sm text-destructive">Danger Zone</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Permanently delete all test leads, orders, invoices, and related transactional data. Master data (customers, brands, packages, pricing) is preserved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setOpen(true)}>
            Reset All Test Data
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); setPassword(""); setConfirm(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Confirm Data Reset
            </DialogTitle>
            <DialogDescription>
              This will permanently delete ALL leads, orders, invoices, photos, ratings, and disputes. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-medium">Enter password</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter reset password"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Type DELETE to confirm</Label>
              <Input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="DELETE"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setPassword(""); setConfirm(""); }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReset} disabled={!isValid || resetting}>
              {resetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reset All Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SystemTab;
