import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, Loader2, CheckCircle2, AlertTriangle, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const SNEAKER_KEYWORDS = ["sneaker", "footwear", "shoe", "trainer", "kicks"];
const BAG_KEYWORDS = ["bag", "handbag", "purse", "clutch", "tote", "backpack", "wallet", "luggage"];

function sanitizePhone(raw: string): string {
  let phone = raw.replace(/[^0-9]/g, "");
  if (phone.startsWith("91") && phone.length === 12) phone = phone.slice(2);
  if (phone.startsWith("0") && phone.length === 11) phone = phone.slice(1);
  return phone.length === 10 ? phone : "";
}

function detectAffinity(text: string): string[] {
  const lower = text.toLowerCase();
  const affinities: string[] = [];
  if (SNEAKER_KEYWORDS.some((k) => lower.includes(k))) affinities.push("Sneakers");
  if (BAG_KEYWORDS.some((k) => lower.includes(k))) affinities.push("Bags");
  return affinities;
}

type ImportResult = {
  total: number;
  imported: number;
  skipped: number;
  warmLeads: number;
  vips: number;
  errors: string[];
};

const DataMigrationTab = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setImporting(true);
    setProgress(0);
    setResult(null);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) throw new Error("CSV file appears empty");

      // Detect delimiter
      const delimiter = lines[0].includes("\t") ? "\t" : ",";
      const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());

      // Find columns
      const nameIdx = headers.findIndex((h) => h.includes("customer") || h.includes("name") || h === "party name");
      const phoneIdx = headers.findIndex((h) => h.includes("phone") || h.includes("mobile") || h.includes("contact"));
      const amountIdx = headers.findIndex((h) => h.includes("amount") || h.includes("total") || h.includes("revenue") || h.includes("net amount"));
      const categoryIdx = headers.findIndex((h) => h.includes("category") || h.includes("product") || h.includes("type") || h.includes("item"));
      const addressIdx = headers.findIndex((h) => h.includes("address") || h.includes("location"));
      const cityIdx = headers.findIndex((h) => h.includes("city") || h.includes("area"));
      const emailIdx = headers.findIndex((h) => h.includes("email"));

      if (nameIdx === -1 && phoneIdx === -1) {
        throw new Error("Could not find 'Name' or 'Phone' columns. Please check your CSV headers.");
      }

      const rows = lines.slice(1);
      const customerMap = new Map<string, {
        name: string; phone: string; email: string; address: string; city: string;
        totalRevenue: number; affinities: Set<string>;
      }>();

      for (const row of rows) {
        const cols = row.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
        const name = nameIdx >= 0 ? cols[nameIdx]?.trim() || "" : "";
        const rawPhone = phoneIdx >= 0 ? cols[phoneIdx]?.trim() || "" : "";
        const phone = sanitizePhone(rawPhone);
        const key = phone || name.toLowerCase();
        if (!key) continue;

        const amount = amountIdx >= 0 ? parseFloat(cols[amountIdx]?.replace(/[₹,()]/g, "") || "0") || 0 : 0;
        const category = categoryIdx >= 0 ? cols[categoryIdx]?.trim() || "" : "";
        const address = addressIdx >= 0 ? cols[addressIdx]?.trim() || "" : "";
        const city = cityIdx >= 0 ? cols[cityIdx]?.trim() || "" : "";
        const email = emailIdx >= 0 ? cols[emailIdx]?.trim() || "" : "";

        const existing = customerMap.get(key);
        if (existing) {
          existing.totalRevenue += amount;
          if (category) detectAffinity(category).forEach((a) => existing.affinities.add(a));
          if (address && !existing.address) existing.address = address;
          if (city && !existing.city) existing.city = city;
          if (email && !existing.email) existing.email = email;
          if (name && !existing.name) existing.name = name;
          if (phone && !existing.phone) existing.phone = phone;
        } else {
          const affinities = new Set<string>();
          if (category) detectAffinity(category).forEach((a) => affinities.add(a));
          customerMap.set(key, { name, phone, email, address, city, totalRevenue: amount, affinities });
        }
      }

      const entries = Array.from(customerMap.values());
      const res: ImportResult = { total: entries.length, imported: 0, skipped: 0, warmLeads: 0, vips: 0, errors: [] };

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        setProgress(Math.round(((i + 1) / entries.length) * 100));

        if (!entry.name && !entry.phone) { res.skipped++; continue; }

        const affinityArr = Array.from(entry.affinities);
        const isWarmLead = affinityArr.length > 0;
        const isVip = entry.totalRevenue > 25000;
        const tags = isWarmLead ? ["Restoree_Warm_Lead"] : [];
        const context = isVip
          ? `Previously used Laundry services. High potential for ${affinityArr.length > 0 ? affinityArr.join("/") : "restoration"} based on history. Legacy VIP — LTV ₹${entry.totalRevenue.toLocaleString("en-IN")}.`
          : entry.affinities.size > 0
            ? `Previously used Laundry services. Potential for ${affinityArr.join("/")} based on history.`
            : null;

        try {
          if (entry.phone) {
            const { data: existing } = await supabase
              .from("customers").select("id, legacy_ltv").eq("phone", entry.phone).limit(1);

            if (existing && existing.length > 0) {
              const currentLtv = Number(existing[0].legacy_ltv) || 0;
              await supabase.from("customers").update({
                legacy_ltv: currentLtv + entry.totalRevenue,
                legacy_source: "The Laundry Company",
                service_affinity: affinityArr.length > 0 ? affinityArr : undefined,
                historical_context: context || undefined,
                address: entry.address || undefined,
                city: entry.city || undefined,
              }).eq("id", existing[0].id);
            } else {
              await supabase.from("customers").insert({
                name: entry.name || "Unknown",
                phone: entry.phone,
                email: entry.email || null,
                address: entry.address || null,
                city: entry.city || null,
                legacy_ltv: entry.totalRevenue,
                legacy_source: "The Laundry Company",
                service_affinity: affinityArr,
                historical_context: context,
              });
            }
          } else {
            await supabase.from("customers").insert({
              name: entry.name,
              phone: "0000000000",
              email: entry.email || null,
              address: entry.address || null,
              city: entry.city || null,
              legacy_ltv: entry.totalRevenue,
              legacy_source: "The Laundry Company",
              service_affinity: affinityArr,
              historical_context: context,
            });
          }

          res.imported++;
          if (isWarmLead) res.warmLeads++;
          if (isVip) res.vips++;
        } catch (err: any) {
          res.skipped++;
          if (res.errors.length < 5) res.errors.push(`${entry.name || entry.phone}: ${err.message}`);
        }
      }

      setResult(res);
      toast({ title: `Import complete: ${res.imported} customers imported` });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">Turns Data Migration</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Upload CSVs from The Laundry Company (Product Wise, Datewise, or Customer reports).
            Phone numbers are auto-cleaned, service affinity detected, and Legacy LTV calculated.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="w-full gap-2"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {importing ? "Importing…" : "Upload Turns CSV"}
          </Button>

          {importing && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">{progress}% complete</p>
            </div>
          )}

          {result && (
            <Card className="rounded-xl border-primary/20 bg-muted/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <p className="text-sm font-semibold text-foreground">Migration Complete</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Total Rows:</span> <span className="font-medium text-foreground">{result.total}</span></div>
                  <div><span className="text-muted-foreground">Imported:</span> <span className="font-medium text-emerald-600">{result.imported}</span></div>
                  <div><span className="text-muted-foreground">Skipped:</span> <span className="font-medium text-foreground">{result.skipped}</span></div>
                  <div><span className="text-muted-foreground">Warm Leads:</span> <Badge variant="outline" className="text-[10px] ml-1">{result.warmLeads}</Badge></div>
                  <div><span className="text-muted-foreground">Legacy VIPs:</span> <Badge className="text-[10px] bg-amber-100 text-amber-800 ml-1">{result.vips}</Badge></div>
                </div>
                {result.errors.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Errors ({result.errors.length}):
                    </p>
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground">{e}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">What Gets Imported</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>• <strong>Phone Cleansing:</strong> Strips +91, spaces, dashes. Normalizes to 10-digit format.</p>
          <p>• <strong>Service Affinity:</strong> Scans product/category for sneaker, bag, footwear keywords → tags as "Restoree_Warm_Lead".</p>
          <p>• <strong>Legacy LTV:</strong> Aggregates revenue per customer. Keeps separate from Restoree metrics.</p>
          <p>• <strong>VIP Detection:</strong> LTV &gt; ₹25,000 → "Legacy VIP" badge in triage.</p>
          <p>• <strong>Address Pre-fill:</strong> Auto-populates customer profile for instant pickup booking.</p>
          <p>• <strong>Source Tagging:</strong> All imported customers tagged as "The Laundry Company".</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataMigrationTab;
