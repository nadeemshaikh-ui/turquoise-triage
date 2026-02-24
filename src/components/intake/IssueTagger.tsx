import { cn } from "@/lib/utils";
import {
  Palette, Slash, Droplets, Unlink, CloudRain, Layers, Wrench, Move,
} from "lucide-react";

export type IssueTag = {
  id: string;
  label: string;
  icon: React.ReactNode;
  conditionNote: string;
};

export const ISSUE_TAGS: IssueTag[] = [
  { id: "color_fading", label: "Color Fading", icon: <Palette className="h-3.5 w-3.5" />, conditionNote: "Visible color degradation across surface areas" },
  { id: "deep_scuffs", label: "Deep Scuffs", icon: <Slash className="h-3.5 w-3.5" />, conditionNote: "Deep surface scratches requiring restoration treatment" },
  { id: "ink_stains", label: "Ink Stains", icon: <Droplets className="h-3.5 w-3.5" />, conditionNote: "Ink contamination requiring specialized solvent treatment" },
  { id: "sole_separation", label: "Sole Separation", icon: <Unlink className="h-3.5 w-3.5" />, conditionNote: "Sole detachment requiring structural re-bonding" },
  { id: "water_damage", label: "Water Damage", icon: <CloudRain className="h-3.5 w-3.5" />, conditionNote: "Water exposure damage with potential material warping" },
  { id: "peeling", label: "Peeling", icon: <Layers className="h-3.5 w-3.5" />, conditionNote: "Surface material peeling requiring re-lamination" },
  { id: "hardware_damage", label: "Hardware", icon: <Wrench className="h-3.5 w-3.5" />, conditionNote: "Metal hardware showing corrosion or mechanical failure" },
  { id: "structural_deform", label: "Structural", icon: <Move className="h-3.5 w-3.5" />, conditionNote: "Structural deformation requiring reshaping treatment" },
];

export function generateConditionNote(selectedIds: string[]): string {
  return ISSUE_TAGS
    .filter((t) => selectedIds.includes(t.id))
    .map((t) => t.conditionNote)
    .join(". ") + (selectedIds.length > 0 ? "." : "");
}

type Props = {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
};

const IssueTagger = ({ selectedTags, onTagsChange }: Props) => {
  const toggle = (id: string) => {
    onTagsChange(
      selectedTags.includes(id)
        ? selectedTags.filter((t) => t !== id)
        : [...selectedTags, id]
    );
  };

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {ISSUE_TAGS.map((tag) => {
        const isActive = selectedTags.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag.id)}
            className={cn(
              "flex min-h-[44px] items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[11px] font-medium transition-all",
              isActive
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-foreground hover:border-primary/50"
            )}
          >
            {tag.icon}
            <span className="leading-tight">{tag.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default IssueTagger;
