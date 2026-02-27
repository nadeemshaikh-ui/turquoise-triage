import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
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
  canRemoveTask?: boolean;
}

const ExpertHuddle = ({ orderId, tasks, onAddTask, onUpdateTask, canEdit = true, canRemoveTask = true }: ExpertHuddleProps) => {
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
      {canEdit && !canRemoveTask && (
        <div className="rounded-[calc(var(--radius)/2)] bg-blue-50 border border-blue-200 p-2 text-xs text-blue-800">
          🔧 Workshop mode — only upselling (adding) allowed. Existing tasks cannot be removed.
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
            canRemoveTask={canRemoveTask}
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
  canRemoveTask: boolean;
}

const ExpertSection = ({ type, label, task, tags, experts, orderId, onAddTask, onUpdateTask, canEdit, canRemoveTask }: ExpertSectionProps) => {
  const [open, setOpen] = useState(!!task);
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo || "");
  const [selectedTags, setSelectedTags] = useState<string[]>(task?.scopeTags || []);
  const [price, setPrice] = useState(String(task?.estimatedPrice || ""));
  const [note, setNote] = useState(task?.expertNote || "");
  const [saving, setSaving] = useState(false);
  const [isOptional, setIsOptional] = useState(task?.isOptional ?? false);

  const scopeDescription = selectedTags
    .map((tag) => {
      const def = tags.find((t: any) => t.tag_name === tag);
      return def?.service_description || tag;
    })
    .join(". ");

  const toggleTag = (tagName: string) => {
    if (!canEdit) return;
    // In scope lockdown mode, only allow adding new tags (not removing existing ones)
    if (!canRemoveTask && task && task.scopeTags.includes(tagName)) return;
    setSelectedTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  };

  const handlePriceChange = (newPrice: string) => {
    // In scope lockdown, price cannot be lowered below current task price
    if (!canRemoveTask && task) {
      const newVal = Number(newPrice) || 0;
      if (newVal < task.estimatedPrice) return;
    }
    setPrice(newPrice);
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
        is_optional: isOptional,
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

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Scope Tags</label>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag: any) => {
              const isSelected = selectedTags.includes(tag.tag_name);
              const isLockedTag = !canRemoveTask && task && task.scopeTags.includes(tag.tag_name);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.tag_name)}
                  disabled={!canEdit || (isLockedTag && isSelected)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors border ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                  } ${(!canEdit || (isLockedTag && isSelected)) ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  {tag.tag_name} {isLockedTag && isSelected ? "🔒" : ""}
                </button>
              );
            })}
          </div>
          {scopeDescription && (
            <p className="text-[11px] text-muted-foreground mt-1 italic">{scopeDescription}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Estimated Price (₹) {!canRemoveTask && task ? `(min ₹${task.estimatedPrice.toLocaleString()})` : ""}
          </label>
          <Input
            type="number"
            value={price}
            onChange={(e) => handlePriceChange(e.target.value)}
            placeholder="0"
            className="h-9"
            disabled={!canEdit}
            min={!canRemoveTask && task ? task.estimatedPrice : undefined}
          />
        </div>

        {/* Optional toggle for customer portal */}
        {canEdit && (
          <div className="flex items-center gap-2 rounded-[calc(var(--radius)/2)] border border-dashed border-muted-foreground/30 bg-muted/30 p-2">
            <Checkbox
              id={`optional-${type}`}
              checked={isOptional}
              onCheckedChange={(checked) => setIsOptional(!!checked)}
            />
            <label htmlFor={`optional-${type}`} className="text-[11px] text-muted-foreground cursor-pointer">
              Mark as Optional (customer can exclude on portal)
            </label>
          </div>
        )}

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
