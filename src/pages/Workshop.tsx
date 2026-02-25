import { useEffect, useMemo, useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Crown, Loader2, AlertTriangle, Clock, Package, StickyNote, Check, ClipboardCheck, Zap, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";

const KANBAN_COLUMNS = [
  { key: "New", label: "Triage" },
  { key: "In Progress", label: "In-Work" },
  { key: "QC", label: "QC" },
  { key: "Ready for Pickup", label: "Ready" },
];

interface KanbanLead {
  id: string;
  customerName: string;
  serviceName: string;
  serviceId: string;
  quotedPrice: number;
  status: string;
  tier: string;
  isGoldTier: boolean;
  tatDaysMax: number;
  createdAt: string;
  notes: string | null;
  qcChecklist: Record<string, boolean>;
  photoUrls: string[];
}

interface RecipeMaterial {
  name: string;
  quantity: number;
  unit: string;
}

const getSlaStatus = (createdAt: string, tatDaysMax: number, status: string): "ok" | "warning" | "overdue" => {
  if (status === "Ready for Pickup") return "ok";
  const deadline = new Date(createdAt);
  deadline.setDate(deadline.getDate() + tatDaysMax);
  const now = new Date();
  const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursLeft < 0) return "overdue";
  if (hoursLeft < 48) return "warning";
  return "ok";
};

const slaBorder: Record<string, string> = {
  ok: "border-border",
  warning: "border-gold",
  overdue: "border-destructive",
};

