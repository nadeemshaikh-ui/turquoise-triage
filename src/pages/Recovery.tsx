import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Crown,
  Loader2,
  Clock,
  Send,
  CheckCircle2,
  XCircle,
  Percent,
  AlertTriangle,
  Zap,
  RotateCcw,
  Sparkles,
  Copy,
  MessageSquare,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface StaleLead {
  id: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  brandName: string | null;
  quotedPrice: number;
  tier: string;
  isGoldTier: boolean;
  createdAt: string;
  hoursStale: number;
  recoveryStatus: "pending" | "sent" | "converted" | "expired";
  recoveryId: string | null;
  discountPercent: number | null;
  isLegacyWarmLead: boolean;
  legacyLtv: number;
}

const Recovery = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [draftDialog, setDraftDialog] = useState<{ open: boolean; lead: StaleLead | null; message: string; loading: boolean }>({
    open: false, lead: null, message: "", loading: false,
  });
  const [filterWarmLeads, setFilterWarmLeads] = useState(false);

  const { data: staleLeads = [], isLoading } = useQuery({
    queryKey: ["recovery-queue"],
    queryFn: async (): Promise<StaleLead[]> => {
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      const { data: leads, error } = await supabase
        .from("leads")
        .select(`
          id, quoted_price, status, tier, is_gold_tier, created_at,
          custom_service_name,
          customers ( name, phone, legacy_ltv, service_affinity ),
          services ( name ),
          lead_items ( brand_id, brands ( name ) )
        `)
        .eq("status", "New")
        .lte("created_at", cutoff)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const leadIds = (leads || []).map((l: any) => l.id);
      let recoveryMap = new Map<string, any>();
      if (leadIds.length > 0) {
        const { data: offers } = await supabase
          .from("recovery_offers")
          .select("*")
          .in("lead_id", leadIds);
        (offers || []).forEach((o: any) => {
          if (!recoveryMap.has(o.lead_id) || new Date(o.sent_at) > new Date(recoveryMap.get(o.lead_id).sent_at)) {
            recoveryMap.set(o.lead_id, o);
          }
        });
      }

      return (leads || []).map((r: any) => {
        const hoursStale = Math.floor((Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60));
        const offer = recoveryMap.get(r.id);
        let recoveryStatus: StaleLead["recoveryStatus"] = "pending";
        if (offer) {
          if (offer.status === "converted") recoveryStatus = "converted";
          else if (new Date(offer.expires_at) < new Date()) recoveryStatus = "expired";
          else recoveryStatus = "sent";
        }
        const brandName = r.lead_items?.[0]?.brands?.name || null;
        const serviceAffinity = (r.customers?.service_affinity as string[]) || [];
        const isLegacyWarmLead = serviceAffinity.length > 0;
        const legacyLtv = Number(r.customers?.legacy_ltv) || 0;
        return {
          id: r.id,
          customerName: r.customers?.name ?? "Unknown",
          customerPhone: r.customers?.phone ?? "",
          serviceName: r.custom_service_name || r.services?.name || "Unknown",
          brandName,
          quotedPrice: Number(r.quoted_price),
          tier: r.tier || "Premium",
          isGoldTier: r.is_gold_tier,
          createdAt: r.created_at,
          hoursStale,
          recoveryStatus,
          recoveryId: offer?.id || null,
          discountPercent: offer?.discount_percent || null,
          isLegacyWarmLead,
          legacyLtv,
        };
      });
    },
    refetchInterval: 60_000,
  });

  const sendOffer = useMutation({
    mutationFn: async ({ leadId, discount }: { leadId: string; discount: number }) => {
      const { error } = await supabase.from("recovery_offers").insert({
        lead_id: leadId,
        discount_percent: discount,
        offer_type: "second_chance",
      });
      if (error) throw error;

      const lead = staleLeads.find((l) => l.id === leadId);
      if (lead?.customerPhone) {
        supabase.functions.invoke("send-whatsapp", {
          body: {
            lead_id: leadId,
            customer_phone: lead.customerPhone,
            customer_name: lead.customerName,
            service_name: lead.serviceName,
            template_type: "second_chance",
            discount_percent: discount,
          },
        }).then(({ error: whatsappErr }) => {
          if (!whatsappErr) toast({ title: "📱 WhatsApp recovery offer sent" });
        }).catch(() => {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recovery-queue"] });
      toast({ title: "🎯 Second Chance offer sent!" });
      setSendingId(null);
    },
    onError: () => {
      toast({ title: "Failed to send offer", variant: "destructive" });
      setSendingId(null);
    },
  });

  const markConverted = useMutation({
    mutationFn: async ({ recoveryId, leadId }: { recoveryId: string; leadId: string }) => {
      const { error } = await supabase
        .from("recovery_offers")
        .update({ status: "converted", responded_at: new Date().toISOString() })
        .eq("id", recoveryId);
      if (error) throw error;
      await supabase.from("leads").update({ status: "Assigned" }).eq("id", leadId);
      await supabase.from("lead_activity").insert({
        lead_id: leadId,
        action: "Recovery Converted",
        details: "Customer accepted Second Chance offer",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recovery-queue"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["workshop-leads"] });
      toast({ title: "✅ Lead recovered and moved to Assigned!" });
    },
  });

  const draftRecoveryMessage = async (lead: StaleLead) => {
    setDraftDialog({ open: true, lead, message: "", loading: true });
    try {
      const { data, error } = await supabase.functions.invoke("draft-recovery", {
        body: {
          customerName: lead.customerName,
          brandName: lead.brandName,
          serviceName: lead.serviceName,
          quotedPrice: lead.quotedPrice,
          hoursStale: lead.hoursStale,
        },
      });
      if (error) throw error;
      setDraftDialog((prev) => ({ ...prev, message: data.message || "Unable to generate message.", loading: false }));
    } catch (e: any) {
      setDraftDialog((prev) => ({ ...prev, message: "Failed to generate message. Please try again.", loading: false }));
      toast({ title: "AI draft failed", description: e?.message, variant: "destructive" });
    }
  };

  const filteredLeads = filterWarmLeads ? staleLeads.filter((l) => l.isLegacyWarmLead) : staleLeads;

  const pending = filteredLeads.filter((l) => l.recoveryStatus === "pending");
  const sent = filteredLeads.filter((l) => l.recoveryStatus === "sent");
  const converted = filteredLeads.filter((l) => l.recoveryStatus === "converted");
  const expired = filteredLeads.filter((l) => l.recoveryStatus === "expired");

  const warmLeadCount = staleLeads.filter((l) => l.isLegacyWarmLead).length;

  const conversionRate = filteredLeads.length > 0
    ? Math.round((converted.length / filteredLeads.length) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-primary" />
          97% Recovery Queue
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Leads quoted but not booked after 48 hours — send Second Chance offers
        </p>
      </div>

      {/* Filter + Stats */}
      {warmLeadCount > 0 && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={filterWarmLeads ? "default" : "outline"}
            className="h-7 text-[10px] rounded-xl gap-1"
            onClick={() => setFilterWarmLeads(!filterWarmLeads)}
          >
            <Award className="h-3 w-3" />
            Legacy Warm Leads ({warmLeadCount})
          </Button>
          {filterWarmLeads && (
            <p className="text-xs text-muted-foreground">Showing customers with sneaker/bag history — ideal for "Intro to Restoree" offers</p>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Awaiting Offer" value={pending.length} icon={Clock} color="text-amber-500" />
        <StatCard label="Offers Sent" value={sent.length} icon={Send} color="text-blue-500" />
        <StatCard label="Recovered" value={converted.length} icon={CheckCircle2} color="text-emerald-500" />
        <StatCard label="Recovery Rate" value={`${conversionRate}%`} icon={Percent} color="text-primary" />
      </div>

      {/* Pending Section */}
      {pending.length > 0 && (
        <Section title="⏰ Awaiting Second Chance" count={pending.length} variant="warning">
          {pending.map((lead) => (
            <RecoveryCard
              key={lead.id}
              lead={lead}
              onSendOffer={(discount) => {
                setSendingId(lead.id);
                sendOffer.mutate({ leadId: lead.id, discount });
              }}
              onDraftMessage={() => draftRecoveryMessage(lead)}
              isSending={sendingId === lead.id}
              onNavigate={() => navigate(`/leads/${lead.id}`)}
            />
          ))}
        </Section>
      )}

      {/* Sent Section */}
      {sent.length > 0 && (
        <Section title="📨 Offers Sent" count={sent.length} variant="info">
          {sent.map((lead) => (
            <RecoveryCard
              key={lead.id}
              lead={lead}
              onMarkConverted={() =>
                lead.recoveryId && markConverted.mutate({ recoveryId: lead.recoveryId, leadId: lead.id })
              }
              onNavigate={() => navigate(`/leads/${lead.id}`)}
            />
          ))}
        </Section>
      )}

      {/* Expired */}
      {expired.length > 0 && (
        <Section title="⌛ Expired Offers" count={expired.length} variant="muted">
          {expired.map((lead) => (
            <RecoveryCard
              key={lead.id}
              lead={lead}
              onSendOffer={(discount) => {
                setSendingId(lead.id);
                sendOffer.mutate({ leadId: lead.id, discount });
              }}
              onDraftMessage={() => draftRecoveryMessage(lead)}
              isSending={sendingId === lead.id}
              onNavigate={() => navigate(`/leads/${lead.id}`)}
              isRetry
            />
          ))}
        </Section>
      )}

      {/* Converted */}
      {converted.length > 0 && (
        <Section title="🎉 Recovered Leads" count={converted.length} variant="success">
          {converted.map((lead) => (
            <RecoveryCard
              key={lead.id}
              lead={lead}
              onNavigate={() => navigate(`/leads/${lead.id}`)}
            />
          ))}
        </Section>
      )}

      {staleLeads.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500/50" />
          <p className="font-medium">No stale leads!</p>
          <p className="text-sm">All quotes have been actioned within 48 hours.</p>
        </div>
      )}

      {/* AI Draft Message Dialog */}
      <Dialog open={draftDialog.open} onOpenChange={(open) => !open && setDraftDialog({ open: false, lead: null, message: "", loading: false })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Recovery Message
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            {draftDialog.loading ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Crafting a personalized message…</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-muted/50 p-4">
                <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">{draftDialog.message}</p>
              </div>
            )}
          </div>
          {!draftDialog.loading && draftDialog.message && (
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  navigator.clipboard.writeText(draftDialog.message);
                  toast({ title: "Message copied!" });
                }}
              >
                <Copy className="h-4 w-4" /> Copy
              </Button>
              {draftDialog.lead?.customerPhone && (
                <Button
                  className="gap-2"
                  onClick={() => {
                    const encoded = encodeURIComponent(draftDialog.message);
                    const phone = draftDialog.lead!.customerPhone.replace(/\D/g, "");
                    window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
                  }}
                >
                  <MessageSquare className="h-4 w-4" /> Send via WhatsApp
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color: string }) => (
  <Card className="rounded-2xl">
    <CardContent className="p-4 flex items-center gap-3">
      <Icon className={cn("h-5 w-5 shrink-0", color)} />
      <div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </CardContent>
  </Card>
);

const Section = ({ title, count, variant, children }: {
  title: string;
  count: number;
  variant: "warning" | "info" | "success" | "muted";
  children: React.ReactNode;
}) => {
  const borderColor = {
    warning: "border-l-amber-500",
    info: "border-l-blue-500",
    success: "border-l-emerald-500",
    muted: "border-l-muted-foreground",
  }[variant];

  return (
    <div className={cn("border-l-4 pl-4 space-y-3", borderColor)}>
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <Badge variant="secondary" className="text-[10px]">{count}</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
};

const RecoveryCard = ({
  lead,
  onSendOffer,
  onMarkConverted,
  onDraftMessage,
  onNavigate,
  isSending,
  isRetry,
}: {
  lead: StaleLead;
  onSendOffer?: (discount: number) => void;
  onMarkConverted?: () => void;
  onDraftMessage?: () => void;
  onNavigate: () => void;
  isSending?: boolean;
  isRetry?: boolean;
}) => {
  const [discount, setDiscount] = useState(10);

  return (
    <Card
      className={cn(
        "rounded-2xl cursor-pointer hover:shadow-md transition-shadow",
        lead.tier === "Elite" && "border-primary shadow-[0_0_12px_-2px_hsl(var(--primary)/0.3)] ring-1 ring-primary/20"
      )}
      onClick={onNavigate}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-card-foreground">{lead.customerName}</p>
            <p className="text-xs text-muted-foreground">{lead.serviceName}</p>
            {lead.brandName && (
              <p className="text-[10px] text-muted-foreground/70">{lead.brandName}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {lead.legacyLtv > 25000 && (
              <Badge className="h-4 text-[8px] px-1.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 gap-0.5">
                <Award className="h-2.5 w-2.5" />VIP
              </Badge>
            )}
            {lead.isLegacyWarmLead && (
              <Badge variant="outline" className="h-4 text-[8px] px-1.5 gap-0.5">Warm</Badge>
            )}
            {lead.isGoldTier && <Crown className="h-3.5 w-3.5 text-amber-500" />}
            {lead.tier === "Elite" && (
              <Badge className="h-4 text-[8px] px-1.5 bg-primary text-primary-foreground gap-0.5">
                <Zap className="h-2.5 w-2.5" />ELITE
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-primary">₹{lead.quotedPrice.toLocaleString("en-IN")}</p>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <AlertTriangle className="h-3 w-3" />
            {lead.hoursStale}h stale
          </div>
        </div>

        {lead.recoveryStatus === "sent" && lead.discountPercent && (
          <Badge variant="outline" className="text-[10px] gap-1">
            <Percent className="h-2.5 w-2.5" />{lead.discountPercent}% offer active
          </Badge>
        )}

        {lead.recoveryStatus === "converted" && (
          <Badge className="bg-emerald-500/10 text-emerald-600 text-[10px] gap-1">
            <CheckCircle2 className="h-2.5 w-2.5" /> Recovered
          </Badge>
        )}

        {lead.recoveryStatus === "expired" && (
          <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
            <XCircle className="h-2.5 w-2.5" /> Expired
          </Badge>
        )}

        {/* Actions */}
        {(lead.recoveryStatus === "pending" || isRetry) && onSendOffer && (
          <div className="space-y-2 pt-1" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <select
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="h-7 rounded-xl border border-border bg-background px-2 text-[11px]"
              >
                <option value={5}>5% off</option>
                <option value={10}>10% off</option>
                <option value={15}>15% off</option>
                <option value={20}>20% off</option>
              </select>
              <Button
                size="sm"
                className="h-7 text-[10px] rounded-xl gap-1 flex-1"
                onClick={() => onSendOffer(discount)}
                disabled={isSending}
              >
                {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                {isRetry ? "Resend Offer" : "Send Offer"}
              </Button>
            </div>
            {onDraftMessage && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] rounded-xl gap-1 w-full"
                onClick={onDraftMessage}
              >
                <Sparkles className="h-3 w-3" /> Draft AI Message
              </Button>
            )}
          </div>
        )}

        {lead.recoveryStatus === "sent" && onMarkConverted && (
          <div onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[10px] rounded-xl gap-1 w-full"
              onClick={onMarkConverted}
            >
              <CheckCircle2 className="h-3 w-3" /> Mark as Converted
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Recovery;
