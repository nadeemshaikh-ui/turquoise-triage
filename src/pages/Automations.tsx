import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, MessageSquare, Zap, Eye, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const Automations = () => {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load existing settings
  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const interaktKey = (settings as any[]).find((s) => s.key === "interakt_api_key")?.value || "";
  const whatsappEnabled = (settings as any[]).find((s) => s.key === "whatsapp_auto_enabled")?.value === "true";

  const saveSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      // Upsert setting
      const existing = (settings as any[]).find((s) => s.key === key);
      if (existing) {
        const { error } = await supabase.from("app_settings").update({ value }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("app_settings").insert({ key, value });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
  });

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      await saveSetting.mutateAsync({ key: "interakt_api_key", value: apiKey.trim() });
      toast({ title: "✅ Interakt API Key saved" });
      setApiKey("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleWhatsApp = async (enabled: boolean) => {
    await saveSetting.mutateAsync({ key: "whatsapp_auto_enabled", value: String(enabled) });
    toast({
      title: enabled ? "✅ WhatsApp auto-text enabled" : "WhatsApp auto-text disabled",
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-foreground">Automations</h1>

      {/* Interakt WhatsApp Card */}
      <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(16_100%_50%/0.10)]">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm font-semibold">Interakt WhatsApp Gateway</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Connect your Interakt account to automatically send WhatsApp messages when orders are ready for pickup.
          </p>

          {/* API Key */}
          <div className="space-y-2">
            <Label className="text-xs">API Key</Label>
            {interaktKey ? (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Zap className="h-3 w-3" /> Connected
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {showKey ? interaktKey : "••••••••" + interaktKey.slice(-4)}
                </span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowKey(!showKey)}>
                  {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              </div>
            ) : null}
            <div className="flex gap-2">
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={interaktKey ? "Enter new key to update..." : "Paste your Interakt API Key"}
                className="text-sm"
              />
              <Button
                onClick={handleSaveApiKey}
                disabled={saving || !apiKey.trim()}
                className="rounded-[28px] shrink-0"
                size="sm"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>

          {/* Auto-trigger toggle */}
          <div className="flex items-center justify-between rounded-2xl border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Auto-Text on "Ready for Pickup"</p>
              <p className="text-xs text-muted-foreground">
                Sends template message to customer's WhatsApp when their order is ready
              </p>
            </div>
            <Switch
              checked={whatsappEnabled}
              onCheckedChange={toggleWhatsApp}
              disabled={!interaktKey}
            />
          </div>

          {!interaktKey && (
            <p className="text-xs text-muted-foreground italic">
              Save your API key first to enable auto-messaging.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Labor Cost Setting */}
      <Card className="rounded-[28px] shadow-[0_2px_12px_-4px_hsl(16_100%_50%/0.10)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Finance Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <LaborCostSetting settings={settings as any[]} onSave={saveSetting.mutateAsync} />
        </CardContent>
      </Card>
    </div>
  );
};

const LaborCostSetting = ({
  settings,
  onSave,
}: {
  settings: any[];
  onSave: (args: { key: string; value: string }) => Promise<void>;
}) => {
  const currentValue = settings.find((s) => s.key === "artisan_labor_per_order")?.value || "150";
  const [value, setValue] = useState(currentValue);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ key: "artisan_labor_per_order", value });
      toast({ title: "✅ Labor cost updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">Artisan Labor Cost (₹ per order)</Label>
      <div className="flex gap-2">
        <Input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="max-w-[140px]"
        />
        <Button
          onClick={handleSave}
          disabled={saving || value === currentValue}
          className="rounded-[28px]"
          size="sm"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Update"}
        </Button>
      </div>
    </div>
  );
};

export default Automations;
