import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useTriageLeads,
  getLeadTotal,
  type TriageLead,
  type TriageLeadItem,
} from "@/hooks/useTriageLeads";

/* ── helpers ─────────────────────────────────────── */

const canFinalizeQuote = (items: TriageLeadItem[]): boolean => {
  if (items.length === 0) return false;
  return !items.some(
    (i) =>
      i.service_categories?.name?.toLowerCase() === "others" &&
      !i.custom_category_label?.trim()
  );
};

const canMoveToHandover = (items: TriageLeadItem[]): boolean =>
  getLeadTotal(items) > 0;

/* ── column config ───────────────────────────────── */

type ColumnKey = "intake" | "negotiation" | "handover";

const COLUMNS: {
  key: ColumnKey;
  label: string;
  borderColor: string;
  btnLabel: string;
}[] = [
  { key: "intake", label: "INTAKE", borderColor: "#FF9F0A", btnLabel: "Finalize Quote" },
  { key: "negotiation", label: "NEGOTIATION", borderColor: "#0A84FF", btnLabel: "Move to Handover" },
  { key: "handover", label: "HANDOVER", borderColor: "#30D158", btnLabel: "Convert to Order" },
];

/* ── Card ────────────────────────────────────────── */

interface TriageCardProps {
  lead: TriageLead;
  column: ColumnKey;
  borderColor: string;
  btnLabel: string;
}

const TriageCard = ({ lead, column, borderColor, btnLabel }: TriageCardProps) => {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const items = lead.lead_items ?? [];
  const total = getLeadTotal(items);

  const disabled =
    busy ||
    (column === "intake" && !canFinalizeQuote(items)) ||
    (column === "negotiation" && !canMoveToHandover(items));

  const handleAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      if (column === "intake") {
        const { error } = await supabase
          .from("leads")
          .update({ status: "Quoted" })
          .eq("id", lead.id);
        if (error) throw error;
        toast.success("Quote finalized");
      } else if (column === "negotiation") {
        const { error } = await supabase
          .from("leads")
          .update({ status: "Approved", portal_stage: "Approved" })
          .eq("id", lead.id);
        if (error) throw error;
        toast.success("Moved to Handover");
      } else {
        const { data, error } = await supabase.rpc("convert_lead_to_order", {
          p_lead_id: lead.id,
          p_actor_user_id: user?.id,
        });
        if (error) throw error;
        toast.success("Order created");
        queryClient.invalidateQueries({ queryKey: ["triage-leads"] });
        navigate(`/orders/${data}`);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["triage-leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (err: any) {
      toast.error(err.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  };

  // Unique category pills
  const categoryPills = [
    ...new Set(
      items.map(
        (i) => i.custom_category_label?.trim() || i.service_categories?.name || "Item"
      )
    ),
  ];

  return (
    <div
      onClick={() => navigate(`/leads/${lead.id}`)}
      className="cursor-pointer rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="p-4 space-y-3">
        <p className="font-semibold text-foreground truncate">
          {lead.customers?.name ?? "Unknown"}
        </p>

        {categoryPills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {categoryPills.map((c) => (
              <span
                key={c}
                className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {c}
              </span>
            ))}
          </div>
        )}

        {total > 0 && (
          <p className="text-sm font-semibold text-foreground">
            ₹{total.toLocaleString("en-IN")}
          </p>
        )}

        <Button
          size="sm"
          disabled={disabled}
          onClick={handleAction}
          className="w-full"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          {btnLabel}
        </Button>
      </div>
    </div>
  );
};

/* ── Command Center ──────────────────────────────── */

const TriageCommandCenter = () => {
  const { intake, negotiation, handover, isLoading } = useTriageLeads();

  const dataMap: Record<ColumnKey, TriageLead[]> = {
    intake,
    negotiation,
    handover,
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {COLUMNS.map((col) => (
        <div key={col.key} className="space-y-3">
          {/* Column header */}
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: col.borderColor }}
            />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              {col.label}
            </h2>
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {dataMap[col.key].length}
            </span>
          </div>

          {/* Cards */}
          <div className="space-y-3 min-h-[120px]">
            {dataMap[col.key].length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                All caught up! 🎉
              </p>
            ) : (
              dataMap[col.key].map((lead) => (
                <TriageCard
                  key={lead.id}
                  lead={lead}
                  column={col.key}
                  borderColor={col.borderColor}
                  btnLabel={col.btnLabel}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TriageCommandCenter;
