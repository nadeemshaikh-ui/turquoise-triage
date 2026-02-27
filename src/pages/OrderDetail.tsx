import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrderDetail } from "@/hooks/useOrderDetail";
import { toast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

import OrderStepper from "@/components/orders/OrderStepper";
import AssetPassportCard from "@/components/orders/AssetPassportCard";
import SlaIndicator from "@/components/orders/SlaIndicator";
import ExpertHuddle from "@/components/orders/ExpertHuddle";
import PricingEngine from "@/components/orders/PricingEngine";
import AdminOverride from "@/components/orders/AdminOverride";
import BeforeAfterPhotos from "@/components/orders/BeforeAfterPhotos";

const statusColor: Record<string, string> = {
  triage: "bg-primary/15 text-primary border-primary/30",
  consult: "bg-amber-100 text-amber-800 border-amber-300",
  quoted: "bg-secondary text-secondary-foreground border-border",
  workshop: "bg-blue-100 text-blue-800 border-blue-300",
  qc: "bg-purple-100 text-purple-800 border-purple-300",
  delivered: "bg-green-100 text-green-800 border-green-300",
};

const OrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    order, tasks, photos, auditLogs, isLoading,
    updateStatus, updateOrder, addExpertTask, updateExpertTask,
    uploadPhotos, deletePhoto, recalcTotalPrice, ORDER_STATUS_FLOW,
  } = useOrderDetail(id!);

  if (isLoading || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleAdvance = (nextStatus: string) => {
    updateStatus.mutate(nextStatus, {
      onSuccess: () => toast({ title: `Status updated to ${nextStatus}` }),
    });
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
        {/* Asset Passport */}
        <AssetPassportCard asset={order.asset} />

        {/* Order Stepper */}
        <OrderStepper
          currentStatus={order.status}
          onAdvance={handleAdvance}
          isPending={updateStatus.isPending}
        />

        {/* Expert Huddle */}
        <ExpertHuddle
          orderId={order.id}
          tasks={tasks}
          onAddTask={(task) => addExpertTask.mutateAsync(task)}
          onUpdateTask={(args) => updateExpertTask.mutateAsync(args)}
        />

        {/* Pricing Engine */}
        <PricingEngine
          order={order}
          expertTasks={tasks}
          onSave={async (updates) => { await updateOrder.mutateAsync(updates); toast({ title: "Pricing saved" }); }}
          recalcTotalPrice={recalcTotalPrice}
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
    </div>
  );
};

export default OrderDetail;
