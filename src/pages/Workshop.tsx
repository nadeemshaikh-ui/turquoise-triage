import { useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Crown, Loader2, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";

const KANBAN_COLUMNS = [
  { key: "New", label: "New Intake" },
  { key: "Assigned", label: "Assigned" },
  { key: "In Progress", label: "In-Progress" },
  { key: "QC", label: "QC" },
  { key: "Ready for Pickup", label: "Ready for Pickup" },
  { key: "Completed", label: "Completed" },
];

interface KanbanLead {
  id: string;
  customerName: string;
  serviceName: string;
  quotedPrice: number;
  status: string;
  isGoldTier: boolean;
  tatDaysMax: number;
  createdAt: string;
}

const getSlaStatus = (createdAt: string, tatDaysMax: number, status: string): "ok" | "warning" | "overdue" => {
  if (status === "Completed") return "ok";
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

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["workshop-leads"],
    queryFn: async (): Promise<KanbanLead[]> => {
      const { data, error } = await supabase
        .from("leads")
        .select(`
          id, quoted_price, status, tat_days_max, is_gold_tier, created_at,
          custom_service_name,
          customers ( name ),
          services ( name )
        `)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        customerName: r.customers?.name ?? "Unknown",
        serviceName: r.custom_service_name || r.services?.name || "Unknown",
        quotedPrice: Number(r.quoted_price),
        status: r.status,
        isGoldTier: r.is_gold_tier,
        tatDaysMax: r.tat_days_max,
        createdAt: r.created_at,
      }));
    },
  });

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
    const { data } = await supabase
      .from("service_recipes")
      .select("quantity, inventory_items(name, unit)")
      .eq("service_id", lead.id);
    // We need the service_id from the lead — refetch it
    const { data: leadData } = await supabase
      .from("leads")
      .select("service_id")
      .eq("id", lead.id)
      .single();
    if (!leadData) return;
    const { data: recipes } = await supabase
      .from("service_recipes")
      .select("quantity, inventory_items(name, unit)")
      .eq("service_id", leadData.service_id);
    if (recipes && recipes.length > 0) {
      const items = recipes.map((r: any) => `${r.inventory_items?.name}: −${r.quantity} ${r.inventory_items?.unit}`).join(", ");
      toast({
        title: "📦 Stock Deducted",
        description: `${lead.serviceName} → ${items}`,
      });
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
        if (lead) showDeductionToast(lead);
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
      // Optimistic update
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
                <div className="flex w-56 shrink-0 flex-col gap-2">
                  <div className="flex items-center justify-between rounded-[28px] bg-muted px-4 py-2 shadow-[0_1px_6px_-2px_hsl(174_72%_56%/0.12)]">
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
                    {col.items.map((lead, index) => {
                      const sla = getSlaStatus(lead.createdAt, lead.tatDaysMax, lead.status);
                      const colIdx = KANBAN_COLUMNS.findIndex((c) => c.key === lead.status);
                      const nextStatus = colIdx < KANBAN_COLUMNS.length - 1 ? KANBAN_COLUMNS[colIdx + 1] : null;

                      return (
                        <Draggable draggableId={lead.id} index={index} key={lead.id}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={cn(
                                "rounded-[20px] border-2 bg-card p-3 shadow-[0_2px_10px_-4px_hsl(174_72%_56%/0.10)] transition-all cursor-grab active:cursor-grabbing",
                                slaBorder[sla],
                                snapshot.isDragging && "shadow-[0_8px_24px_-4px_hsl(174_72%_56%/0.25)] rotate-1 scale-[1.02]"
                              )}
                              onClick={() => !snapshot.isDragging && navigate(`/leads/${lead.id}`)}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <p className="text-sm font-semibold text-card-foreground leading-tight">{lead.customerName}</p>
                                {lead.isGoldTier && <Crown className="h-3.5 w-3.5 shrink-0 text-gold" />}
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground truncate">{lead.serviceName}</p>
                              <p className="mt-1 text-sm font-bold text-primary">₹{lead.quotedPrice.toLocaleString("en-IN")}</p>

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

                              {nextStatus && lead.status !== "Completed" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateStatus.mutate({ id: lead.id, status: nextStatus.key });
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
                    })}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
};

export default Workshop;
