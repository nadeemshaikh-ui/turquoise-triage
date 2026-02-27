import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, AlertTriangle, Banknote, Info, Ban, XCircle, CheckCircle, CreditCard, Copy, ExternalLink, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  triage: "bg-primary/15 text-primary border-primary/30",
  consult: "bg-amber-100 text-amber-800 border-amber-300",
  quoted: "bg-secondary text-secondary-foreground border-border",
  pending_advance: "bg-orange-100 text-orange-800 border-orange-300",
  workshop: "bg-blue-100 text-blue-800 border-blue-300",
  qc: "bg-purple-100 text-purple-800 border-purple-300",
  delivered: "bg-green-100 text-green-800 border-green-300",
  declined: "bg-red-100 text-red-800 border-red-300",
  cancelled: "bg-gray-100 text-gray-800 border-gray-300",
};

const OrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const {
    order, tasks, photos, auditLogs, isLoading,
    updateStatus, updateOrder, addExpertTask, updateExpertTask,
    uploadPhotos, deletePhoto, addDiscovery, logAdvancePaid,
    markUnfixable, markRefundIssued, rejectPaymentDeclaration, forceCancel,
    recalcTotalPrice, ORDER_STATUS_FLOW,
  } = useOrderDetail(id!);

  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [loggingAdvance, setLoggingAdvance] = useState(false);

  // VIP check: count total orders for this customer
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

  const isLocked = !!(order.customerApprovedAt || order.customerDeclinedAt);
  const canEdit = isAdmin || !isLocked;
  const isWorkshopOrQc = order.status === "workshop" || order.status === "qc";
  const isOverCapacity = capacityData && capacityData.activeCount > capacityData.capacity;
  const isVip = (customerOrderCount ?? 0) > 1;
  const showRefundIssued = (order.status === "declined" || order.status === "cancelled") && order.advancePaid > 0;

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
            🔒 Contract {order.customerApprovedAt ? "approved" : "declined"} by customer — {isAdmin ? "admin override available" : "editing disabled"}
          </div>
        )}

        {/* Quote Sent Banner with Portal Links */}
        {order.quoteSentAt && (
          <div className="rounded-[var(--radius)] bg-green-50 border border-green-200 p-3 text-xs text-green-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 shrink-0" />
              <span>Quote Sent via WhatsApp · {formatDistanceToNow(new Date(order.quoteSentAt), { addSuffix: true })}</span>
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
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-[11px] text-green-700 hover:text-green-900 hover:bg-green-100"
                onClick={() => window.open(`/portal/${order.customerId}`, "_blank")}
              >
                <ExternalLink className="h-3 w-3" /> Open Portal
              </Button>
            </div>
          </div>
        )}

        {/* Payment Declared Banner */}
        {order.paymentDeclared && order.status === "pending_advance" && (
          <div className="rounded-[var(--radius)] bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 flex items-center gap-2">
            <CreditCard className="h-4 w-4 shrink-0" />
            Customer has declared payment. Awaiting admin verification.
          </div>
        )}

        {/* Capacity Planning Banner */}
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

        {/* Expert Huddle — scope lockdown in workshop/qc */}
        <ExpertHuddle
          orderId={order.id}
          tasks={tasks}
          onAddTask={(task) => addExpertTask.mutateAsync(task)}
          onUpdateTask={(args) => updateExpertTask.mutateAsync(args)}
          canEdit={canEdit}
          canRemoveTask={!isWorkshopOrQc}
        />

        <PricingEngine
          order={order}
          expertTasks={tasks}
          onSave={async (updates) => { await updateOrder.mutateAsync(updates); toast({ title: "Pricing saved" }); }}
          recalcTotalPrice={recalcTotalPrice}
          canEdit={canEdit}
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
              {/* Mark Unfixable */}
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
                        This will zero the balance and mark as declined. {order.advancePaid > 0 && `A refund note for ₹${order.advancePaid.toLocaleString()} will be logged.`} Cannot be undone.
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

              {/* Force Cancel */}
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
                        This will cancel the order and clear the SLA timer. {order.advancePaid > 0 && `A refund note for ₹${order.advancePaid.toLocaleString()} will be logged.`}
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

              {/* Mark Refund Issued */}
              {showRefundIssued && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
                      <CheckCircle className="h-3.5 w-3.5" /> Mark Refund Issued
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Refund Issued</AlertDialogTitle>
                      <AlertDialogDescription>
                        This confirms ₹{order.advancePaid.toLocaleString()} has been refunded. The refund flag will be cleared.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => markRefundIssued.mutate(undefined, {
                          onSuccess: () => toast({ title: "Refund marked as issued." }),
                        })}
                      >
                        Confirm
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

        <BeforeAfterPhotos
          photos={photos}
          onUpload={(args) => uploadPhotos.mutateAsync(args)}
          onDelete={(photo) => deletePhoto.mutate(photo, { onSuccess: () => toast({ title: "Photo deleted" }) })}
          isUploading={uploadPhotos.isPending}
        />

        {/* Audit Timeline with refund highlighting */}
        {auditLogs.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Audit Trail</h2>
            <div className="space-y-2">
              {auditLogs.map((log) => {
                const isRefundRequired = log.reason?.includes("REFUND OF");
                const isRefundIssued = log.reason?.includes("REFUND ISSUED");
                const borderClass = isRefundRequired
                  ? "border-red-500 bg-red-50"
                  : isRefundIssued
                  ? "border-green-500 bg-green-50"
                  : "border-border bg-card";

                return (
                  <div key={log.id} className={`rounded-[calc(var(--radius)/2)] border p-3 text-xs space-y-1 ${borderClass}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{log.action}: {log.fieldName}</span>
                        {isRefundRequired && (
                          <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px]">Refund Required</Badge>
                        )}
                        {isRefundIssued && (
                          <Badge className="bg-green-100 text-green-800 border-green-300 text-[10px]">Refund Issued</Badge>
                        )}
                      </div>
                      <span className="text-muted-foreground">{formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}</span>
                    </div>
                    <p className="text-muted-foreground">{log.oldValue} → {log.newValue}</p>
                    <p className="italic text-muted-foreground">"{log.reason}" — {log.adminName}</p>
                  </div>
                );
              })}
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
