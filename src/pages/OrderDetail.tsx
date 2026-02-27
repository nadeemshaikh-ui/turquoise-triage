import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, AlertTriangle, Banknote, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useOrderDetail } from "@/hooks/useOrderDetail";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

import OrderStepper from "@/components/orders/OrderStepper";
import AssetPassportCard from "@/components/orders/AssetPassportCard";
import SlaIndicator from "@/components/orders/SlaIndicator";
import ExpertHuddle from "@/components/orders/ExpertHuddle";
import PricingEngine from "@/components/orders/PricingEngine";
import AdminOverride from "@/components/orders/AdminOverride";
import BeforeAfterPhotos from "@/components/orders/BeforeAfterPhotos";
import DiscoveryDialog from "@/components/orders/DiscoveryDialog";

const statusColor: Record<string, string> = {
  triage: "bg-primary/15 text-primary border-primary/30",
  consult: "bg-amber-100 text-amber-800 border-amber-300",
  quoted: "bg-secondary text-secondary-foreground border-border",
  pending_advance: "bg-orange-100 text-orange-800 border-orange-300",
  workshop: "bg-blue-100 text-blue-800 border-blue-300",
  qc: "bg-purple-100 text-purple-800 border-purple-300",
  delivered: "bg-green-100 text-green-800 border-green-300",
};

const OrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const {
    order, tasks, photos, auditLogs, isLoading,
    updateStatus, updateOrder, addExpertTask, updateExpertTask,
    uploadPhotos, deletePhoto, addDiscovery, logAdvancePaid, recalcTotalPrice, ORDER_STATUS_FLOW,
  } = useOrderDetail(id!);

  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [loggingAdvance, setLoggingAdvance] = useState(false);

  // Capacity planning
  const { data: capacityData } = useQuery({
    queryKey: ["capacity-planning"],
    queryFn: async () => {
      const [settingsRes, countRes] = await Promise.all([
        supabase.from("system_settings").select("workshop_capacity").limit(1).single(),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "workshop"),
      ]);
      return {
        capacity: settingsRes.data?.workshop_capacity ?? 20,
        activeCount: countRes.count ?? 0,
      };
    },
  });

  if (isLoading || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Contract lock
  const isLocked = !!(order.customerApprovedAt || order.customerDeclinedAt);
  const canEdit = isAdmin || !isLocked;

  const isOverCapacity = capacityData && capacityData.activeCount > capacityData.capacity;

  const handleAdvance = (nextStatus: string) => {
    updateStatus.mutate(nextStatus, {
      onSuccess: () => toast({ title: `Status updated to ${nextStatus}` }),
    });
  };

  const handleLogAdvance = async () => {
    const amount = Number(advanceAmount);
    if (!amount || amount <= 0) return;
    setLoggingAdvance(true);
    try {
      await logAdvancePaid.mutateAsync(amount);
      toast({ title: `₹${amount.toLocaleString()} advance logged. Order moved to workshop.` });
      setAdvanceAmount("");
    } catch {
      toast({ title: "Failed to log advance", variant: "destructive" });
    } finally {
      setLoggingAdvance(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/orders")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-foreground">{order.customerName}</h1>
            <p className="truncate text-sm text-muted-foreground">{order.customerPhone}</p>
          </div>
          <div className="flex items-center gap-2">
            <SlaIndicator orderStatus={order.status} consultationStartTime={order.consultationStartTime} />
            <Badge variant="outline" className={`shrink-0 rounded-full text-xs ${statusColor[order.status] || ""}`}>
              {order.status}
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        {/* Contract Lock Banner */}
        {isLocked && (
          <div className="rounded-[var(--radius)] bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-center gap-2">
            🔒 Contract {order.customerApprovedAt ? "approved" : "declined"} by customer — {isAdmin ? "admin override available" : "editing disabled"}
          </div>
        )}

        {/* Capacity Planning Banner */}
        {isOverCapacity && (
          <div className="rounded-[var(--radius)] bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" />
            High demand — estimated +4 days delivery buffer ({capacityData.activeCount}/{capacityData.capacity} workshop slots)
          </div>
        )}

        {/* Asset Passport */}
        <AssetPassportCard asset={order.asset} />

        {/* Order Stepper */}
        <OrderStepper
          currentStatus={order.status}
          onAdvance={handleAdvance}
          isPending={updateStatus.isPending}
          canEdit={canEdit}
        />

        {/* Discovery Trigger */}
        {order.status === "workshop" && canEdit && (
          <Button
            variant="outline"
            onClick={() => setDiscoveryOpen(true)}
            className="w-full gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            <AlertTriangle className="h-4 w-4" />
            Add Workshop Discovery
          </Button>
        )}

        {order.discoveryPending && (
          <div className="rounded-[var(--radius)] bg-amber-50 border border-amber-300 p-3 text-xs text-amber-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Discovery pending — SLA timer paused. Awaiting customer approval.
          </div>
        )}

        {/* Payment Actions for pending_advance */}
        {order.status === "pending_advance" && canEdit && (
          <div className="rounded-[var(--radius)] border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-semibold text-foreground">Log Advance Payment</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Advance required: ₹{order.advanceRequired.toLocaleString()} · Balance: ₹{order.balanceRemaining.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="Amount paid..."
                className="h-9"
              />
              <Button
                onClick={handleLogAdvance}
                disabled={loggingAdvance || !Number(advanceAmount)}
                className="gap-2 shrink-0"
              >
                {loggingAdvance && <Loader2 className="h-4 w-4 animate-spin" />}
                Log Payment
              </Button>
            </div>
          </div>
        )}

        {/* Expert Huddle */}
        <ExpertHuddle
          orderId={order.id}
          tasks={tasks}
          onAddTask={(task) => addExpertTask.mutateAsync(task)}
          onUpdateTask={(args) => updateExpertTask.mutateAsync(args)}
          canEdit={canEdit}
        />

        {/* Pricing Engine */}
        <PricingEngine
          order={order}
          expertTasks={tasks}
          onSave={async (updates) => { await updateOrder.mutateAsync(updates); toast({ title: "Pricing saved" }); }}
          recalcTotalPrice={recalcTotalPrice}
          canEdit={canEdit}
        />

        {/* Admin Overrides */}
        <div className="flex flex-wrap gap-2">
          <AdminOverride
            orderId={order.id}
            fieldName="total_price"
            fieldLabel="Total Price"
            currentValue={String(order.totalPrice)}
            onOverride={() => {}}
          />
          <AdminOverride
            orderId={order.id}
            fieldName="shipping_fee"
            fieldLabel="Shipping Fee"
            currentValue={String(order.shippingFee)}
            onOverride={() => {}}
          />
          <AdminOverride
            orderId={order.id}
            fieldName="status"
            fieldLabel="Status"
            currentValue={order.status}
            onOverride={() => {}}
          />
        </div>

        {/* Before/After Photos */}
        <BeforeAfterPhotos
          photos={photos}
          onUpload={(args) => uploadPhotos.mutateAsync(args)}
          onDelete={(photo) => deletePhoto.mutate(photo, { onSuccess: () => toast({ title: "Photo deleted" }) })}
          isUploading={uploadPhotos.isPending}
        />

        {/* Audit Timeline */}
        {auditLogs.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Audit Trail</h2>
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="rounded-[calc(var(--radius)/2)] border border-border bg-card p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{log.action}: {log.fieldName}</span>
                    <span className="text-muted-foreground">{formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}</span>
                  </div>
                  <p className="text-muted-foreground">{log.oldValue} → {log.newValue}</p>
                  <p className="italic text-muted-foreground">"{log.reason}" — {log.adminName}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Created {format(new Date(order.createdAt), "MMM d, yyyy 'at' h:mm a")}
        </p>
      </main>

      {/* Discovery Dialog */}
      <DiscoveryDialog
        open={discoveryOpen}
        onOpenChange={setDiscoveryOpen}
        onSubmit={async (data) => {
          await addDiscovery.mutateAsync(data);
          toast({ title: "Discovery added — SLA paused" });
        }}
      />
    </div>
  );
};

export default OrderDetail;
