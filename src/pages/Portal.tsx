import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import PortalOrderCard from "@/components/portal/PortalOrderCard";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const Portal = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "historical">("active");
  const [expired, setExpired] = useState(false);
  const [declaring, setDeclaring] = useState(false);

  // Approval flow state
  const [ack1, setAck1] = useState(false);
  const [ack2, setAck2] = useState(false);
  const [ack3, setAck3] = useState(false);
  const [approving, setApproving] = useState(false);

  // Lifted interactive sales state per order
  const [tierSelections, setTierSelections] = useState<Record<string, string>>({});
  const [excludedTasks, setExcludedTasks] = useState<Record<string, Set<string>>>({});

  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId || "");

  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setExpired(true), SESSION_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    if (!isValidUuid) return;
    resetTimeout();
    const events = ["click", "scroll", "keypress", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetTimeout));
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimeout));
    };
  }, [isValidUuid, resetTimeout]);

  const fetchData = useCallback(async () => {
    if (!isValidUuid) return;
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/serve-portal?action=load&customerId=${customerId}`);
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [customerId, isValidUuid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const callAction = async (action: string, body: any) => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/serve-portal?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, ...body }),
    });
    if (!res.ok) throw new Error("Action failed");
    await fetchData();
  };

  const quotedOrders = (data?.active || []).filter((o: any) => o.status === "quoted");
  const pendingAdvanceOrders = (data?.active || []).filter((o: any) => o.status === "pending_advance");
  const anyPaymentDeclared = pendingAdvanceOrders.some((o: any) => o.payment_declared);
  const totalAdvanceRequired = pendingAdvanceOrders.reduce((sum: number, o: any) => sum + Number(o.advance_required || 0), 0);
  const actionRequired = quotedOrders.length > 0 || (data?.active || []).some((o: any) => o.discovery_pending);

  const handleDeclarePayment = async () => {
    setDeclaring(true);
    try {
      const ids = pendingAdvanceOrders.map((o: any) => o.id);
      await callAction("declare_payment", { orderIds: ids });
    } finally {
      setDeclaring(false);
    }
  };

  const handleApproveAll = async () => {
    setApproving(true);
    try {
      const ids = quotedOrders.map((o: any) => o.id);
      const tiers: Record<string, string> = {};
      const excluded: Record<string, string[]> = {};
      ids.forEach((id: string) => {
        tiers[id] = tierSelections[id] || "standard";
        excluded[id] = Array.from(excludedTasks[id] || []);
      });
      await callAction("approve", { orderIds: ids, tiers, excludedTaskIds: excluded });
    } finally {
      setApproving(false);
    }
  };

  const handleTierChange = useCallback((orderId: string, tier: string) => {
    setTierSelections(prev => ({ ...prev, [orderId]: tier }));
  }, []);

  const handleExcludedChange = useCallback((orderId: string, excluded: Set<string>) => {
    setExcludedTasks(prev => ({ ...prev, [orderId]: excluded }));
  }, []);

  if (!isValidUuid) {
    return (
      <div className="portal-theme min-h-screen flex items-center justify-center bg-[hsl(var(--portal-bg))]">
        <p className="text-base text-[hsl(var(--portal-muted))]">Invalid link.</p>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="portal-theme min-h-screen flex items-center justify-center bg-[hsl(var(--portal-bg))]">
        <div className="text-center space-y-4">
          <p className="text-lg font-semibold text-[hsl(var(--portal-gold))]">Session Expired</p>
          <p className="text-base text-[hsl(var(--portal-muted))]">Please refresh to continue.</p>
          <Button onClick={() => window.location.reload()} className="min-h-[48px] bg-[hsl(var(--portal-gold))] text-[hsl(0_0%_4%)]">
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-theme min-h-screen bg-[hsl(var(--portal-bg))]">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-md border-b border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg)/0.9)] px-6 py-5">
        <h1 className="text-2xl font-bold tracking-wide text-[hsl(var(--portal-gold))]">
          Your Wardrobe
        </h1>
        <p className="text-base mt-0.5 text-[hsl(var(--portal-muted))]">
          Restoree 360
        </p>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--portal-gold))]" />
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-base text-[hsl(var(--portal-muted))]">Unable to load your wardrobe.</p>
        </div>
      ) : (
        <main className="max-w-lg mx-auto px-5 py-6 space-y-6">
          {/* Tabs */}
          <div className="flex gap-2">
            {(["active", "historical"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`portal-pressed px-4 min-h-[48px] text-base font-medium rounded-full transition-all ${
                  tab === t ? "text-[hsl(var(--portal-gold))]" : "opacity-50 text-[hsl(var(--portal-muted))]"
                }`}
              >
                {t === "active" ? "Active Restorations" : "Historical Archives"}
                {t === "active" && actionRequired && (
                  <span className="ml-1.5 inline-block w-2 h-2 rounded-full animate-pulse bg-[hsl(var(--portal-gold))]" />
                )}
              </button>
            ))}
          </div>

          {/* Order Cards */}
          {(tab === "active" ? data?.active : data?.historical || []).map((order: any) => (
            <PortalOrderCard
              key={order.id}
              order={order}
              tasks={data?.tasks || []}
              photos={data?.photos || []}
              discoveries={data?.discoveries || []}
              markers={data?.markers || []}
              onApproveDiscovery={(id) => callAction("approve_discovery", { discoveryId: id })}
              onDeclineDiscovery={(id) => callAction("decline_discovery", { discoveryId: id })}
              onConfirmAddress={(oid, addr) => callAction("confirm_address", { orderId: oid, address: addr })}
              onSubmitRating={(oid, r, f) => callAction("submit_rating", { orderId: oid, rating: r, feedback: f })}
              selectedTier={tierSelections[order.id] || order.package_tier || "standard"}
              onTierChange={(tier) => handleTierChange(order.id, tier)}
              excludedTaskIds={excludedTasks[order.id] || new Set()}
              onExcludedChange={(excluded) => handleExcludedChange(order.id, excluded)}
            />
          ))}

          {(tab === "active" ? data?.active : data?.historical || []).length === 0 && (
            <div className="text-center py-12">
              <p className="text-base text-[hsl(var(--portal-muted))]">
                {tab === "active" ? "No active restorations." : "No past restorations."}
              </p>
            </div>
          )}

          {/* Global Approval Flow */}
          {tab === "active" && quotedOrders.length > 0 && (
            <div className="portal-raised p-5 space-y-4 border border-[hsl(var(--portal-gold)/0.3)]">
              <h3 className="text-lg font-semibold text-[hsl(var(--portal-gold))]">
                Review & Approve Wardrobe
              </h3>
              <div className="space-y-3">
                {[
                  { checked: ack1, set: setAck1, label: "I acknowledge the documented damage and restoration scope" },
                  { checked: ack2, set: setAck2, label: "I approve the proposed work and pricing" },
                  { checked: ack3, set: setAck3, label: "I accept the estimated timeline" },
                ].map((item, i) => (
                  <label key={i} className="flex items-start gap-3 cursor-pointer">
                    <Checkbox checked={item.checked} onCheckedChange={(v) => item.set(!!v)} className="mt-0.5" />
                    <span className="text-base text-[hsl(var(--portal-text))]">{item.label}</span>
                  </label>
                ))}
              </div>
              <Button
                onClick={handleApproveAll}
                disabled={!ack1 || !ack2 || !ack3 || approving}
                className={`w-full min-h-[48px] gap-2 text-base ${
                  ack1 && ack2 && ack3 ? "bg-[hsl(var(--portal-gold))] text-[hsl(0_0%_4%)]" : ""
                }`}
              >
                {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Approve {quotedOrders.length} Item{quotedOrders.length > 1 ? "s" : ""}
              </Button>
            </div>
          )}

          {/* UPI Payment Declaration */}
          {tab === "active" && pendingAdvanceOrders.length > 0 && (
            <div className="portal-raised p-5 space-y-3 border border-[hsl(var(--portal-gold)/0.3)]">
              <div className="text-center">
                <p className="text-base text-[hsl(var(--portal-muted))]">Total Advance Required</p>
                <p className="text-3xl font-bold text-[hsl(var(--portal-gold))]">
                  ₹{totalAdvanceRequired.toLocaleString()}
                </p>
              </div>
              <Button
                onClick={handleDeclarePayment}
                disabled={anyPaymentDeclared || declaring}
                className={`w-full min-h-[48px] gap-2 text-base ${
                  anyPaymentDeclared
                    ? "bg-[hsl(var(--portal-surface))] text-[hsl(var(--portal-muted))]"
                    : "bg-[hsl(var(--portal-gold))] text-[hsl(0_0%_4%)]"
                }`}
              >
                {declaring ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : anyPaymentDeclared ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {anyPaymentDeclared ? "Verifying..." : "I Have Paid"}
              </Button>
              {anyPaymentDeclared && (
                <p className="text-center text-xs text-[hsl(var(--portal-muted))]">
                  We're verifying your payment. This usually takes a few hours.
                </p>
              )}
            </div>
          )}
        </main>
      )}
    </div>
  );
};

export default Portal;
