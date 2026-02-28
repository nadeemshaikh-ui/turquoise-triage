import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, AlertTriangle, Info, Ban, XCircle, CheckCircle, CreditCard, Copy, ExternalLink, Send, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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
  pickup_scheduled: "bg-primary/15 text-primary border-primary/30",
  received: "bg-amber-100 text-amber-800 border-amber-300",
  inspection: "bg-secondary text-secondary-foreground border-border",
  in_progress: "bg-blue-100 text-blue-800 border-blue-300",
  qc: "bg-purple-100 text-purple-800 border-purple-300",
  ready: "bg-emerald-100 text-emerald-800 border-emerald-300",
  delivered: "bg-green-100 text-green-800 border-green-300",
  declined: "bg-red-100 text-red-800 border-red-300",
  cancelled: "bg-gray-100 text-gray-800 border-gray-300",
  // Legacy
  triage: "bg-primary/15 text-primary border-primary/30",
  consult: "bg-amber-100 text-amber-800 border-amber-300",
  quoted: "bg-secondary text-secondary-foreground border-border",
  workshop: "bg-blue-100 text-blue-800 border-blue-300",
};

const OrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const {
    order, tasks, photos, auditLogs, isLoading,
    updateStatus, updateOrder, addExpertTask, updateExpertTask,
    uploadPhotos, deletePhoto, addDiscovery,
    markUnfixable, markRefundIssued, rejectPaymentDeclaration, forceCancel,
    recalcTotalPrice, ORDER_STATUS_FLOW,
  } = useOrderDetail(id!);

  const [discoveryOpen, setDiscoveryOpen] = useState(false);

  // VIP check
  const { data: customerOrderCount } = useQuery({
    queryKey: ["customer-order-count", order?.customerId],
    queryFn: async () => {
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", order!.customerId);
      return count ?? 0;
    },
    enabled: !!order?.customerId,
  });

  const { data: capacityData } = useQuery({
    queryKey: ["capacity-planning"],
    queryFn: async () => {
      const [settingsRes, countRes] = await Promise.all([
        supabase.from("system_settings").select("workshop_capacity").limit(1).single(),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
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

  const isLocked = !!(order.customerApprovedAt || order.customerDeclinedAt);
  const canEdit = isAdmin ? true : !isLocked; // God Mode: admin always edits
  const isGodMode = isAdmin && isLocked;
  const isWorkshopOrQc = order.status === "in_progress" || order.status === "qc";
  const isOverCapacity = capacityData && capacityData.activeCount > capacityData.capacity;
  const isVip = (customerOrderCount ?? 0) > 1;
  const isReceivedOrInspection = order.status === "received" || order.status === "inspection";
  const isDelivered = !!order.deliveredAt;

  // Check-in logic
  const checkedInItems: string[] = order.checkedInItems || [];
  const expectedCount = order.expectedItemCount || 1;
  const checkedCount = checkedInItems.length;
  const hasCheckinMismatch = checkedCount > 0 && checkedCount !== expectedCount && !order.checkinConfirmed;

  const handleAdvance = (nextStatus: string) => {
    // Block advancing from received to inspection if mismatch and not confirmed
    if (order.status === "received" && nextStatus === "inspection" && hasCheckinMismatch) {
      toast({ title: "Check-in mismatch — confirm discrepancy first", variant: "destructive" });
      return;
    }
    updateStatus.mutate(nextStatus, {
      onSuccess: () => toast({ title: `Status updated to ${nextStatus}` }),
    });
  };

  const handleToggleCheckin = async (itemLabel: string) => {
    const current = [...checkedInItems];
    const idx = current.indexOf(itemLabel);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(itemLabel);
    await updateOrder.mutateAsync({ checked_in_items: current });
  };

  const handleConfirmDiscrepancy = async () => {
    await updateOrder.mutateAsync({ checkin_confirmed: true });
    toast({ title: "Discrepancy confirmed by admin" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/orders")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-bold text-foreground">{order.customerName}</h1>
              {isVip && (
                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">⭐ VIP</Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const portalUrl = `${window.location.origin}/portal/${order.customerId}`;
                  navigator.clipboard.writeText(portalUrl);
                  toast({ title: "Portal link copied!" });
                }}
              >
                <Copy className="h-3 w-3" /> Copy Link
              </Button>
              <Button
                size="sm"
                className="h-7 gap-1 text-[11px] border-none"
                style={{ backgroundColor: "#C9A96E", color: "#0A0A0A" }}
                onClick={() => window.open(`/portal/${order.customerId}`, "_blank")}
              >
                <ExternalLink className="h-3 w-3" /> Open Portal
              </Button>
            </div>
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
            🔒 Contract {order.customerApprovedAt ? "approved" : "declined"} by customer — {isAdmin ? "God Mode active" : "editing disabled"}
          </div>
        )}

        {/* Quote Sent Banner */}
        {order.quoteSentAt && (
          <div className="rounded-[var(--radius)] bg-green-50 border border-green-200 p-3 text-xs text-green-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 shrink-0" />
              <span>Quote Sent · {formatDistanceToNow(new Date(order.quoteSentAt), { addSuffix: true })}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-[11px] text-green-700 hover:text-green-900 hover:bg-green-100"
                onClick={() => {
                  const portalUrl = `${window.location.origin}/portal/${order.customerId}`;
                  navigator.clipboard.writeText(portalUrl);
                  toast({ title: "Portal link copied!" });
                }}
              >
                <Copy className="h-3 w-3" /> Copy Link
              </Button>
            </div>
          </div>
        )}

        {/* Payment Declared Banner */}
        {order.paymentDeclared && order.status === "ready" && (
          <div className="rounded-[var(--radius)] bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 flex items-center gap-2">
            <CreditCard className="h-4 w-4 shrink-0" />
            Customer has declared payment. Awaiting admin verification.
          </div>
        )}

        {/* Capacity Banner */}
        {isOverCapacity && (
          <div className="rounded-[var(--radius)] bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" />
            High demand — estimated +4 days delivery buffer ({capacityData.activeCount}/{capacityData.capacity} workshop slots)
          </div>
        )}

        <AssetPassportCard asset={order.asset} />

        <OrderStepper
          currentStatus={order.status}
          onAdvance={handleAdvance}
          isPending={updateStatus.isPending}
          canEdit={canEdit}
        />

        {/* Physical Check-In Checklist */}
        {isReceivedOrInspection && (
          <section className={`rounded-[var(--radius)] border p-4 space-y-3 ${hasCheckinMismatch ? "border-orange-400 bg-orange-50" : "border-border bg-card"}`}>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Physical Check-In</h3>
              <span className="text-xs text-muted-foreground">{checkedCount}/{expectedCount} items</span>
            </div>
            {hasCheckinMismatch && (
              <div className="rounded-[calc(var(--radius)/2)] bg-orange-100 border border-orange-300 p-2 text-xs text-orange-800">
                ⚠️ Item count mismatch! Expected {expectedCount}, checked {checkedCount}. Confirm discrepancy to proceed.
              </div>
            )}
            <div className="space-y-2">
              {Array.from({ length: expectedCount }, (_, i) => {
                const label = `Item ${String.fromCharCode(65 + i)}`;
                const isChecked = checkedInItems.includes(label);
                return (
                  <label key={label} className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => handleToggleCheckin(label)}
                    />
                    <span className={`text-sm ${isChecked ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {label} — {isChecked ? "✓ Received" : "Pending"}
                    </span>
                  </label>
                );
              })}
            </div>
            {hasCheckinMismatch && (
              <Button
                variant="outline"
                size="sm"
                className="w-full border-orange-400 text-orange-700 hover:bg-orange-100"
                onClick={handleConfirmDiscrepancy}
              >
                Confirm Discrepancy & Continue
              </Button>
            )}
          </section>
        )}

        {/* Discovery Trigger */}
        {(order.status === "in_progress" || order.status === "qc") && canEdit && (
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

        {/* Expert Huddle */}
        <ExpertHuddle
          orderId={order.id}
          tasks={tasks}
          onAddTask={(task) => addExpertTask.mutateAsync(task)}
          onUpdateTask={(args) => updateExpertTask.mutateAsync(args)}
          canEdit={canEdit}
          canRemoveTask={!isWorkshopOrQc}
          isGodMode={isGodMode}
        />

        <PricingEngine
          order={order}
          expertTasks={tasks}
          onSave={async (updates) => { await updateOrder.mutateAsync(updates); toast({ title: "Pricing saved" }); }}
          recalcTotalPrice={recalcTotalPrice}
          canEdit={canEdit}
          isGodMode={isGodMode}
        />

        {/* Admin Overrides */}
        <div className="flex flex-wrap gap-2">
          <AdminOverride orderId={order.id} fieldName="total_price" fieldLabel="Total Price" currentValue={String(order.totalPrice)} onOverride={() => {}} />
          <AdminOverride orderId={order.id} fieldName="shipping_fee" fieldLabel="Shipping Fee" currentValue={String(order.shippingFee)} onOverride={() => {}} />
          <AdminOverride orderId={order.id} fieldName="status" fieldLabel="Status" currentValue={order.status} onOverride={() => {}} />
        </div>

        {/* Admin Terminal Actions */}
        {isAdmin && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Admin Actions</h2>
            <div className="flex flex-wrap gap-2">
              {order.status !== "declined" && order.status !== "cancelled" && order.status !== "delivered" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-1.5">
                      <Ban className="h-3.5 w-3.5" /> Mark Unfixable
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Mark Order as Unfixable?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will mark the order as declined. Cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => markUnfixable.mutate(undefined, {
                          onSuccess: () => toast({ title: "Order marked unfixable. Audit logged." }),
                        })}
                        className="bg-destructive text-destructive-foreground"
                      >
                        Confirm
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {order.status !== "declined" && order.status !== "cancelled" && order.status !== "delivered" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-1.5">
                      <XCircle className="h-3.5 w-3.5" /> Force Cancel
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Force Cancel Order?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will cancel the order and clear the SLA timer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => forceCancel.mutate(undefined, {
                          onSuccess: () => toast({ title: "Order cancelled. Audit logged." }),
                        })}
                        className="bg-destructive text-destructive-foreground"
                      >
                        Confirm Cancel
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {/* Reject Payment Declaration */}
              {order.paymentDeclared && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-50"
                  onClick={() => rejectPaymentDeclaration.mutate(undefined, {
                    onSuccess: () => toast({ title: "Payment declaration rejected. Portal re-enabled." }),
                  })}
                >
                  <CreditCard className="h-3.5 w-3.5" /> Payment Not Found
                </Button>
              )}
            </div>
          </section>
        )}

        {/* Delivery & Warranty Section */}
        {order.status === "delivered" && (
          <section className="rounded-[var(--radius)] border border-border bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" /> Delivery & Warranty
            </h3>
            {isDelivered ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Delivered: {format(new Date(order.deliveredAt!), "MMM d, yyyy 'at' h:mm a")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Warranty: {order.warrantyDaysSnapshot} days from delivery
                </p>
              </div>
            ) : (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={async () => {
                  try {
                    const { error } = await supabase.rpc('set_delivered_at', {
                      p_order_id: order.id,
                      p_delivered_at: new Date().toISOString(),
                    } as any);
                    if (error) throw error;
                    toast({ title: "Delivery confirmed & warranty started" });
                    queryClient.invalidateQueries({ queryKey: ["order", id] });
                  } catch (err: any) {
                    toast({ title: err.message || "Failed to mark delivered", variant: "destructive" });
                  }
                }}
              >
                <Package className="h-3.5 w-3.5" /> Mark Delivered
              </Button>
            )}
          </section>
        )}

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

      <DiscoveryDialog
        open={discoveryOpen}
        onOpenChange={setDiscoveryOpen}
        orderId={order.id}
        onSubmit={async (data) => {
          await addDiscovery.mutateAsync(data);
          toast({ title: "Discovery added — SLA paused" });
        }}
      />
    </div>
  );
};

export default OrderDetail;
