import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Loader2, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { ExpertTask } from "@/hooks/useOrderDetail";

const EXPERT_TYPES = ["cleaning", "repair", "colour"] as const;
const TYPE_LABELS: Record<string, string> = { cleaning: "🧹 Cleaning", repair: "🔧 Repair", colour: "🎨 Colour" };

interface ExpertHuddleProps {
  orderId: string;
  tasks: ExpertTask[];
  onAddTask: (task: any) => Promise<void>;
  onUpdateTask: (args: { taskId: string; updates: Record<string, any> }) => Promise<void>;
  canEdit?: boolean;
}

const ExpertHuddle = ({ orderId, tasks, onAddTask, onUpdateTask, canEdit = true }: ExpertHuddleProps) => {
  const { data: scopeTags } = useQuery({
    queryKey: ["scope-tag-definitions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("scope_tag_definitions")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      return (data || []) as any[];
    },
  });

  const { data: experts } = useQuery({
    queryKey: ["expert-profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, expert_type")
        .not("expert_type", "is", null);
      return (data || []) as any[];
    },
  });

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground">Expert Huddle</h2>
      {!canEdit && (
        <div className="rounded-[calc(var(--radius)/2)] bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800">
          🔒 Contract locked — tasks are read-only
        </div>
      )}
      {EXPERT_TYPES.map((type) => {
        const task = tasks.find((t) => t.expertType === type);
        const tagsForType = (scopeTags || []).filter((t: any) => t.expert_type === type);
        const expertsForType = (experts || []).filter((e: any) => e.expert_type === type);
        return (
          <ExpertSection
            key={type}
            type={type}
            label={TYPE_LABELS[type]}
            task={task}
            tags={tagsForType}
            experts={expertsForType}
            orderId={orderId}
            onAddTask={onAddTask}
            onUpdateTask={onUpdateTask}
            canEdit={canEdit}
          />
        );
      })}
    </section>
  );
};

interface ExpertSectionProps {
  type: string;
  label: string;
  task?: ExpertTask;
  tags: any[];
  experts: any[];
  orderId: string;
  onAddTask: (task: any) => Promise<void>;
  onUpdateTask: (args: { taskId: string; updates: Record<string, any> }) => Promise<void>;
  canEdit: boolean;
}

const ExpertSection = ({ type, label, task, tags, experts, orderId, onAddTask, onUpdateTask, canEdit }: ExpertSectionProps) => {
  const [open, setOpen] = useState(!!task);
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo || "");
  const [selectedTags, setSelectedTags] = useState<string[]>(task?.scopeTags || []);
  const [price, setPrice] = useState(String(task?.estimatedPrice || ""));
  const [note, setNote] = useState(task?.expertNote || "");
  const [saving, setSaving] = useState(false);

  const scopeDescription = selectedTags
    .map((tag) => {
      const def = tags.find((t: any) => t.tag_name === tag);
      return def?.service_description || tag;
    })
    .join(". ");

  const toggleTag = (tagName: string) => {
    if (!canEdit) return;
    setSelectedTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const payload = {
        assigned_to: assignedTo || null,
        scope_tags: selectedTags,
        scope_description: scopeDescription || null,
        estimated_price: Number(price) || 0,
        expert_note: note || null,
      };

      if (task) {
        await onUpdateTask({ taskId: task.id, updates: payload });
      } else {
        await onAddTask({ expert_type: type, ...payload });
      }
      toast({ title: `${label} task saved` });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center justify-between rounded-[var(--radius)] border border-border bg-card p-3 text-sm font-medium text-foreground hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-2">
            <span>{label}</span>
            {task && (
              <Badge variant="secondary" className="text-[10px]">
                ₹{task.estimatedPrice.toLocaleString()}
              </Badge>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-3 rounded-[var(--radius)] border border-border bg-card p-4">
        {/* Expert Assignment */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Assigned Expert</label>
          <Select value={assignedTo} onValueChange={setAssignedTo} disabled={!canEdit}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select expert..." />
            </SelectTrigger>
            <SelectContent>
              {experts.map((e: any) => (
                <SelectItem key={e.user_id} value={e.user_id}>
                  {e.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Scope Tags */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Scope Tags</label>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag: any) => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.tag_name)}
                disabled={!canEdit}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors border ${
                  selectedTags.includes(tag.tag_name)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                } ${!canEdit ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {tag.tag_name}
              </button>
            ))}
          </div>
          {scopeDescription && (
            <p className="text-[11px] text-muted-foreground mt-1 italic">{scopeDescription}</p>
          )}
        </div>

        {/* Price */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Estimated Price (₹)</label>
          <Input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
            className="h-9"
            disabled={!canEdit}
          />
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Expert Notes</label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notes..."
            className="min-h-[60px]"
            disabled={!canEdit}
          />
        </div>

        {canEdit && (
          <Button onClick={handleSave} disabled={saving} size="sm" className="w-full gap-2">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save {label}
          </Button>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ExpertHuddle;