const Workshop = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [turnsBridgeLead, setTurnsBridgeLead] = useState<KanbanLead | null>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["workshop-leads"],
    queryFn: async (): Promise<KanbanLead[]> => {
      const { data, error } = await supabase
        .from("leads")
        .select(`
          id, quoted_price, status, tat_days_max, is_gold_tier, created_at, notes, service_id,
          qc_checklist, custom_service_name, tier,
          customers ( name ),
          services ( name ),
          lead_photos ( storage_path )
        `)
        .in("status", ["New", "In Progress", "QC", "Ready for Pickup"])
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Generate signed URLs for photos
      const leadsWithPhotos = await Promise.all((data || []).map(async (r: any) => {
        let photoUrls: string[] = [];
        const photos = r.lead_photos || [];
        if (photos.length > 0) {
          const paths = photos.slice(0, 3).map((p: any) => p.storage_path);
          const results = await Promise.all(
            paths.map((path: string) =>
              supabase.storage.from("lead-photos").createSignedUrl(path, 3600)
            )
          );
          photoUrls = results.map((r) => r.data?.signedUrl).filter(Boolean) as string[];
        }
        return {
          id: r.id,
          customerName: r.customers?.name ?? "Unknown",
          serviceName: r.custom_service_name || r.services?.name || "Unknown",
          serviceId: r.service_id,
          quotedPrice: Number(r.quoted_price),
          status: r.status,
          tier: r.tier || "Premium",
          isGoldTier: r.is_gold_tier,
          tatDaysMax: r.tat_days_max,
          createdAt: r.created_at,
          notes: r.notes,
          qcChecklist: (r.qc_checklist as Record<string, boolean>) || {},
          photoUrls,
        };
      }));

      return leadsWithPhotos;
    },
  });

  // Fetch all service recipes with materials
  const { data: recipes = [] } = useQuery({
    queryKey: ["workshop-recipes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_recipes")
        .select("service_id, quantity, inventory_items(name, unit)");
      if (error) throw error;
      return data || [];
    },
  });

  const materialsByService = useMemo(() => {
    const map = new Map<string, RecipeMaterial[]>();
    (recipes as any[]).forEach((r: any) => {
      const serviceId = r.service_id;
      if (!map.has(serviceId)) map.set(serviceId, []);
      map.get(serviceId)!.push({
        name: r.inventory_items?.name || "Unknown",
        quantity: Number(r.quantity),
        unit: r.inventory_items?.unit || "pcs",
      });
    });
    return map;
  }, [recipes]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("workshop-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        queryClient.invalidateQueries({ queryKey: ["workshop-leads"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const showDeductionToast = useCallback(async (lead: KanbanLead) => {
    const { data: leadData } = await supabase
      .from("leads")
      .select("service_id, customer_id, customers(phone)")
      .eq("id", lead.id)
      .single();
    if (!leadData) return;

    const { data: recipeData } = await supabase
      .from("service_recipes")
      .select("quantity, inventory_items(name, unit)")
      .eq("service_id", leadData.service_id);
    if (recipeData && recipeData.length > 0) {
      const items = recipeData.map((r: any) => `${r.inventory_items?.name}: −${r.quantity} ${r.inventory_items?.unit}`).join(", ");
      toast({
        title: "📦 Stock Deducted",
        description: `${lead.serviceName} → ${items}`,
      });
    }

    const customerPhone = (leadData as any).customers?.phone;
    if (customerPhone) {
      supabase.functions.invoke("send-whatsapp", {
        body: {
          lead_id: lead.id,
          customer_phone: customerPhone,
          customer_name: lead.customerName,
          service_name: lead.serviceName,
        },
      }).then(({ error }) => {
        if (!error) {
          toast({ title: "📱 WhatsApp notification sent" });
        }
      }).catch(() => {});
    }
  }, []);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("leads").update({ status }).eq("id", id);
      if (error) throw error;
      return { id, status };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workshop-leads"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      if (variables.status === "Ready for Pickup") {
        const lead = leads.find((l) => l.id === variables.id);
        if (lead) {
          showDeductionToast(lead);
          setTurnsBridgeLead(lead);
        }
      }
    },
  });

  const columns = useMemo(() => {
    return KANBAN_COLUMNS.map((col) => ({
      ...col,
      items: leads.filter((l) => l.status === col.key),
    }));
  }, [leads]);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { draggableId, destination } = result;
      if (!destination) return;
      const newStatus = destination.droppableId;
      const lead = leads.find((l) => l.id === draggableId);
      if (!lead || lead.status === newStatus) return;
      queryClient.setQueryData<KanbanLead[]>(["workshop-leads"], (old) =>
        (old || []).map((l) => (l.id === draggableId ? { ...l, status: newStatus } : l))
      );
      updateStatus.mutate({ id: draggableId, status: newStatus });
    },
    [leads, updateStatus, queryClient]
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-foreground">Workshop</h1>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columns.map((col) => (
            <Droppable droppableId={col.key} key={col.key}>
              {(provided, snapshot) => (
                <div className="flex w-60 shrink-0 flex-col gap-2">
                  <div className="flex items-center justify-between rounded-[28px] bg-muted px-4 py-2 shadow-[0_1px_6px_-2px_hsl(16_100%_50%/0.12)]">
                    <span className="text-xs font-semibold text-foreground">{col.label}</span>
                    <Badge variant="secondary" className="text-[10px]">{col.items.length}</Badge>
                  </div>
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "flex flex-col gap-2 min-h-[100px] rounded-2xl p-1 transition-colors",
                      snapshot.isDraggingOver && "bg-primary/5"
                    )}
                  >
                    {/* Elite leads first */}
                    {col.items.filter(l => l.tier === "Elite").map((lead, index) => (
                      <KanbanCard
                        key={lead.id}
                        lead={lead}
                        index={index}
                        materials={materialsByService.get(lead.serviceId) || []}
                        onStatusChange={(status) => updateStatus.mutate({ id: lead.id, status })}
                        onNavigate={() => navigate(`/leads/${lead.id}`)}
                      />
                    ))}
                    {/* Premium leads after */}
                    {col.items.filter(l => l.tier !== "Elite").map((lead, index) => (
                      <KanbanCard
                        key={lead.id}
                        lead={lead}
                        index={col.items.filter(l => l.tier === "Elite").length + index}
                        materials={materialsByService.get(lead.serviceId) || []}
                        onStatusChange={(status) => updateStatus.mutate({ id: lead.id, status })}
                        onNavigate={() => navigate(`/leads/${lead.id}`)}
                      />
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {/* Turns Bridge Popup */}
      <AlertDialog open={!!turnsBridgeLead} onOpenChange={(open) => !open && setTurnsBridgeLead(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">🎉 Ready for Pickup!</AlertDialogTitle>
            <AlertDialogDescription className="text-center space-y-3">
              <p>Great! Now create the final invoice in Turns for:</p>
              <p className="text-3xl font-extrabold text-primary">
                ₹{turnsBridgeLead?.quotedPrice.toLocaleString("en-IN")}
              </p>
              <p className="text-sm text-muted-foreground">
                {turnsBridgeLead?.customerName} — {turnsBridgeLead?.serviceName}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                if (turnsBridgeLead) {
                  navigator.clipboard.writeText(String(turnsBridgeLead.quotedPrice));
                  toast({ title: "Price copied!" });
                }
              }}
            >
              <Copy className="h-4 w-4" /> Copy Price
            </Button>
            <AlertDialogAction onClick={() => setTurnsBridgeLead(null)}>Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const KanbanCard = ({
  lead,
  index,
  materials,
  onStatusChange,
  onNavigate,
}: {
  lead: KanbanLead;
  index: number;
  materials: RecipeMaterial[];
  onStatusChange: (status: string) => void;
  onNavigate: () => void;
}) => {
  const [editingNotes, setEditingNotes] = useState(false);
  const [noteDraft, setNoteDraft] = useState(lead.notes || "");
  const [savingNote, setSavingNote] = useState(false);

  const QC_ITEMS = ["Item Cleaned", "Stitching Verified", "Packaging Ready"];
  const [qcChecks, setQcChecks] = useState<Record<string, boolean>>(lead.qcChecklist || {});

  const toggleQcItem = async (item: string, checked: boolean) => {
    const updated = { ...qcChecks, [item]: checked };
    setQcChecks(updated);
    await supabase.from("leads").update({ qc_checklist: updated }).eq("id", lead.id);
  };

  const sla = getSlaStatus(lead.createdAt, lead.tatDaysMax, lead.status);
  const colIdx = KANBAN_COLUMNS.findIndex((c) => c.key === lead.status);
  const nextStatus = colIdx < KANBAN_COLUMNS.length - 1 ? KANBAN_COLUMNS[colIdx + 1] : null;

  const saveNote = async () => {
    setSavingNote(true);
    try {
      const { error } = await supabase.from("leads").update({ notes: noteDraft.trim() || null }).eq("id", lead.id);
      if (error) throw error;
      setEditingNotes(false);
    } catch {
      toast({ title: "Failed to save note", variant: "destructive" });
    } finally {
      setSavingNote(false);
    }
  };

  const isElite = lead.tier === "Elite";

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            "rounded-[20px] border-2 bg-card p-3 shadow-[0_2px_10px_-4px_hsl(16_100%_50%/0.10)] transition-all cursor-grab active:cursor-grabbing",
            isElite
              ? "border-amber-400 shadow-[0_0_20px_-2px_rgba(251,191,36,0.5)] ring-1 ring-amber-400/40"
              : slaBorder[sla],
            snapshot.isDragging && "shadow-[0_8px_24px_-4px_hsl(16_100%_50%/0.25)] rotate-1 scale-[1.02]"
          )}
          onClick={() => !snapshot.isDragging && !editingNotes && onNavigate()}
        >
          <div className="flex items-start justify-between gap-1">
            <p className="text-sm font-semibold text-card-foreground leading-tight">{lead.customerName}</p>
            <div className="flex items-center gap-1 shrink-0">
              {lead.isGoldTier && <Crown className="h-3.5 w-3.5 text-gold" />}
              {isElite && (
                <Badge className="h-5 text-[9px] px-1.5 bg-amber-500 text-white gap-0.5 border-0">
                  <Zap className="h-2.5 w-2.5" />ELITE
                </Badge>
              )}
            </div>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground truncate">{lead.serviceName}</p>
          <p className="mt-1 text-sm font-bold text-primary">₹{lead.quotedPrice.toLocaleString("en-IN")}</p>

          {/* Item Photos */}
          {lead.photoUrls.length > 0 && (
            <div className="mt-2 flex gap-1.5">
              {lead.photoUrls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Item ${i + 1}`}
                  className="h-10 w-10 rounded-lg object-cover border border-border"
                  loading="lazy"
                />
              ))}
            </div>
          )}
          {materials.length > 0 && (
            <div className="mt-2 space-y-0.5">
              <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <Package className="h-3 w-3" /> Materials
              </div>
              {materials.map((m, i) => (
                <p key={i} className="text-[10px] text-foreground/70 pl-4">
                  Use {m.quantity} {m.unit} {m.name}
                </p>
              ))}
            </div>
          )}

          {/* Notes */}
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            {editingNotes ? (
              <div className="space-y-1">
                <Textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="e.g. Deep stain on left heel"
                  className="text-[11px] min-h-[48px] rounded-xl resize-none"
                  autoFocus
                />
                <div className="flex gap-1 justify-end">
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => { setEditingNotes(false); setNoteDraft(lead.notes || ""); }}>Cancel</Button>
                  <Button size="sm" className="h-6 text-[10px] px-2 rounded-xl gap-1" onClick={saveNote} disabled={savingNote}>
                    {savingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditingNotes(true)}
                className="flex items-start gap-1 w-full text-left rounded-xl hover:bg-muted/50 p-1 -m-1 transition-colors"
              >
                <StickyNote className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
                <p className={cn("text-[10px] line-clamp-2", lead.notes ? "text-foreground/70" : "text-muted-foreground italic")}>
                  {lead.notes || "Add note…"}
                </p>
              </button>
            )}
          </div>

          {/* QC Checklist */}
          {lead.status === "QC" && (
            <div className="mt-2 space-y-1" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <ClipboardCheck className="h-3 w-3" /> QC Checklist
              </div>
              {QC_ITEMS.map((item) => (
                <label key={item} className="flex items-center gap-1.5 pl-4 cursor-pointer">
                  <Checkbox checked={!!qcChecks[item]} onCheckedChange={(checked) => toggleQcItem(item, !!checked)} className="h-3.5 w-3.5" />
                  <span className={cn("text-[10px]", qcChecks[item] ? "text-foreground line-through" : "text-foreground/70")}>{item}</span>
                </label>
              ))}
            </div>
          )}

          {sla === "warning" && (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-gold-foreground">
              <Clock className="h-3 w-3" /> &lt;48h remaining
            </div>
          )}
          {sla === "overdue" && (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-destructive">
              <AlertTriangle className="h-3 w-3" /> TAT exceeded
            </div>
          )}

          {nextStatus && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(nextStatus.key);
              }}
              className="mt-2 w-full rounded-[14px] bg-primary/10 py-1.5 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              → {nextStatus.label}
            </button>
          )}
        </div>
      )}
    </Draggable>
  );
};

export default Workshop;
