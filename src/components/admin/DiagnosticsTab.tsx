import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CheckCircle2, AlertTriangle, Loader2, ChevronDown, Activity, Database, Clock, HardDrive } from "lucide-react";

type MathError = { orderId: string; customerName: string; dbPrice: number; calculatedPrice: number; diff: number };
type OrphanOrder = { orderId: string; customerName: string; customerId: string };
type OrphanTask = { taskId: string; orderId: string; expertType: string };
type SlaError = { orderId: string; customerName: string; updatedAt: string };
type StorageResult = { readOk: boolean; writeOk: boolean; error?: string };

type DiagResults = {
  math: MathError[];
  orphanOrders: OrphanOrder[];
  orphanTasks: OrphanTask[];
  sla: SlaError[];
  storage: StorageResult;
} | null;

const DiagnosticsTab = () => {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<DiagResults>(null);
  const [resolving, setResolving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const runDiagnostics = async () => {
    setRunning(true);
    setProgress(0);
    setResults(null);

    // Check A: Math Integrity
    const { data: activeOrders } = await supabase
      .from("orders")
      .select("id, customer_name, total_price, shipping_fee, cleaning_fee, package_tier, is_bundle_applied")
      .neq("status", "delivered");

    const mathErrors: MathError[] = [];
    if (activeOrders) {
      const orderIds = activeOrders.map((o) => o.id);
      const { data: allTasks } = await supabase
        .from("expert_tasks")
        .select("order_id, expert_type, estimated_price")
        .in("order_id", orderIds.length ? orderIds : ["__none__"]);

      for (const order of activeOrders) {
        const tasks = (allTasks || []).filter((t) => t.order_id === order.id);
        const isElite = order.package_tier === "elite";
        const isBundleApplied = order.is_bundle_applied ?? false;

        const taskSum = tasks
          .filter((t) => !(isBundleApplied && t.expert_type === "cleaning"))
          .reduce((sum, t) => sum + (Number(t.estimated_price) || 0), 0);

        const calculated = isElite
          ? taskSum
          : taskSum + (Number(order.shipping_fee) || 0) + (Number(order.cleaning_fee) || 0);

        const dbPrice = Number(order.total_price) || 0;
        if (Math.abs(dbPrice - calculated) > 0.01) {
          mathErrors.push({
            orderId: order.id,
            customerName: order.customer_name || "Unknown",
            dbPrice,
            calculatedPrice: calculated,
            diff: dbPrice - calculated,
          });
        }
      }
    }
    setProgress(25);

    // Check B: Orphan Check
    const { data: orphanedOrders } = await supabase
      .from("orders")
      .select("id, customer_name, customer_id")
      .is("asset_id", null);

    const orphanOrders: OrphanOrder[] = (orphanedOrders || []).map((o) => ({
      orderId: o.id,
      customerName: o.customer_name || "Unknown",
      customerId: o.customer_id,
    }));

    // Check orphaned tasks: fetch all tasks then cross-reference
    const { data: allTasksForOrphan } = await supabase
      .from("expert_tasks")
      .select("id, order_id, expert_type");
    const { data: allOrderIds } = await supabase
      .from("orders")
      .select("id");
    const orderIdSet = new Set((allOrderIds || []).map((o) => o.id));
    const orphanTasks: OrphanTask[] = (allTasksForOrphan || [])
      .filter((t) => !orderIdSet.has(t.order_id))
      .map((t) => ({ taskId: t.id, orderId: t.order_id, expertType: t.expert_type }));

    setProgress(50);

    // Check C: SLA Integrity
    const { data: slaOrders } = await supabase
      .from("orders")
      .select("id, customer_name, updated_at")
      .eq("status", "consult")
      .is("consultation_start_time", null);

    const slaErrors: SlaError[] = (slaOrders || []).map((o) => ({
      orderId: o.id,
      customerName: o.customer_name || "Unknown",
      updatedAt: o.updated_at,
    }));
    setProgress(75);

    // Check D: Storage Check
    let storageResult: StorageResult = { readOk: false, writeOk: false };
    try {
      const { error: listErr } = await supabase.storage.from("order-photos").list("", { limit: 1 });
      storageResult.readOk = !listErr;

      const testBlob = new Blob(["diag-test"], { type: "text/plain" });
      const testPath = `_diagnostics_test_${Date.now()}.txt`;
      const { error: uploadErr } = await supabase.storage.from("order-photos").upload(testPath, testBlob);
      if (!uploadErr) {
        await supabase.storage.from("order-photos").remove([testPath]);
        storageResult.writeOk = true;
      }
    } catch (e: any) {
      storageResult.error = e.message;
    }
    setProgress(100);

    setResults({ math: mathErrors, orphanOrders, orphanTasks, sla: slaErrors, storage: storageResult });
    setRunning(false);
  };

  const totalErrors = results
    ? results.math.length + results.orphanOrders.length + results.orphanTasks.length + results.sla.length + (!results.storage.readOk || !results.storage.writeOk ? 1 : 0)
    : 0;

  const handleResolveAll = async () => {
    if (!results) return;
    setResolving(true);
    setConfirmOpen(false);
    let fixes = 0;

    // Fix math errors
    for (const err of results.math) {
      const { error } = await supabase
        .from("orders")
        .update({ total_price: err.calculatedPrice })
        .eq("id", err.orderId);
      if (!error) fixes++;
    }

    // Fix SLA errors
    for (const err of results.sla) {
      const { error } = await supabase
        .from("orders")
        .update({ consultation_start_time: err.updatedAt })
        .eq("id", err.orderId);
      if (!error) fixes++;
    }

    // Fix orphaned orders (missing asset_id)
    for (const orphan of results.orphanOrders) {
      const { data: newAsset, error: assetErr } = await supabase
        .from("asset_passport")
        .insert({ customer_id: orphan.customerId, item_category: "Unknown", brand: null })
        .select("id")
        .single();
      if (!assetErr && newAsset) {
        await supabase.from("orders").update({ asset_id: newAsset.id }).eq("id", orphan.orderId);
        fixes++;
      }
    }

    // Delete orphaned tasks
    for (const task of results.orphanTasks) {
      const { error } = await supabase.from("expert_tasks").delete().eq("id", task.taskId);
      if (!error) fixes++;
    }

    setResolving(false);
    toast({ title: "Diagnostics Resolved", description: `${fixes} fix(es) applied successfully.` });
    // Re-run diagnostics to show clean state
    runDiagnostics();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">System Diagnostics</h2>
          <p className="text-sm text-muted-foreground">Run automated health checks on data integrity</p>
        </div>
        <Button onClick={runDiagnostics} disabled={running || resolving} className="gap-2">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
          {running ? "Running…" : "Run Diagnostics"}
        </Button>
      </div>

      {(running || progress > 0) && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">{progress}%</p>
        </div>
      )}

      {results && (
        <div className="grid gap-4">
          <DiagCard
            icon={<Activity className="h-5 w-5" />}
            title="Math Integrity"
            description="Pricing formula vs DB value"
            count={results.math.length}
          >
            {results.math.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">DB Price</TableHead>
                    <TableHead className="text-right">Calculated</TableHead>
                    <TableHead className="text-right">Diff</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.math.map((e) => (
                    <TableRow key={e.orderId}>
                      <TableCell className="text-sm">{e.customerName}</TableCell>
                      <TableCell className="text-right text-sm">₹{e.dbPrice.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm">₹{e.calculatedPrice.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm font-medium text-destructive">₹{e.diff.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DiagCard>

          <DiagCard
            icon={<Database className="h-5 w-5" />}
            title="Orphan Check"
            description="Orders without assets & tasks without orders"
            count={results.orphanOrders.length + results.orphanTasks.length}
          >
            {results.orphanOrders.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Orphaned Orders (no asset_id)</p>
                <Table>
                  <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Order ID</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {results.orphanOrders.map((o) => (
                      <TableRow key={o.orderId}>
                        <TableCell className="text-sm">{o.customerName}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{o.orderId.slice(0, 8)}…</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {results.orphanTasks.length > 0 && (
              <div className="space-y-1 mt-2">
                <p className="text-xs font-medium text-muted-foreground">Orphaned Tasks (no matching order)</p>
                <Table>
                  <TableHeader><TableRow><TableHead>Expert Type</TableHead><TableHead>Task ID</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {results.orphanTasks.map((t) => (
                      <TableRow key={t.taskId}>
                        <TableCell className="text-sm capitalize">{t.expertType}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{t.taskId.slice(0, 8)}…</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DiagCard>

          <DiagCard
            icon={<Clock className="h-5 w-5" />}
            title="SLA Integrity"
            description="Consult orders missing consultation_start_time"
            count={results.sla.length}
          >
            {results.sla.length > 0 && (
              <Table>
                <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Order ID</TableHead></TableRow></TableHeader>
                <TableBody>
                  {results.sla.map((s) => (
                    <TableRow key={s.orderId}>
                      <TableCell className="text-sm">{s.customerName}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{s.orderId.slice(0, 8)}…</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DiagCard>

          <DiagCard
            icon={<HardDrive className="h-5 w-5" />}
            title="Storage Check"
            description="order-photos bucket read/write access"
            count={!results.storage.readOk || !results.storage.writeOk ? 1 : 0}
          >
            <div className="flex gap-4 text-sm">
              <span>Read: {results.storage.readOk ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">OK</Badge> : <Badge variant="destructive">FAIL</Badge>}</span>
              <span>Write: {results.storage.writeOk ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">OK</Badge> : <Badge variant="destructive">FAIL</Badge>}</span>
            </div>
            {results.storage.error && <p className="text-xs text-destructive mt-1">{results.storage.error}</p>}
          </DiagCard>

          {totalErrors > 0 && (
            <div className="flex justify-end">
              <Button variant="destructive" size="lg" onClick={() => setConfirmOpen(true)} disabled={resolving} className="gap-2">
                {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                Resolve All ({totalErrors - (!results.storage.readOk || !results.storage.writeOk ? 1 : 0)} fixable)
              </Button>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Auto-Resolve</AlertDialogTitle>
            <AlertDialogDescription>
              This will apply surgical fixes: correct pricing mismatches, patch missing SLA timestamps using order's updated_at, create Asset Passports for orphaned orders, and delete orphaned tasks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResolveAll}>Resolve All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function DiagCard({ icon, title, description, count, children }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  count: number;
  children: React.ReactNode;
}) {
  const isOk = count === 0;
  return (
    <Collapsible>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              {isOk ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              )}
              <div className="text-left">
                <div className="flex items-center gap-2">
                  {icon}
                  <span className="font-medium text-sm text-foreground">{title}</span>
                </div>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOk ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">All Clear</Badge>
              ) : (
                <Badge variant="destructive">{count} issue{count > 1 ? "s" : ""}</Badge>
              )}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border p-4">{children || <p className="text-sm text-muted-foreground">No issues found.</p>}</div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default DiagnosticsTab;
